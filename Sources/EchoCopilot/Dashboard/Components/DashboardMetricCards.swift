import SwiftUI

struct FocusMetricCard: View {
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

struct StatTile: View {
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
