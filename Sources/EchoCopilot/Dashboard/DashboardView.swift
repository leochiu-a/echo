import AppKit
import SwiftUI

struct DashboardView: View {
    @StateObject private var settingsStore = AppSettingsStore.shared
    @StateObject private var historyStore = PromptHistoryStore.shared
    @StateObject private var codexUsageViewModel = CodexMonthlyUsageViewModel()
    @State private var isVisible = false
    @State private var selectedSection: DashboardSection = .home
    @State private var showClearHistoryConfirmation = false

    private let metricColumns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        ZStack {
            backgroundLayer

            HStack(alignment: .top, spacing: 14) {
                TypelessSidebar(selectedSection: $selectedSection)
                .frame(width: 252)
                .opacity(isVisible ? 1 : 0)
                .offset(x: isVisible ? 0 : -12)
                .animation(.spring(response: 0.42, dampingFraction: 0.84), value: isVisible)

                ScrollView {
                    VStack(spacing: 16) {
                        switch selectedSection {
                        case .home:
                            homeContent
                        case .history:
                            historyContent
                        case .settings:
                            settingsContent
                        }
                    }
                    .padding(20)
                }
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(DashboardTheme.contentBackground)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .strokeBorder(DashboardTheme.contentBorder, lineWidth: 1)
                        )
                )
            }
            .padding(12)
        }
        .frame(minWidth: 1220, minHeight: 760)
        .onAppear {
            codexUsageViewModel.refresh()
            withAnimation(.easeOut(duration: 0.45)) {
                isVisible = true
            }
        }
        .onChange(of: selectedSection) { newValue in
            if newValue == .home, codexUsageViewModel.monthlyUsages.isEmpty {
                codexUsageViewModel.refresh()
            }
        }
    }

    private var homeContent: some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionHeading(for: .home)

            SettingsSectionHeader(icon: "chart.bar.xaxis", title: "Overview")

            HStack(alignment: .top, spacing: 12) {
                FocusMetricCard(metric: homeMetrics.first)
                    .frame(maxWidth: .infinity)

                LazyVGrid(columns: metricColumns, spacing: 12) {
                    ForEach(Array(homeMetrics.dropFirst().prefix(4))) { metric in
                        StatTile(metric: metric)
                    }
                }
                .frame(maxWidth: 520)
            }

            SettingsSectionHeader(icon: "calendar", title: "Codex Monthly Usage")
            codexMonthlyUsagePanel
        }
    }

    private var historyContent: some View {
        let items = Array(historyStore.entries.prefix(60))

        return VStack(alignment: .leading, spacing: 20) {
            sectionHeading(for: .history)
            SettingsSectionHeader(icon: "clock.arrow.circlepath", title: "Recent Sessions")
            historyInfoPanel

            if !items.isEmpty {
                HStack(spacing: 12) {
                    Text("\(items.count) records")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(DashboardTheme.subtleText)
                    Spacer()
                    Button(role: .destructive) {
                        showClearHistoryConfirmation = true
                    } label: {
                        Label("Clear All", systemImage: "trash")
                    }
                    .buttonStyle(.bordered)
                    .pointerOnHover()
                }
                .confirmationDialog(
                    "Delete all history records?",
                    isPresented: $showClearHistoryConfirmation,
                    titleVisibility: .visible
                ) {
                    Button("Delete All", role: .destructive) {
                        historyStore.clear()
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("This action cannot be undone.")
                }
            }

            if items.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text("No history yet")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(DashboardTheme.primaryText)
                    Text("Run a prompt from the inline panel and completed sessions will appear here.")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundStyle(DashboardTheme.subtleText)
                    Button {
                        NotificationCenter.default.post(name: .dashboardRequestOpenPrompt, object: nil)
                    } label: {
                        Label("Open Prompt Panel", systemImage: "command.circle")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(DashboardTheme.actionTint)
                    .pointerOnHover()
                }
                .padding(14)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(DashboardTheme.cardBackground)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .strokeBorder(DashboardTheme.cardBorder, lineWidth: 1)
                        )
                )
            } else {
                ForEach(items) { item in
                    HStack(alignment: .top, spacing: 12) {
                        Circle()
                            .fill(tint(for: item.status))
                            .frame(width: 10, height: 10)
                            .padding(.top, 4)

                        VStack(alignment: .leading, spacing: 6) {
                            Text(item.command)
                                .font(.system(size: 14, weight: .semibold, design: .rounded))
                                .foregroundStyle(DashboardTheme.primaryText)
                                .lineLimit(1)
                            Text(historyDetail(for: item))
                                .font(.system(size: 12, weight: .medium, design: .rounded))
                                .foregroundStyle(DashboardTheme.subtleText)
                                .lineLimit(2)
                            if let responsePreview = historyResponsePreview(for: item) {
                                Text(responsePreview)
                                    .font(.system(size: 12, weight: .regular, design: .monospaced))
                                    .foregroundStyle(DashboardTheme.primaryText.opacity(0.9))
                                    .lineLimit(4)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 8)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color.white.opacity(0.62))
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 8)
                                                    .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
                                            )
                                    )
                            }
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 8) {
                            Text(formattedHistoryTime(item.createdAt))
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundStyle(DashboardTheme.subtleText)

                            Button(role: .destructive) {
                                historyStore.deleteEntry(id: item.id)
                            } label: {
                                Image(systemName: "trash")
                                    .font(.system(size: 12, weight: .semibold))
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(DashboardTheme.subtleText)
                            .pointerOnHover()
                        }
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(DashboardTheme.cardBackground)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(DashboardTheme.cardBorder, lineWidth: 1)
                            )
                    )
                }
            }
        }
    }

    private var historyInfoPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                HistoryInfoRow(
                    icon: "internaldrive",
                    title: "History Retention",
                    description: "Records older than the selected duration are automatically removed."
                )
                Spacer(minLength: 12)
                historyRetentionMenu
            }

            Rectangle()
                .fill(Color.black.opacity(0.08))
                .frame(height: 1)
                .padding(.vertical, 10)

            HistoryInfoRow(
                icon: "lock",
                title: "Data and Privacy",
                description: "Your prompt is sent to Codex during execution to generate responses; this page only shows locally stored records."
            )
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(DashboardTheme.cardBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .strokeBorder(DashboardTheme.cardBorder, lineWidth: 1)
                )
        )
    }

    private var historyRetentionMenu: some View {
        Menu {
            ForEach(PromptHistoryRetentionPolicy.allCases) { policy in
                Button {
                    historyStore.retentionPolicy = policy
                } label: {
                    HStack {
                        Text(policy.title)
                        Spacer()
                        if historyStore.retentionPolicy == policy {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 8) {
                Text(historyStore.retentionPolicy.title)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(DashboardTheme.primaryText)
                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(DashboardTheme.subtleText)
            }
            .padding(.horizontal, 10)
            .frame(minWidth: 110, minHeight: 34)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.white.opacity(0.6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(Color.black.opacity(0.09), lineWidth: 1)
                    )
            )
            .contentShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
        .pointerOnHover()
    }

    private var homeMetrics: [DashboardMetric] {
        let summary = historyStore.tokenSummary
        return [
            DashboardMetric(
                title: "Total Tokens",
                icon: "sum",
                value: formattedTokenCount(summary.totalTokens),
                trend: "All recorded token usage",
                isTrendPositive: true
            ),
            DashboardMetric(
                title: "Input Tokens",
                icon: "tray.and.arrow.down",
                value: formattedTokenCount(summary.totalInputTokens),
                trend: "Prompt/input token total",
                isTrendPositive: true
            ),
            DashboardMetric(
                title: "Output Tokens",
                icon: "tray.and.arrow.up",
                value: formattedTokenCount(summary.totalOutputTokens),
                trend: "Completion/output token total",
                isTrendPositive: true
            )
        ]
    }

    private var codexMonthlyUsagePanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                if let totalCostUSD = codexUsageViewModel.totalCostUSD {
                    Text("Total Cost USD \(formattedUSDCost(totalCostUSD))")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(DashboardTheme.primaryText)
                }
                Spacer()
                if let updatedAt = codexUsageViewModel.lastUpdatedAt {
                    Text("Updated \(Self.codexUsageUpdateTimeFormatter.string(from: updatedAt))")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(DashboardTheme.subtleText)
                }
                Button {
                    codexUsageViewModel.refresh()
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(codexUsageViewModel.isLoading)
                .pointerOnHover()
            }

            if codexUsageViewModel.isLoading && codexUsageViewModel.monthlyUsages.isEmpty {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Loading monthly Codex usage...")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundStyle(DashboardTheme.subtleText)
                }
                .padding(.vertical, 6)
            } else if let error = codexUsageViewModel.errorText {
                Text(error)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(DashboardTheme.warnTint)
                    .fixedSize(horizontal: false, vertical: true)
            } else if codexUsageViewModel.monthlyUsages.isEmpty {
                Text("No monthly usage data.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)
            } else {
                ForEach(codexUsageViewModel.monthlyUsages) { usage in
                    HStack(alignment: .center, spacing: 12) {
                        Text(usage.month)
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundStyle(DashboardTheme.primaryText)
                            .frame(width: 98, alignment: .leading)

                        HStack(spacing: 14) {
                            codexUsageMetricLabel(title: "Total", value: formattedTokenCount(usage.totalTokens))
                            codexUsageMetricLabel(title: "Input", value: formattedTokenCount(usage.inputTokens))
                            codexUsageMetricLabel(title: "Output", value: formattedTokenCount(usage.outputTokens))
                            if let costUSD = usage.costUSD {
                                codexUsageMetricLabel(title: "Cost USD", value: formattedUSDCost(costUSD))
                            }
                        }

                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(DashboardTheme.cardBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .strokeBorder(DashboardTheme.cardBorder, lineWidth: 1)
                )
        )
    }

    private func codexUsageMetricLabel(title: String, value: String) -> some View {
        HStack(spacing: 6) {
            Text(title)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(DashboardTheme.subtleText)
            Text(value)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)
        }
    }

    private func formattedTokenCount(_ value: Int) -> String {
        Self.tokenCountFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private static let tokenCountFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    private func formattedUSDCost(_ value: Double) -> String {
        Self.usdCurrencyFormatter.string(from: NSNumber(value: value)) ?? String(format: "$%.2f", value)
    }

    private static let usdCurrencyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.locale = Locale(identifier: "en_US")
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    private static let codexUsageUpdateTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }()

    private func sectionHeading(for section: DashboardSection) -> some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(section == .home ? "Home" : section.title)
                    .font(.system(size: 32, weight: .black, design: .rounded))
                    .foregroundStyle(DashboardTheme.primaryText)
                Text(section.subtitle)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)
            }

            Spacer()
        }
    }

    private func historyDetail(for item: PromptHistoryEntry) -> String {
        let actionLabel = item.action.title(hasSelection: item.usedSelectionContext)
        return "\(actionLabel) • \(item.status.label) • \(item.detail)"
    }

    private func historyResponsePreview(for item: PromptHistoryEntry) -> String? {
        guard item.status == .succeeded else { return nil }
        guard let response = item.responseText?.trimmingCharacters(in: .whitespacesAndNewlines), !response.isEmpty else {
            return nil
        }
        if response.count <= 360 {
            return response
        }
        return "\(response.prefix(357))..."
    }

    private func tint(for status: PromptHistoryStatus) -> Color {
        switch status {
        case .succeeded:
            return DashboardTheme.goodTint
        case .failed:
            return DashboardTheme.warnTint
        case .cancelled:
            return DashboardTheme.accentB
        }
    }

    private func formattedHistoryTime(_ date: Date) -> String {
        let age = Date().timeIntervalSince(date)
        if age < 86_400 {
            return Self.recentHistoryFormatter.localizedString(for: date, relativeTo: Date())
        }
        return Self.olderHistoryFormatter.string(from: date)
    }

    private static let recentHistoryFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter
    }()

    private static let olderHistoryFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }()

    private var settingsContent: some View {
        SettingsPanel(settingsStore: settingsStore)
    }

    private var backgroundLayer: some View {
        ZStack {
            LinearGradient(
                colors: DashboardTheme.backgroundGradient,
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Circle()
                .fill(DashboardTheme.accentA.opacity(0.22))
                .frame(width: 380, height: 380)
                .offset(x: -420, y: -250)
            Circle()
                .fill(DashboardTheme.accentB.opacity(0.18))
                .frame(width: 320, height: 320)
                .offset(x: 480, y: -290)
            Circle()
                .fill(DashboardTheme.accentC.opacity(0.16))
                .frame(width: 280, height: 280)
                .offset(x: 430, y: 260)
        }
        .ignoresSafeArea()
    }

}

