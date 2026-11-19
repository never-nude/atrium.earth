import Foundation
import Observation

enum Pane: String, CaseIterable, Identifiable {
    case overview, live, sources, referrers, places, landing, tech, log

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: return "Overview"
        case .live: return "Live"
        case .sources: return "Sources"
        case .referrers: return "Referring pages"
        case .places: return "Places"
        case .landing: return "Landing pages"
        case .tech: return "Devices"
        case .log: return "Activity log"
        }
    }

    var symbol: String {
        switch self {
        case .overview: return "chart.bar.xaxis"
        case .live: return "dot.radiowaves.left.and.right"
        case .sources: return "arrow.triangle.branch"
        case .referrers: return "link"
        case .places: return "mappin.and.ellipse"
        case .landing: return "door.left.hand.open"
        case .tech: return "laptopcomputer.and.iphone"
        case .log: return "list.bullet.rectangle"
        }
    }

    var caption: String {
        switch self {
        case .overview: return ""
        case .live: return "Visitors in the last 30 minutes. Refreshes every 30 seconds."
        case .sources: return "The site, search engine or campaign that started each session."
        case .referrers: return "The exact outside page a visitor came from, when their browser shared it, and the Atrium page they opened."
        case .places: return "City-level location, estimated by Google from the visitor's network."
        case .landing: return "The first page of each session and what sent the visitor there."
        case .tech: return "What visitors are browsing with."
        case .log: return "Minute-by-minute activity, newest first. On a quiet minute, one row is one visitor."
        }
    }

    /// The table shown for the section; Overview and Live compose their own.
    var spec: ReportSpec? {
        let sessions = Column("sessions", "Sessions", width: 76)
        let users = Column("totalUsers", "Visitors", width: 76)
        let views = Column("screenPageViews", "Views", width: 76)
        let engaged = Column("engagedSessions", "Engaged", width: 76)
        let time = Column("averageSessionDuration", "Avg. time", width: 76)
        switch self {
        case .overview, .live:
            return nil
        case .sources:
            return ReportSpec(
                id: rawValue,
                dimensions: [
                    Column("sessionSource", "Source"),
                    Column("sessionMedium", "Medium", width: 110),
                    Column("sessionCampaignName", "Campaign"),
                ],
                metrics: [sessions, users, engaged, views, time]
            )
        case .referrers:
            return ReportSpec(
                id: rawValue,
                dimensions: [Column("pageReferrer", "Came from"), Column("pagePath", "Opened")],
                metrics: [views, users],
                externalReferrersOnly: true
            )
        case .places:
            return ReportSpec(
                id: rawValue,
                dimensions: [Column("city", "City"), Column("region", "Region"), Column("country", "Country")],
                metrics: [sessions, users, engaged, views, time]
            )
        case .landing:
            return ReportSpec(
                id: rawValue,
                dimensions: [
                    Column("landingPagePlusQueryString", "Landing page"),
                    Column("sessionSource", "Source"),
                    Column("sessionMedium", "Medium", width: 110),
                ],
                metrics: [sessions, users, engaged, time]
            )
        case .tech:
            return ReportSpec(
                id: rawValue,
                dimensions: [
                    Column("deviceCategory", "Device", width: 90),
                    Column("operatingSystem", "System"),
                    Column("browser", "Browser"),
                    Column("language", "Language"),
                ],
                metrics: [sessions, users, engaged]
            )
        case .log:
            return ReportSpec(
                id: rawValue,
                dimensions: [
                    Column("dateHourMinute", "When", width: 104),
                    Column("city", "City"),
                    Column("region", "Region"),
                    Column("country", "Country"),
                    Column("sessionSource", "Source"),
                    Column("sessionMedium", "Medium", width: 80),
                    Column("landingPagePlusQueryString", "Landed on"),
                    Column("deviceCategory", "Device", width: 70),
                    Column("browser", "Browser", width: 80),
                ],
                metrics: [
                    Column("sessions", "Sessions", width: 64),
                    Column("screenPageViews", "Views", width: 54),
                ],
                limit: 2000,
                orderByDimension: "dateHourMinute"
            )
        }
    }
}

enum Specs {
    static let totals = ReportSpec(
        id: "overview.totals",
        metrics: [
            Column("totalUsers", "Visitors"),
            Column("newUsers", "New visitors"),
            Column("sessions", "Sessions"),
            Column("screenPageViews", "Page views"),
            Column("engagementRate", "Engaged"),
            Column("averageSessionDuration", "Avg. time"),
        ]
    )

    static func trend(_ range: DateRange) -> ReportSpec {
        ReportSpec(
            id: "overview.trend",
            dimensions: [Column(range.isSingleDay ? "dateHour" : "date", "When")],
            metrics: [Column("sessions", "Sessions")],
            limit: 1000
        )
    }

