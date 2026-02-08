import SwiftUI

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @StateObject private var settingsStore = AppSettingsStore.shared
    @State private var isVisible = false
    @State private var selectedSection: DashboardSection = .home

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
                        if selectedSection != .settings {
                            heroHeader
                        }

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
            viewModel.apply(section: selectedSection)
            withAnimation(.easeOut(duration: 0.45)) {
                isVisible = true
            }
        }
        .onChange(of: selectedSection) { newValue in
            viewModel.apply(section: newValue)
        }
    }

    private var heroHeader: some View {
        let titleFontSize: CGFloat = selectedSection == .settings ? 24 : 28
        let subtitleFontSize: CGFloat = selectedSection == .settings ? 12 : 13

        return HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                Text(selectedSection.title)
                    .font(.system(size: titleFontSize, weight: .bold, design: .rounded))
                Text(selectedSection.subtitle)
                    .font(.system(size: subtitleFontSize, weight: .medium, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)
            }

            Spacer()

            if selectedSection != .settings {
                Button {
                    viewModel.refresh(section: selectedSection)
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderedProminent)
                .tint(DashboardTheme.actionTint)
            }
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.78))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(Color.white.opacity(0.5), lineWidth: 1)
                )
        )
    }

    private var homeContent: some View {
        VStack(spacing: 16) {
            HStack(alignment: .top, spacing: 12) {
                FocusMetricCard(metric: viewModel.snapshot.metrics.first)
                    .frame(maxWidth: .infinity)

                LazyVGrid(columns: metricColumns, spacing: 12) {
                    ForEach(Array(viewModel.snapshot.metrics.dropFirst().prefix(4))) { metric in
                        StatTile(metric: metric)
                    }
                }
                .frame(maxWidth: 520)
            }

            HStack(spacing: 12) {
                PromoCard(
                    title: "Refer Friends",
                    detail: "Fake campaign card for UI preview. Replace with real referral data later.",
                    buttonTitle: "Invite"
                )

                PromoCard(
                    title: "Partner Program",
                    detail: "Fake partnership block for layout testing. Wire real backend event later.",
                    buttonTitle: "Join"
                )
            }

            HStack(alignment: .top, spacing: 12) {
                ActivityPanel(entries: viewModel.snapshot.activities)
                ServicePanel(services: viewModel.snapshot.services)
                UtilizationPanel(points: viewModel.snapshot.workload)
                    .padding(14)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(DashboardTheme.cardBackground)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .strokeBorder(DashboardTheme.cardBorder, lineWidth: 1)
                            )
                    )
                    .frame(width: 280)
            }

            FeedbackPanel()
        }
    }

    private var historyContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Sessions")
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)

            ForEach(viewModel.snapshot.history) { item in
                HStack(spacing: 12) {
                    Circle()
                        .fill(item.statusTint)
                        .frame(width: 10, height: 10)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(item.title)
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .foregroundStyle(DashboardTheme.primaryText)
                        Text(item.detail)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundStyle(DashboardTheme.subtleText)
                    }

                    Spacer()

                    Text(item.time)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(DashboardTheme.subtleText)
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
            Text("設定")
                .font(.system(size: 32, weight: .black, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)

            SettingsSectionHeader(icon: "keyboard", title: "鍵盤快捷鍵")

            SettingsRow(
                title: "叫出輸入框",
                description: "切換浮動輸入框，預設為 Command + K。"
            ) {
                ShortcutRecorderField(
                    shortcut: $settingsStore.openPanelShortcut,
                    defaultShortcut: AppSettingsStore.defaultOpenPanelShortcut
                )
            }

            SettingsRow(
                title: "Replace 功能",
                description: "套用輸出並取代目前選取文字。"
            ) {
                ShortcutRecorderField(
                    shortcut: $settingsStore.replaceShortcut,
                    defaultShortcut: AppSettingsStore.defaultReplaceShortcut
                )
            }

            SettingsRow(
                title: "Insert 功能",
                description: "套用輸出並插入在選取內容旁邊。"
            ) {
                ShortcutRecorderField(
                    shortcut: $settingsStore.insertShortcut,
                    defaultShortcut: AppSettingsStore.defaultInsertShortcut
                )
            }

            SettingsSectionHeader(icon: "cpu", title: "模型")

            SettingsRow(
                title: "Codex 模型",
                description: "從下拉選單選擇執行模型（會帶入 codex exec --model）。"
            ) {
                ModelSelectionField(selection: $settingsStore.codexModel, options: modelOptions)
            }

            HStack {
                Spacer()
                Button("儲存設定") {
                    ensureModelSelectionValid()
                }
                .buttonStyle(.plain)
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
                        ShortcutToken(text: "按下快捷鍵…")
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

            Button {
                shortcut = defaultShortcut
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(DashboardTheme.subtleText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
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

                Text("Preview Data")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)

                Button("View Report") {}
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                Spacer(minLength: 0)

                Label("This dashboard is currently using fake data.", systemImage: "lock")
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

private struct PromoCard: View {
    let title: String
    let detail: String
    let buttonTitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)

            Text(detail)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(DashboardTheme.subtleText)

            Button(buttonTitle) {}
                .buttonStyle(.bordered)
                .controlSize(.small)
        }
        .padding(18)
        .frame(maxWidth: .infinity, minHeight: 148, alignment: .leading)
        .background(
            LinearGradient(
                colors: [Color.white.opacity(0.66), DashboardTheme.accentA.opacity(0.16), DashboardTheme.accentB.opacity(0.12)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 16)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color.white.opacity(0.45), lineWidth: 1)
        )
    }
}

private struct FeedbackPanel: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Feedback")
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Latest Draft")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                    Spacer()
                    Button {} label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(DashboardTheme.subtleText.opacity(0.7))
                    }
                    .buttonStyle(.plain)
                }

                Text("This area is fake content for now. Later we can bind it to actual prompt output history.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.white.opacity(0.7))
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
    }
}