private struct TypelessSidebar: View {
    @Binding var selectedSection: DashboardSection
    @State private var hoveredSection: DashboardSection?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: "waveform.path.ecg")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(DashboardTheme.sidebarPrimary)

                Text("Echo")
                    .font(.system(size: 38, weight: .black, design: .rounded))
                    .tracking(-0.8)
                    .foregroundStyle(DashboardTheme.sidebarPrimary)
            }
            .padding(.top, 4)

            VStack(spacing: 8) {
                navButton(section: .home, icon: "house", title: "Home")
                navButton(section: .history, icon: "clock.arrow.circlepath", title: "History")
                navButton(section: .settings, icon: "gearshape", title: "Settings")
            }

            Spacer()
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18)
                .fill(DashboardTheme.sidebarBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 18)
                        .strokeBorder(DashboardTheme.sidebarBorder, lineWidth: 1)
                )
        )
    }

    private func navButton(section: DashboardSection, icon: String, title: String) -> some View {
        Button {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                selectedSection = section
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                Text(title)
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                Spacer()
            }
            .frame(maxWidth: .infinity, minHeight: 46, alignment: .leading)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(backgroundColor(for: section))
            )
            .foregroundStyle(selectedSection == section ? DashboardTheme.sidebarPrimary : DashboardTheme.subtleText)
            .contentShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
        .pointerOnHover()
        .onHover { isHovered in
            withAnimation(.easeOut(duration: 0.12)) {
                hoveredSection = isHovered ? section : nil
            }
        }
    }

    private func backgroundColor(for section: DashboardSection) -> Color {
        if selectedSection == section {
            return DashboardTheme.sidebarActive
        }
        if hoveredSection == section {
            return DashboardTheme.sidebarHover
        }
        return .clear
    }
}