    static let topSources = ReportSpec(
        id: "overview.sources",
        dimensions: [Column("sessionSource", "Source"), Column("sessionMedium", "Medium", width: 90)],
        metrics: [Column("sessions", "Sessions", width: 70)],
        limit: 8
    )

    static let topPlaces = ReportSpec(
        id: "overview.places",
        dimensions: [Column("city", "City"), Column("country", "Country")],
        metrics: [Column("sessions", "Sessions", width: 70)],
        limit: 8
    )

    static let liveTotal = ReportSpec(
        id: "live.total", metrics: [Column("activeUsers", "Active")], realtime: true
    )

    static let liveMinutes = ReportSpec(
        id: "live.minutes",
        dimensions: [Column("minutesAgo", "Minutes ago")],
        metrics: [Column("activeUsers", "Active")],
        realtime: true
    )

    static let livePlaces = ReportSpec(
        id: "live.places",
        dimensions: [Column("city", "City"), Column("country", "Country")],
        metrics: [Column("activeUsers", "Active", width: 60)],
        realtime: true,
        limit: 50
    )

    static let livePages = ReportSpec(
        id: "live.pages",
        dimensions: [Column("unifiedScreenName", "Page")],
        metrics: [Column("activeUsers", "Active", width: 60), Column("screenPageViews", "Views", width: 60)],
        realtime: true,
        limit: 50
    )
}

@MainActor
@Observable
final class TrafficStore {
    private static let propertyKey = "propertyID"

    @ObservationIgnored private let auth = GoogleAuth()
    private var client: AnalyticsClient { AnalyticsClient(auth: auth) }
    @ObservationIgnored private var signInTask: Task<Void, Never>?

    var signedIn = GoogleAuth.hasRefreshToken
    var signingIn = false
    var authMessage: String?

    var properties: [GAProperty] = []
    var propertyID = UserDefaults.standard.string(forKey: TrafficStore.propertyKey) ?? ""
    var propertyMessage: String?

    var section: Pane? = .overview
    var range: DateRange = .last7
    var filter = ""
    var refreshCount = 0

    var reports: [String: Report] = [:]
    var failures: [String: String] = [:]
    var loading: Set<String> = []

    /// Changes whenever the data behind a report should be fetched again.
    var loadKey: String { "\(propertyID)|\(range.rawValue)|\(refreshCount)" }

    func signIn(clientID: String, clientSecret: String) {
        UserDefaults.standard.set(clientID, forKey: GoogleAuth.clientIDKey)
        Keychain.set(clientSecret, for: "client_secret")
        authMessage = nil
        signingIn = true
        signInTask = Task {
            defer { signingIn = false }
            do {
                try await auth.signIn()
                signedIn = true
            } catch is CancellationError {
            } catch {
                authMessage = error.localizedDescription
            }
        }
    }

    func cancelSignIn() {
        signInTask?.cancel()
    }

    func signOut() {
        Task { await auth.signOut() }
        signedIn = false
        reports = [:]
        failures = [:]
        properties = []
    }

    func selectProperty(_ id: String) {
        let cleaned = id.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "properties/", with: "")
        guard cleaned != propertyID else { return }
        propertyID = cleaned
        UserDefaults.standard.set(cleaned, forKey: Self.propertyKey)
        reports = [:]
        failures = [:]
    }

    func loadProperties() async {
        do {
            properties = try await client.properties()
            propertyMessage = properties.isEmpty
                ? "This Google account has no Analytics properties."
                : nil
            if propertyID.isEmpty, let match = properties.first(where: {
                $0.name.localizedCaseInsensitiveContains("atrium")
            }) ?? properties.first {
                selectProperty(match.id)
            }
        } catch {
            if handleSignedOut(error) { return }
            propertyMessage = "Could not list properties: \(error.localizedDescription) "
                + "You can enter the property ID in Settings."
        }
    }

    func load(_ spec: ReportSpec) async {
        guard signedIn, !propertyID.isEmpty else { return }
        loading.insert(spec.id)
        defer { loading.remove(spec.id) }
        do {
            let report = try await client.run(spec, property: propertyID, range: range)
            guard !Task.isCancelled else { return }
            reports[spec.id] = report
            failures[spec.id] = nil
        } catch {
            if Task.isCancelled || handleSignedOut(error) { return }
            failures[spec.id] = error.localizedDescription
        }
    }

    private func handleSignedOut(_ error: Error) -> Bool {
        guard case AuthError.signedOut = error else { return false }
        signedIn = false
        authMessage = error.localizedDescription
        return true
    }
}
