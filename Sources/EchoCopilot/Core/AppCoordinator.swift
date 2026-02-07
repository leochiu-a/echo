import AppKit

@MainActor
final class AppCoordinator {
    private let hotKeyManager = HotKeyManager()
    private let overlayPanelController = OverlayPanelController()

    func start() {
        hotKeyManager.onHotKeyPressed = { [weak self] in
            self?.overlayPanelController.toggleNearMouse()
        }
        hotKeyManager.registerCmdK()
    }

    func stop() {
        hotKeyManager.unregister()
    }
}
