import SwiftUI

struct DashboardHistorySection: View {
    @ObservedObject var historyStore: PromptHistoryStore
    @State private var showClearHistoryConfirmation = false
    @State private var selectedResponseEntry: PromptHistoryEntry?

    var body: some View {
        let items = Array(historyStore.entries.prefix(60))

        VStack(alignment: .leading, spacing: 20) {
            DashboardSectionHeading(section: .history)
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
                emptyStatePanel
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
                                Button {
                                    selectedResponseEntry = item
                                } label: {
                                    Text(responsePreview)
                                        .font(.system(size: 12, weight: .regular, design: .monospaced))
                                        .foregroundStyle(DashboardTheme.primaryText.opacity(0.9))
                                        .lineLimit(4)
                                        .frame(maxWidth: .infinity, alignment: .leading)
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
                                .buttonStyle(.plain)
                                .pointerOnHover()
                            }
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 8) {
                            Text(formattedHistoryTime(item.createdAt))
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundStyle(DashboardTheme.subtleText)

                            if historyResponseText(for: item) != nil {
                                Button {
                                    selectedResponseEntry = item
                                } label: {
                                    Image(systemName: "doc.text.magnifyingglass")
                                        .font(.system(size: 12, weight: .semibold))
                                }
                                .buttonStyle(.plain)
                                .foregroundStyle(DashboardTheme.subtleText)
                                .help("View full response")
                                .pointerOnHover()
                            }

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
        .sheet(item: $selectedResponseEntry) { item in
            HistoryResponseSheet(
                command: item.command,
                createdAt: item.createdAt,
                responseText: historyResponseText(for: item) ?? "No response text."
            )
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

    private var emptyStatePanel: some View {
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
    }

    private func historyDetail(for item: PromptHistoryEntry) -> String {
        let actionLabel = item.action.title(hasSelection: item.usedSelectionContext)
        return "\(actionLabel) • \(item.status.label) • \(item.detail)"
    }

    private func historyResponsePreview(for item: PromptHistoryEntry) -> String? {
        guard let response = historyResponseText(for: item) else { return nil }
        if response.count <= 360 {
            return response
        }
        return "\(response.prefix(357))..."
    }

    private func historyResponseText(for item: PromptHistoryEntry) -> String? {
        guard item.status == .succeeded else { return nil }
        guard let response = item.responseText?.trimmingCharacters(in: .whitespacesAndNewlines), !response.isEmpty else {
            return nil
        }
        return response
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
}

private struct HistoryResponseSheet: View {
    let command: String
    let createdAt: Date
    let responseText: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Full Response")
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                    Text(command)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(DashboardTheme.subtleText)
                        .lineLimit(1)
                }

                Spacer()

                Text(timestamp(createdAt))
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)
            }

            ScrollView {
                Text(responseText)
                    .font(.system(size: 12, weight: .regular, design: .monospaced))
                    .foregroundStyle(DashboardTheme.primaryText)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
            }
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.white.opacity(0.72))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(Color.black.opacity(0.08), lineWidth: 1)
                    )
            )

            HStack {
                Spacer()
                Button("Close") {
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .tint(DashboardTheme.actionTint)
            }
        }
        .padding(16)
        .frame(minWidth: 720, minHeight: 460)
        .background(Color.white)
        .environment(\.colorScheme, .light)
    }

    private func timestamp(_ date: Date) -> String {
        Self.formatter.string(from: date)
    }

    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}
