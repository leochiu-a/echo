import AppKit

@MainActor
final class AppCoordinator {
    private let hotKeyManager = HotKeyManager()
    private let overlayPanelController = OverlayPanelController()
    private var dashboardPromptObserver: NSObjectProtocol?

    func start() {
        hotKeyManager.onHotKeyPressed = { [weak self] in
            self?.overlayPanelController.toggleNearMouse()
        }
        hotKeyManager.registerCmdK()

        dashboardPromptObserver = NotificationCenter.default.addObserver(
            forName: .dashboardRequestOpenPrompt,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.overlayPanelController.toggleNearMouse()
        }
    }

    func stop() {
        hotKeyManager.unregister()
        if let dashboardPromptObserver {
            NotificationCenter.default.removeObserver(dashboardPromptObserver)
            self.dashboardPromptObserver = nil
        }
    }
}

extension Notification.Name {
    static let dashboardRequestOpenPrompt = Notification.Name("dashboardRequestOpenPrompt")
}