private struct ActivityPanel: View {
    let entries: [DashboardActivity]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Recent Activity")
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)

            ForEach(entries) { entry in
                HStack(spacing: 11) {
                    Circle()
                        .fill(entry.status.tint)
                        .frame(width: 9, height: 9)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.title)
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                        Text(entry.timestamp)
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundStyle(DashboardTheme.subtleText)
                    }
                    Spacer()
                }
                .padding(.vertical, 4)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity)
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

private struct ServicePanel: View {
    let services: [DashboardService]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Service Health")
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)

            ForEach(services) { service in
                VStack(alignment: .leading, spacing: 5) {
                    HStack {
                        Text(service.name)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                        Spacer()
                        Text(service.status.label)
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(service.status.tint.opacity(0.14), in: Capsule())
                            .foregroundStyle(service.status.tint)
                    }
                    ProgressView(value: service.level)
                        .tint(service.status.tint)
                    Text(service.note)
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundStyle(DashboardTheme.subtleText)
                }
                .padding(.vertical, 2)
            }
        }
        .padding(14)
        .frame(width: 300)
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

private struct UtilizationPanel: View {
    let points: [WorkloadPoint]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Pipeline Utilization")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)

            ForEach(points) { point in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(point.label)
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .foregroundStyle(DashboardTheme.subtleText)
                        Spacer()
                        Text("\(Int(point.value * 100))%")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundStyle(DashboardTheme.primaryText)
                    }
                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(Color.white.opacity(0.45))
                            RoundedRectangle(cornerRadius: 5)
                                .fill(
                                    LinearGradient(
                                        colors: [DashboardTheme.accentA, DashboardTheme.accentB],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: proxy.size.width * point.value)
                        }
                    }
                    .frame(height: 9)
                }
            }
        }
    }
}

@MainActor
private final class DashboardViewModel: ObservableObject {
    @Published private(set) var snapshot = DashboardSnapshot.homeLibrary.first ?? .placeholder

    private var homeIndex = 0
    private var historyIndex = 0