private struct SettingsPanel: View {
    @ObservedObject var settingsStore: AppSettingsStore
    private let modelOptions = AppSettingsStore.supportedCodexModels

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Settings")
                .font(.system(size: 32, weight: .black, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)

            SettingsSectionHeader(icon: "keyboard", title: "Keyboard Shortcuts")

            SettingsRow(
                title: "Open Input Panel",
                description: "Toggle the floating input panel. Default: Command + K."
            ) {
                ShortcutRecorderField(
                    shortcut: $settingsStore.openPanelShortcut,
                    defaultShortcut: AppSettingsStore.defaultOpenPanelShortcut
                )
            }

            SettingsRow(
                title: "Replace Action",
                description: "Apply output by replacing the current selection."
            ) {
                ShortcutRecorderField(
                    shortcut: $settingsStore.replaceShortcut,
                    defaultShortcut: AppSettingsStore.defaultReplaceShortcut
                )
            }

            SettingsRow(
                title: "Insert Action",
                description: "Apply output by inserting next to the current selection."
            ) {
                ShortcutRecorderField(
                    shortcut: $settingsStore.insertShortcut,
                    defaultShortcut: AppSettingsStore.defaultInsertShortcut
                )
            }

            SettingsSectionHeader(icon: "cpu", title: "Model")

            SettingsRow(
                title: "Codex Model",
                description: "Select the execution model (passed to codex exec --model)."
            ) {
                ModelSelectionField(selection: $settingsStore.codexModel, options: modelOptions)
            }

            HStack {
                Spacer()
                Button("Save Settings") {
                    ensureModelSelectionValid()
                }
                .buttonStyle(.plain)
                .pointerOnHover()
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.white.opacity(0.96))
                .padding(.horizontal, 22)
                .padding(.vertical, 12)
                .background(
                    Capsule()
                        .fill(DashboardTheme.actionTint)
                        .overlay(
                            Capsule()
                                .strokeBorder(Color.black.opacity(0.08), lineWidth: 1)
                        )
                )
                .shadow(color: DashboardTheme.actionTint.opacity(0.25), radius: 8, x: 0, y: 3)
            }
        }
        .padding(.top, 4)
        .onAppear {
            ensureModelSelectionValid()
        }
    }

    private func ensureModelSelectionValid() {
        guard modelOptions.contains(settingsStore.codexModel) else {
            settingsStore.codexModel = AppSettingsStore.defaultCodexModel
            return
        }
    }
}

