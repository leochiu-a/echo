import SwiftUI

struct TypelessSidebar: View {
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
                navButton(section: .commands, icon: "slash.circle", title: "Commands")
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
