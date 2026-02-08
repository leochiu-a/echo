import SwiftUI

struct DashboardView: View {
    @StateObject private var settingsStore = AppSettingsStore.shared
    @StateObject private var historyStore = PromptHistoryStore.shared
    @StateObject private var codexUsageViewModel = CodexMonthlyUsageViewModel()
    @State private var isVisible = false
    @State private var selectedSection: DashboardSection = .home

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
                            DashboardHomeSection(
                                historyStore: historyStore,
                                codexUsageViewModel: codexUsageViewModel
                            )
                        case .history:
                            DashboardHistorySection(historyStore: historyStore)
                        case .settings:
                            DashboardSettingsSection(settingsStore: settingsStore)
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
