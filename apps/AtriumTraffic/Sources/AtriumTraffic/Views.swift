import AppKit
import Charts
import SwiftUI

struct MainView: View {
    @Environment(TrafficStore.self) private var store

    var body: some View {
        @Bindable var store = store
        NavigationSplitView {
            List(Pane.allCases, selection: $store.section) { section in
                Label(section.title, systemImage: section.symbol).tag(section)
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 200, max: 240)
        } detail: {
            Group {
                if store.propertyID.isEmpty {
                    ContentUnavailableView(
                        "Choose a property",
                        systemImage: "chart.bar.doc.horizontal",
                        description: Text(store.propertyMessage ?? "Loading your Analytics properties…")
                    )
                } else {
                    switch store.section ?? .overview {
                    case .overview: OverviewView()
                    case .live: LiveView()
                    case let section: SectionView(section: section)
                    }
                }
            }
            .navigationTitle((store.section ?? .overview).title)
        }
        .toolbar {
            ToolbarItemGroup {
                if store.properties.count > 1 {
                    Picker("Property", selection: Binding(
                        get: { store.propertyID },
                        set: { store.selectProperty($0) }
                    )) {
                        ForEach(store.properties) { Text($0.name).tag($0.id) }
                    }
                }
                Picker("Period", selection: $store.range) {
                    ForEach(DateRange.allCases) { Text($0.title).tag($0) }
                }
                .disabled(store.section == .live)
                Button {
                    store.refreshCount += 1
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .help("Refresh (⌘R)")
            }
        }
        .task { await store.loadProperties() }
    }
}

// MARK: - Sections

struct SectionView: View {
    @Environment(TrafficStore.self) private var store
    let section: Pane

    var body: some View {
        @Bindable var store = store
        VStack(alignment: .leading, spacing: 0) {
            Text(section.caption)
                .font(.callout)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            if let spec = section.spec {
                ReportPanel(spec: spec, showBars: section != .log, scrolls: true)
            }
        }
        .searchable(text: $store.filter, prompt: "Filter rows")
    }
}

struct OverviewView: View {
    @Environment(TrafficStore.self) private var store

    private struct Point: Identifiable {
        let id: Int
        let date: Date
        let sessions: Double
    }

    var body: some View {
        let trendSpec = Specs.trend(store.range)
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                tiles
                VStack(alignment: .leading, spacing: 8) {
                    Text("Sessions").font(.headline)
                    chart(trendSpec)
                }
                HStack(alignment: .top, spacing: 24) {
                    card("Top sources", Specs.topSources)
                    card("Top places", Specs.topPlaces)
                }
            }
            .padding(20)
        }
        .task(id: store.loadKey) {
            async let totals: Void = store.load(Specs.totals)
            async let trend: Void = store.load(trendSpec)
            _ = await (totals, trend)
        }
    }

    private var tiles: some View {
        let report = store.reports[Specs.totals.id]
        let values = report?.rows.first?.metrics ?? []
        return VStack(alignment: .leading, spacing: 8) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 12)], spacing: 12) {
                ForEach(Array(Specs.totals.metrics.enumerated()), id: \.offset) { index, column in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(column.title).font(.caption).foregroundStyle(.secondary)
                        Text(
                            report == nil
                                ? "–"
                                : Format.metric(index < values.count ? values[index] : 0, column)
                        )
                        .font(.title.weight(.semibold))
                        .monospacedDigit()
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(Color.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                }
            }
            if let failure = store.failures[Specs.totals.id] {
                Text(failure).font(.callout).foregroundStyle(.red)
            }
        }
    }

    private func chart(_ spec: ReportSpec) -> some View {
        let points = (store.reports[spec.id]?.rows ?? []).compactMap { row -> Point? in
            guard let value = row.dimensions.first, let date = Format.date(value) else { return nil }
            return Point(id: row.id, date: date, sessions: row.metrics.first ?? 0)
        }
        return Chart(points) { point in
            BarMark(
                x: .value("When", point.date, unit: store.range.isSingleDay ? .hour : .day),
                y: .value("Sessions", point.sessions)
            )
            .foregroundStyle(Color.accentColor.gradient)
        }
        .frame(height: 220)
        .overlay {
            if points.isEmpty, !store.loading.contains(spec.id) {
                Text("No sessions in this period").foregroundStyle(.secondary)
            }
        }
    }

    private func card(_ title: String, _ spec: ReportSpec) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            ReportPanel(spec: spec, showBars: true, scrolls: false)
                .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct LiveView: View {
    @Environment(TrafficStore.self) private var store

    var body: some View {
        let total = store.reports[Specs.liveTotal.id]?.rows.first?.metrics.first
        let minutes = store.reports[Specs.liveMinutes.id]?.rows ?? []
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(total.map { Format.metric($0, Specs.liveTotal.metrics[0]) } ?? "–")
                        .font(.system(size: 56, weight: .semibold))
                        .monospacedDigit()
                        .contentTransition(.numericText())
                    Text("visitors in the last 30 minutes").foregroundStyle(.secondary)
                }
                Chart(minutes) { row in
                    BarMark(
                        x: .value("Minutes ago", -(Int(row.dimensions.first ?? "") ?? 0)),
                        y: .value("Active", row.metrics.first ?? 0)
                    )
                    .foregroundStyle(Color.accentColor.gradient)
                }
                .chartXScale(domain: -30...0)
                .chartXAxisLabel("Minutes ago")
                .frame(height: 140)
                HStack(alignment: .top, spacing: 24) {
                    card("Where they are", Specs.livePlaces)
                    card("What they're viewing", Specs.livePages)
                }
            }
            .padding(20)
        }
        .task(id: store.loadKey) {
            while !Task.isCancelled {
                async let total: Void = store.load(Specs.liveTotal)
                async let minutes: Void = store.load(Specs.liveMinutes)
                async let places: Void = store.load(Specs.livePlaces)
                async let pages: Void = store.load(Specs.livePages)
                _ = await (total, minutes, places, pages)
                try? await Task.sleep(for: .seconds(30))
            }
        }
    }

    private func card(_ title: String, _ spec: ReportSpec) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            // The loop above owns loading so the tables refresh with the headline.
            ReportPanel(spec: spec, showBars: true, scrolls: false, loads: false)
                .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Report table