private struct SettingsSectionHeader: View {
    let icon: String
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(DashboardTheme.subtleText)
                Text(title)
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)
            }
            Rectangle()
                .fill(Color.black.opacity(0.07))
                .frame(height: 1)
        }
    }
}

private struct HistoryInfoRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon)
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)

            Text(description)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(DashboardTheme.subtleText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct ModelSelectionField: View {
    @Binding var selection: String
    let options: [String]

    @State private var isHovered = false

    var body: some View {
        Menu {
            ForEach(options, id: \.self) { model in
                Button {
                    selection = model
                } label: {
                    HStack {
                        Text(model)
                        Spacer()
                        if selection == model {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 10) {
                Text(selection)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(DashboardTheme.primaryText)
                Spacer(minLength: 0)
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(DashboardTheme.subtleText)
            }
            .padding(.horizontal, 14)
            .frame(width: 390, height: 56)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(isHovered ? 0.82 : 0.72))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .strokeBorder(
                                isHovered ? DashboardTheme.actionTint.opacity(0.35) : Color.black.opacity(0.08),
                                lineWidth: 1
                            )
                    )
            )
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .pointerOnHover()
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.12)) {
                isHovered = hovering
            }
        }
    }
}

private struct SettingsRow<Control: View>: View {
    let title: String
    let description: String
    @ViewBuilder let control: () -> Control

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(DashboardTheme.primaryText)
                Text(description)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            control()
        }
    }
}

