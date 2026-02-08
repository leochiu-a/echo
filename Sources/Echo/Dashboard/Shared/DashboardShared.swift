import AppKit
import SwiftUI

enum DashboardSection: String, CaseIterable, Identifiable {
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

struct DashboardTheme {
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

struct DashboardMetric: Identifiable {
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

extension View {
    func pointerOnHover() -> some View {
        modifier(PointerOnHoverModifier())
    }
}