struct ReportPanel: View {
    @Environment(TrafficStore.self) private var store
    let spec: ReportSpec
    var showBars = true
    var scrolls = true
    var loads = true

    var body: some View {
        Group {
            if let report = store.reports[spec.id] {
                ReportTable(
                    spec: spec,
                    report: report,
                    filter: scrolls ? store.filter : "",
                    showBars: showBars,
                    scrolls: scrolls
                )
            } else if let failure = store.failures[spec.id] {
                ContentUnavailableView(
                    "Couldn't load this report",
                    systemImage: "exclamationmark.triangle",
                    description: Text(failure)
                )
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 120, maxHeight: scrolls ? .infinity : nil)
            }
        }
        .task(id: store.loadKey) {
            if loads { await store.load(spec) }
        }
    }
}

struct ReportTable: View {
    let spec: ReportSpec
    let report: Report
    let filter: String
    let showBars: Bool
    let scrolls: Bool

    private var rows: [ReportRow] {
        let needle = filter.trimmingCharacters(in: .whitespaces)
        guard !needle.isEmpty else { return report.rows }
        return report.rows.filter { row in
            row.dimensions.contains { $0.localizedCaseInsensitiveContains(needle) }
        }
    }

    var body: some View {
        let visible = rows
        let peak = max(report.rows.map { $0.metrics.first ?? 0 }.max() ?? 0, 1)
        VStack(spacing: 0) {
            line(
                dimensions: spec.dimensions.map(\.title),
                metrics: spec.metrics.map(\.title)
            )
            .font(.caption.weight(.medium))
            .foregroundStyle(.secondary)
            .padding(.vertical, 6)
            Divider()
            if visible.isEmpty {
                Text(report.rows.isEmpty ? "No data for this period" : "No rows match the filter")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 80, maxHeight: scrolls ? .infinity : nil)
            } else if scrolls {
                ScrollView { stack(visible, peak: peak) }
                Divider()
                footer(shown: visible.count)
            } else {
                stack(visible, peak: peak)
            }
        }
    }

    private func stack(_ rows: [ReportRow], peak: Double) -> some View {
        LazyVStack(spacing: 0) {
            ForEach(rows) { row in
                line(
                    dimensions: zip(row.dimensions, spec.dimensions).map { Format.dimension($0, $1) },
                    metrics: zip(row.metrics, spec.metrics).map { Format.metric($0, $1) }
                )
                .padding(.vertical, 5)
                .background(alignment: .leading) {
                    if showBars {
                        GeometryReader { proxy in
                            Rectangle()
                                .fill(Color.accentColor.opacity(0.13))
                                .frame(width: proxy.size.width * (row.metrics.first ?? 0) / peak)
                        }
                    }
                }
                .contextMenu {
                    Button("Copy Row") { copy(tsv([row])) }
                }
                Divider().opacity(0.4)
            }
        }
    }

    private func line(dimensions: [String], metrics: [String]) -> some View {
        HStack(spacing: 12) {
            ForEach(Array(dimensions.enumerated()), id: \.offset) { index, text in
                let width = index < spec.dimensions.count ? spec.dimensions[index].width : nil
                Text(text)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .frame(
                        minWidth: width, maxWidth: width ?? .infinity, alignment: .leading
                    )
                    .help(text)
            }
            ForEach(Array(metrics.enumerated()), id: \.offset) { index, text in
                Text(text)
                    .lineLimit(1)
                    .monospacedDigit()
                    .frame(
                        width: index < spec.metrics.count ? spec.metrics[index].width ?? 76 : 76,
                        alignment: .trailing
                    )
            }
        }
        .padding(.horizontal, 20)
    }

    private func footer(shown: Int) -> some View {
        HStack(spacing: 12) {
            Text(
                shown == report.rowCount
                    ? "\(shown) rows"
                    : "\(shown) of \(report.rowCount) rows"
            )
            if report.thresholded {
                Label("Google withheld some low-count rows", systemImage: "eye.slash")
                    .help("Turning off Google signals for the property in Analytics Admin removes this thresholding.")
            }
            Spacer()
            Text("Updated \(report.fetched.formatted(date: .omitted, time: .shortened))")
            Button("Copy Table") { copy(tsv(rows)) }
                .controlSize(.small)
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(.horizontal, 20)
        .padding(.vertical, 6)
    }

    private func tsv(_ rows: [ReportRow]) -> String {
        let header = (spec.dimensions + spec.metrics).map(\.title).joined(separator: "\t")
        let lines = rows.map { row in
            (row.dimensions + row.metrics.map { $0.formatted(.number.grouping(.never)) })
                .joined(separator: "\t")
        }
        return ([header] + lines).joined(separator: "\n")
    }

    private func copy(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
}