private struct ShortcutRecorderField: View {
    @Binding var shortcut: KeyboardShortcut
    let defaultShortcut: KeyboardShortcut

    @State private var isRecording = false
    @State private var eventMonitor: Any?

    var body: some View {
        HStack(spacing: 10) {
            Button {
                toggleRecording()
            } label: {
                HStack(spacing: 8) {
                    if isRecording {
                        ShortcutToken(text: "Press shortcut...")
                    } else {
                        ForEach(shortcut.displayTokens, id: \.self) { token in
                            ShortcutToken(text: token)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .frame(width: 320, height: 56, alignment: .leading)
                .padding(.horizontal, 10)
            }
            .buttonStyle(.plain)
            .pointerOnHover()

            Button {
                shortcut = defaultShortcut
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(DashboardTheme.subtleText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .pointerOnHover()
        }
        .padding(.horizontal, 10)
        .frame(width: 390, height: 56)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.65))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(
                            isRecording ? DashboardTheme.actionTint.opacity(0.35) : Color.black.opacity(0.08),
                            lineWidth: isRecording ? 1.5 : 1
                        )
                )
        )
        .onDisappear {
            stopRecording()
        }
    }

    private func toggleRecording() {
        isRecording ? stopRecording() : startRecording()
    }

    private func startRecording() {
        stopRecording()
        isRecording = true
        eventMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown]) { event in
            if event.keyCode == 53 {
                stopRecording()
                return nil
            }

            let modifiers = event.modifierFlags.normalizedShortcutModifiers
            guard !modifiers.isEmpty else {
                NSSound.beep()
                return nil
            }

            shortcut = KeyboardShortcut(keyCode: event.keyCode, modifiers: modifiers)
            stopRecording()
            return nil
        }
    }

    private func stopRecording() {
        isRecording = false
        if let eventMonitor {
            NSEvent.removeMonitor(eventMonitor)
            self.eventMonitor = nil
        }
    }
}

private struct ShortcutToken: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .foregroundStyle(DashboardTheme.primaryText)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(0.68))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Color.black.opacity(0.09), lineWidth: 1)
                    )
            )
    }
}

private struct FocusMetricCard: View {
    let metric: DashboardMetric?

