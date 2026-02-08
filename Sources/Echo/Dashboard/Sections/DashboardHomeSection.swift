import SwiftUI

struct DashboardHomeSection: View {
    @ObservedObject var historyStore: PromptHistoryStore
    @ObservedObject var codexUsageViewModel: CodexMonthlyUsageViewModel
    @State private var loadingDotCount = 0

    private let metricColumns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            DashboardSectionHeading(section: .home)

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
            if !(codexUsageViewModel.isLoading && codexUsageViewModel.monthlyUsages.isEmpty) {
                HStack(alignment: .center, spacing: 12) {
                    if let totalCostUSD = codexUsageViewModel.totalCostUSD {
                        Text("Total Cost USD \(formattedUSDCost(totalCostUSD))")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundStyle(DashboardTheme.primaryText)
                    }
                    Spacer()
                    Button {
                        codexUsageViewModel.refresh()
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .disabled(codexUsageViewModel.isLoading)
                    .pointerOnHover()
                    if let updatedAt = codexUsageViewModel.lastUpdatedAt {
                        Text("Updated \(Self.codexUsageUpdateTimeFormatter.string(from: updatedAt))")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundStyle(DashboardTheme.subtleText)
                            .multilineTextAlignment(.trailing)
                    }
                }
            }

            if codexUsageViewModel.isLoading && codexUsageViewModel.monthlyUsages.isEmpty {
                HStack(alignment: .center, spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Loading Codex usage\(String(repeating: ".", count: loadingDotCount))")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundStyle(DashboardTheme.subtleText)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 6)
                .onAppear {
                    loadingDotCount = 0
                }
                .onReceive(Self.loadingDotsTimer) { _ in
                    loadingDotCount = (loadingDotCount + 1) % 4
                }
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

    private static let loadingDotsTimer = Timer.publish(
        every: 0.35,
        on: .main,
        in: .common
    ).autoconnect()
}