    func apply(section: DashboardSection) {
        switch section {
        case .home:
            snapshot = DashboardSnapshot.homeLibrary[homeIndex]
        case .history:
            snapshot = DashboardSnapshot.historyLibrary[historyIndex]
        case .settings:
            break
        }
    }

    func refresh(section: DashboardSection) {
        switch section {
        case .home:
            homeIndex = (homeIndex + 1) % DashboardSnapshot.homeLibrary.count
            snapshot = DashboardSnapshot.homeLibrary[homeIndex]
        case .history:
            historyIndex = (historyIndex + 1) % DashboardSnapshot.historyLibrary.count
            snapshot = DashboardSnapshot.historyLibrary[historyIndex]
        case .settings:
            break
        }
    }
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
        case .home: return "Fake dashboard data for layout and interaction preview."
        case .history: return "Mock event timeline while backend data is not connected."
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

private enum ActivityStatus {
    case success
    case running
    case warning

    var tint: Color {
        switch self {
        case .success: return DashboardTheme.goodTint
        case .running: return DashboardTheme.actionTint
        case .warning: return DashboardTheme.warnTint
        }
    }
}

private struct DashboardActivity: Identifiable {
    let id = UUID()
    let title: String
    let timestamp: String
    let status: ActivityStatus
}

private enum ServiceStatus {
    case healthy
    case warning
    case unstable

    var label: String {
        switch self {
        case .healthy: return "Healthy"
        case .warning: return "Monitor"
        case .unstable: return "Unstable"
        }
    }

    var tint: Color {
        switch self {
        case .healthy: return DashboardTheme.goodTint
        case .warning: return DashboardTheme.accentB
        case .unstable: return DashboardTheme.warnTint
        }
    }
}

private struct DashboardService: Identifiable {
    let id = UUID()
    let name: String
    let level: Double
    let status: ServiceStatus
    let note: String
}

private struct WorkloadPoint: Identifiable {
    let id = UUID()
    let label: String
    let value: Double
}

private struct HistoryRecord: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
    let time: String
    let statusTint: Color
}

private struct DashboardSnapshot {
    let metrics: [DashboardMetric]
    let activities: [DashboardActivity]
    let services: [DashboardService]
    let workload: [WorkloadPoint]
    let history: [HistoryRecord]
}

private extension DashboardSnapshot {
    static let placeholder = DashboardSnapshot(metrics: [], activities: [], services: [], workload: [], history: [])