    var body: some View {
        HStack(spacing: 18) {
            VStack(alignment: .leading, spacing: 10) {
                Label(metric?.title ?? "No Data", systemImage: metric?.icon ?? "chart.pie")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)

                Text(metric?.value ?? "--")
                    .font(.system(size: 44, weight: .heavy, design: .rounded))
                    .foregroundStyle(DashboardTheme.primaryText)

                Text(metric?.trend ?? "No token usage found yet.")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)

                Spacer(minLength: 0)

                Label("Computed from locally stored history.", systemImage: "internaldrive")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.52), lineWidth: 17)

                Circle()
                    .trim(from: 0, to: 0.22)
                    .stroke(
                        AngularGradient(colors: [DashboardTheme.accentA, DashboardTheme.accentB], center: .center),
                        style: StrokeStyle(lineWidth: 17, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))

                Text(metric?.value ?? "--")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(DashboardTheme.primaryText)
            }
            .frame(width: 174, height: 174)
        }
        .padding(14)
        .frame(height: 220)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(DashboardTheme.cardBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .strokeBorder(DashboardTheme.cardBorder, lineWidth: 1)
                )
        )
    }
}

private struct StatTile: View {
    let metric: DashboardMetric

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(metric.title, systemImage: metric.icon)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)
                Spacer()
            }

            Text(metric.value)
                .font(.system(size: 36, weight: .heavy, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)

            Text(metric.trend)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(metric.isTrendPositive ? DashboardTheme.goodTint : DashboardTheme.warnTint)
        }
        .padding(14)
        .frame(minHeight: 104, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(DashboardTheme.cardBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .strokeBorder(DashboardTheme.cardBorder, lineWidth: 1)
                )
        )
        .shadow(color: Color.black.opacity(0.04), radius: 8, y: 4)
    }
}

@MainActor
private final class CodexMonthlyUsageViewModel: ObservableObject {
    @Published private(set) var monthlyUsages: [CodexMonthlyUsage] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorText: String?
    @Published private(set) var lastUpdatedAt: Date?
    @Published private(set) var totalCostUSD: Double?

    private var runningTask: Task<Void, Never>?

    deinit {
        runningTask?.cancel()
    }

    func refresh() {
        guard !isLoading else { return }
        isLoading = true
        errorText = nil

        runningTask?.cancel()
        runningTask = Task { [weak self] in
            guard let self else { return }
            defer {
                isLoading = false
                runningTask = nil
            }

            do {
                let report = try await fetchCodexMonthlyUsageReport()
                guard !Task.isCancelled else { return }
                monthlyUsages = report.monthly
                totalCostUSD = report.totals?.costUSD
                lastUpdatedAt = Date()
            } catch is CancellationError {
                return
            } catch {
                errorText = summarizeCodexUsageError(error)
            }
        }
    }
}

private struct CodexMonthlyUsage: Codable, Equatable, Identifiable {
    let month: String
    let inputTokens: Int
    let outputTokens: Int
    let totalTokens: Int
    let costUSD: Double?

    var id: String { month }
}

private struct CodexMonthlyUsageTotals: Codable, Equatable {
    let costUSD: Double?
}

private struct CodexMonthlyUsageReport: Codable, Equatable {
    let monthly: [CodexMonthlyUsage]
    let totals: CodexMonthlyUsageTotals?
}

