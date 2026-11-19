import Foundation

struct Column: Hashable {
    let api: String
    let title: String
    /// Fixed width in points; nil lets a dimension column flex.
    var width: CGFloat? = nil

    init(_ api: String, _ title: String, width: CGFloat? = nil) {
        self.api = api
        self.title = title
        self.width = width
    }
}

struct ReportSpec: Identifiable, Hashable {
    let id: String
    var dimensions: [Column] = []
    var metrics: [Column]
    var realtime = false
    var limit = 500
    /// Sort by this dimension, descending. Default is the first metric, descending.
    var orderByDimension: String? = nil
    /// Drop page views whose referrer is Atrium itself.
    var externalReferrersOnly = false
}

enum DateRange: String, CaseIterable, Identifiable {
    case today, yesterday, last7, last28, last90, last365

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: return "Today"
        case .yesterday: return "Yesterday"
        case .last7: return "Last 7 days"
        case .last28: return "Last 28 days"
        case .last90: return "Last 90 days"
        case .last365: return "Last 12 months"
        }
    }

    var start: String {
        switch self {
        case .today: return "today"
        case .yesterday: return "yesterday"
        case .last7: return "6daysAgo"
        case .last28: return "27daysAgo"
        case .last90: return "89daysAgo"
        case .last365: return "364daysAgo"
        }
    }

    var end: String { self == .yesterday ? "yesterday" : "today" }
    var isSingleDay: Bool { self == .today || self == .yesterday }
}

struct ReportRow: Identifiable {
    let id: Int
    let dimensions: [String]
    let metrics: [Double]
}

struct Report {
    var rows: [ReportRow] = []
    var rowCount = 0
    /// Google withheld low-count rows (happens when Google signals is enabled).
    var thresholded = false
    var fetched = Date()
}

struct GAProperty: Identifiable, Hashable {
    let id: String
    let name: String
}

struct APIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

private struct APIFailure: Decodable {
    struct Body: Decodable { let message: String? }
    let error: Body?
}

struct AnalyticsClient {
    let auth: GoogleAuth

    func properties() async throws -> [GAProperty] {
        struct Response: Decodable {
            struct Account: Decodable {
                struct Property: Decodable {
                    let property: String
                    let displayName: String?
                }
                let propertySummaries: [Property]?
            }
            let accountSummaries: [Account]?
        }
        let request = URLRequest(
            url: URL(string: "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200")!
        )
        let response: Response = try await send(request)
        return (response.accountSummaries ?? []).flatMap { $0.propertySummaries ?? [] }.map {
            let id = $0.property.replacingOccurrences(of: "properties/", with: "")
            return GAProperty(id: id, name: $0.displayName ?? id)
        }
    }

    func run(_ spec: ReportSpec, property: String, range: DateRange) async throws -> Report {
        struct Response: Decodable {
            struct Value: Decodable { let value: String? }
            struct Row: Decodable {
                let dimensionValues: [Value]?
                let metricValues: [Value]?
            }
            struct Metadata: Decodable { let subjectToThresholding: Bool? }
            let rows: [Row]?
            let rowCount: Int?
            let metadata: Metadata?
        }

        var body: [String: Any] = [
            "dimensions": spec.dimensions.map { ["name": $0.api] },
            "metrics": spec.metrics.map { ["name": $0.api] },
            "limit": String(spec.limit),
        ]
        if let dimension = spec.orderByDimension {
            body["orderBys"] = [["dimension": ["dimensionName": dimension], "desc": true]]
        } else if let metric = spec.metrics.first {
            body["orderBys"] = [["metric": ["metricName": metric.api], "desc": true]]
        }
        if !spec.realtime {
            body["dateRanges"] = [["startDate": range.start, "endDate": range.end]]
        }
        if spec.externalReferrersOnly {
            body["dimensionFilter"] = [
                "notExpression": [
                    "filter": [
                        "fieldName": "pageReferrer",
                        "stringFilter": [
                            "matchType": "FULL_REGEXP",
                            "value": "(https?://(www\\.)?atrium\\.earth(/.*)?)?",
                        ],
                    ]
                ]
            ]
        }

        let method = spec.realtime ? "runRealtimeReport" : "runReport"
        var request = URLRequest(
            url: URL(string: "https://analyticsdata.googleapis.com/v1beta/properties/\(property):\(method)")!
        )
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let response: Response = try await send(request)
        let rows = (response.rows ?? []).enumerated().map { index, row in
            ReportRow(
                id: index,
                dimensions: (row.dimensionValues ?? []).map { $0.value ?? "" },
                metrics: (row.metricValues ?? []).map { Double($0.value ?? "") ?? 0 }
            )
        }
        return Report(
            rows: rows,
            rowCount: response.rowCount ?? rows.count,
            thresholded: response.metadata?.subjectToThresholding ?? false
        )
    }

    private func send<T: Decodable>(_ original: URLRequest) async throws -> T {
        var request = original
        request.setValue("Bearer \(try await auth.token())", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            let detail = (try? JSONDecoder().decode(APIFailure.self, from: data))?.error?.message
            throw APIError(message: detail ?? "Google Analytics returned HTTP \(status).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

enum Format {
    private static let logInput: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyyMMddHHmm"
        return formatter
    }()

    private static let logOutput: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d  HH:mm"
        return formatter
    }()

    /// Parses GA's date, dateHour and dateHourMinute values (property time zone, shown as-is).
    static func date(_ value: String) -> Date? {
        guard value.count == 8 || value.count == 10 || value.count == 12 else { return nil }
        return logInput.date(from: value.padding(toLength: 12, withPad: "0", startingAt: 0))
    }

    static func dimension(_ value: String, _ column: Column) -> String {
        if value.isEmpty || value == "(not set)" { return "—" }
        if column.api == "dateHourMinute", let date = date(value) { return logOutput.string(from: date) }
        return value
    }

    static func metric(_ value: Double, _ column: Column) -> String {
        switch column.api {
        case "engagementRate":
            return value.formatted(.percent.precision(.fractionLength(0)))
        case "averageSessionDuration", "userEngagementDuration":
            let seconds = Int(value.rounded())
            return seconds >= 60 ? "\(seconds / 60)m \(seconds % 60)s" : "\(seconds)s"
        default:
            return value.formatted(.number.precision(.fractionLength(0)))
        }
    }
}