    static let homeLibrary: [DashboardSnapshot] = [
        DashboardSnapshot(
            metrics: [
                DashboardMetric(title: "Personalization", icon: "scribble.variable", value: "10.7%", trend: "+1.8%", isTrendPositive: true),
                DashboardMetric(title: "Total Dictation", icon: "clock", value: "1h 21m", trend: "+11m", isTrendPositive: true),
                DashboardMetric(title: "Total Words", icon: "mic", value: "7.5K", trend: "+0.9K", isTrendPositive: true),
                DashboardMetric(title: "Saved Time", icon: "hourglass", value: "3h 18m", trend: "+26m", isTrendPositive: true),
                DashboardMetric(title: "Avg WPM", icon: "bolt", value: "138", trend: "-4", isTrendPositive: false)
            ],
            activities: [
                DashboardActivity(title: "Mock rewrite applied in notes", timestamp: "2 min ago", status: .success),
                DashboardActivity(title: "Mock question mode run", timestamp: "6 min ago", status: .running),
                DashboardActivity(title: "Mock clipboard retry", timestamp: "17 min ago", status: .warning),
                DashboardActivity(title: "Mock prompt accepted", timestamp: "27 min ago", status: .success)
            ],
            services: [
                DashboardService(name: "Prompt Runner", level: 0.9, status: .healthy, note: "Fake health for UI preview"),
                DashboardService(name: "Accessibility Bridge", level: 0.74, status: .warning, note: "Fake warning for layout state"),
                DashboardService(name: "Overlay Renderer", level: 0.95, status: .healthy, note: "Fake stable indicator")
            ],
            workload: [
                WorkloadPoint(label: "Rewrite", value: 0.68),
                WorkloadPoint(label: "Q&A", value: 0.57),
                WorkloadPoint(label: "Clipboard", value: 0.31),
                WorkloadPoint(label: "Background", value: 0.46)
            ],
            history: []
        ),
        DashboardSnapshot(
            metrics: [
                DashboardMetric(title: "Personalization", icon: "scribble.variable", value: "12.3%", trend: "+1.1%", isTrendPositive: true),
                DashboardMetric(title: "Total Dictation", icon: "clock", value: "1h 34m", trend: "+13m", isTrendPositive: true),
                DashboardMetric(title: "Total Words", icon: "mic", value: "8.1K", trend: "+0.6K", isTrendPositive: true),
                DashboardMetric(title: "Saved Time", icon: "hourglass", value: "3h 05m", trend: "-13m", isTrendPositive: false),
                DashboardMetric(title: "Avg WPM", icon: "bolt", value: "146", trend: "+8", isTrendPositive: true)
            ],
            activities: [
                DashboardActivity(title: "Mock focused profile enabled", timestamp: "just now", status: .running),
                DashboardActivity(title: "Mock draft inserted to editor", timestamp: "4 min ago", status: .success),
                DashboardActivity(title: "Mock permission lag event", timestamp: "14 min ago", status: .warning),
                DashboardActivity(title: "Mock question mode copied", timestamp: "21 min ago", status: .success)
            ],
            services: [
                DashboardService(name: "Prompt Runner", level: 0.82, status: .warning, note: "Fake queue pressure"),
                DashboardService(name: "Accessibility Bridge", level: 0.68, status: .unstable, note: "Fake unstable condition"),
                DashboardService(name: "Overlay Renderer", level: 0.92, status: .healthy, note: "Fake smooth rendering")
            ],
            workload: [
                WorkloadPoint(label: "Rewrite", value: 0.73),
                WorkloadPoint(label: "Q&A", value: 0.52),
                WorkloadPoint(label: "Clipboard", value: 0.4),
                WorkloadPoint(label: "Background", value: 0.55)
            ],
            history: []
        )
    ]

    static let historyLibrary: [DashboardSnapshot] = [
        DashboardSnapshot(
            metrics: homeLibrary[0].metrics,
            activities: homeLibrary[0].activities,
            services: homeLibrary[0].services,
            workload: homeLibrary[0].workload,
            history: [
                HistoryRecord(title: "Edit selection", detail: "Mock output inserted in Xcode.", time: "10:42", statusTint: DashboardTheme.goodTint),
                HistoryRecord(title: "Ask question", detail: "Mock answer copied to clipboard.", time: "10:31", statusTint: DashboardTheme.actionTint),
                HistoryRecord(title: "Rewrite paragraph", detail: "Mock run stopped by user.", time: "10:09", statusTint: DashboardTheme.warnTint),
                HistoryRecord(title: "Prompt retry", detail: "Mock second attempt succeeded.", time: "09:58", statusTint: DashboardTheme.goodTint)
            ]
        ),
        DashboardSnapshot(
            metrics: homeLibrary[1].metrics,
            activities: homeLibrary[1].activities,
            services: homeLibrary[1].services,
            workload: homeLibrary[1].workload,
            history: [
                HistoryRecord(title: "Prompt from dashboard", detail: "Mock inline panel opened.", time: "11:12", statusTint: DashboardTheme.actionTint),
                HistoryRecord(title: "Replace output", detail: "Mock replacement sent to active app.", time: "10:56", statusTint: DashboardTheme.goodTint),
                HistoryRecord(title: "Fallback mode", detail: "Mock fallback path used once.", time: "10:21", statusTint: DashboardTheme.warnTint),
                HistoryRecord(title: "History up/down", detail: "Mock command recall interaction.", time: "09:40", statusTint: DashboardTheme.goodTint)
            ]
        )
    ]
}