private func fetchCodexMonthlyUsageReport(timeout: TimeInterval = 35) async throws -> CodexMonthlyUsageReport {
    let process = Process()
    let stdoutPipe = Pipe()
    let stderrPipe = Pipe()

    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = [
        "npx",
        "--yes",
        "@ccusage/codex@latest",
        "monthly",
        "--json"
    ]
    process.environment = enrichedEnvironment()
    process.standardOutput = stdoutPipe
    process.standardError = stderrPipe

    do {
        try process.run()
    } catch {
        throw NSError(
            domain: "CodexMonthlyUsage",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Failed to run npx: \(error.localizedDescription)"]
        )
    }

    let deadline = Date().addingTimeInterval(timeout)
    while process.isRunning {
        if Task.isCancelled {
            process.terminate()
            throw CancellationError()
        }
        if Date() >= deadline {
            process.terminate()
            throw NSError(
                domain: "CodexMonthlyUsage",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Loading Codex usage timed out."]
            )
        }
        try await Task.sleep(nanoseconds: 50_000_000)
    }

    let stdout = String(data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    let stderr = String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    let normalizedStdout = normalizeOutput(stdout)
    let normalizedStderr = normalizeOutput(stderr)

    guard process.terminationStatus == 0 else {
        let detail = normalizedStderr.isEmpty
            ? "npx command failed with exit code \(process.terminationStatus)."
            : normalizedStderr
        throw NSError(
            domain: "CodexMonthlyUsage",
            code: Int(process.terminationStatus),
            userInfo: [NSLocalizedDescriptionKey: detail]
        )
    }

    guard let data = normalizedStdout.data(using: .utf8), !data.isEmpty else {
        throw NSError(
            domain: "CodexMonthlyUsage",
            code: 3,
            userInfo: [NSLocalizedDescriptionKey: "No JSON output from Codex usage command."]
        )
    }

    do {
        return try JSONDecoder().decode(CodexMonthlyUsageReport.self, from: data)
    } catch {
        throw NSError(
            domain: "CodexMonthlyUsage",
            code: 4,
            userInfo: [NSLocalizedDescriptionKey: "Unable to parse Codex usage JSON."]
        )
    }
}

private func summarizeCodexUsageError(_ error: Error) -> String {
    let message = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
    if message.isEmpty {
        return "Failed to load Codex monthly usage."
    }
    if message.count <= 180 {
        return message
    }
    return "\(message.prefix(177))..."
}

private enum DashboardSection: String, CaseIterable, Identifiable {
    case home
    case history
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "Speak naturally, write perfectly"
        case .history: return "History records"
        case .settings: return "Settings"
        }
    }

    var subtitle: String {
        switch self {
        case .home: return "Live token usage summary from your locally stored prompt history."
        case .history: return "Recent prompt runs, with status and timestamps."
        case .settings: return "Configure model and shortcuts for input, replace, and insert actions."
        }
    }
}

private struct DashboardTheme {
    static let primaryText = Color(red: 0.13, green: 0.2, blue: 0.24)
    static let subtleText = Color(red: 0.31, green: 0.38, blue: 0.43)
    static let actionTint = Color(red: 0.05, green: 0.48, blue: 0.56)
    static let goodTint = Color(red: 0.05, green: 0.54, blue: 0.32)
    static let warnTint = Color(red: 0.77, green: 0.31, blue: 0.18)
    static let accentA = Color(red: 0.15, green: 0.58, blue: 0.67)
    static let accentB = Color(red: 0.94, green: 0.62, blue: 0.3)
    static let accentC = Color(red: 0.35, green: 0.72, blue: 0.55)

    static let contentBackground = Color.white.opacity(0.62)
    static let contentBorder = Color.white.opacity(0.48)
    static let cardBackground = Color.white.opacity(0.78)
    static let cardBorder = Color.white.opacity(0.46)

    static let sidebarBackground = Color.white.opacity(0.7)
    static let sidebarCard = Color.white.opacity(0.74)
    static let sidebarBorder = Color.white.opacity(0.5)
    static let sidebarActive = Color.black.opacity(0.08)
    static let sidebarHover = Color.black.opacity(0.045)
    static let sidebarPrimary = Color.black.opacity(0.88)

    static let backgroundGradient = [
        Color(red: 0.95, green: 0.98, blue: 0.99),
        Color(red: 0.9, green: 0.95, blue: 0.97),
        Color(red: 0.95, green: 0.92, blue: 0.88)
    ]
}

private struct DashboardMetric: Identifiable {
    let title: String
    let icon: String
    let value: String
    let trend: String
    let isTrendPositive: Bool

    var id: String { title }
}

private struct PointerOnHoverModifier: ViewModifier {
    @State private var isHovering = false

    func body(content: Content) -> some View {
        content
            .onHover { hovering in
                guard hovering != isHovering else { return }
                isHovering = hovering
                if hovering {
                    NSCursor.pointingHand.push()
                } else {
                    NSCursor.pop()
                }
            }
            .onDisappear {
                if isHovering {
                    NSCursor.pop()
                    isHovering = false
                }
            }
    }
}

private extension View {
    func pointerOnHover() -> some View {
        modifier(PointerOnHoverModifier())
    }
}
