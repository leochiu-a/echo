import SwiftUI

struct DashboardSectionHeading: View {
    let section: DashboardSection

    var body: some View {
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
}

struct SettingsSectionHeader: View {
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

struct HistoryInfoRow: View {
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
