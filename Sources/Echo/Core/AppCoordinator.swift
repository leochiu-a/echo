import AppKit

@MainActor
protocol HotKeyManaging: AnyObject {
    var onHotKeyPressed: (@MainActor () -> Void)? { get set }
    func register(shortcut: KeyboardShortcut)
    func unregister()
}

@MainActor
protocol OverlayPanelControlling: AnyObject {
    func toggleNearMouse()
}

@MainActor
protocol AppSettingsStoring: AnyObject {
    var openPanelShortcut: KeyboardShortcut { get }
}

@MainActor
final class AppCoordinator {
    private let hotKeyManager: any HotKeyManaging
    private let overlayPanelController: any OverlayPanelControlling
    private let appServerRunner: any AppServerPrewarming
    private let settingsStore: any AppSettingsStoring
    private let notificationCenter: NotificationCenter
    private var dashboardPromptObserver: NSObjectProtocol?
    private var settingsObserver: NSObjectProtocol?

    init() {
        self.hotKeyManager = HotKeyManager()
        self.overlayPanelController = OverlayPanelController()
        self.appServerRunner = AppServerRunner()
        self.settingsStore = AppSettingsStore.shared
        self.notificationCenter = .default
    }

    init(
        hotKeyManager: any HotKeyManaging,
        overlayPanelController: any OverlayPanelControlling,
        appServerRunner: any AppServerPrewarming,
        settingsStore: any AppSettingsStoring,
        notificationCenter: NotificationCenter
    ) {
        self.hotKeyManager = hotKeyManager
        self.overlayPanelController = overlayPanelController
        self.appServerRunner = appServerRunner
        self.settingsStore = settingsStore
        self.notificationCenter = notificationCenter
    }

    func start() {
        hotKeyManager.onHotKeyPressed = { [weak self] in
            self?.overlayPanelController.toggleNearMouse()
        }
        hotKeyManager.register(shortcut: settingsStore.openPanelShortcut)

        dashboardPromptObserver = notificationCenter.addObserver(
            forName: .dashboardRequestOpenPrompt,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.overlayPanelController.toggleNearMouse()
            }
        }

        settingsObserver = notificationCenter.addObserver(
            forName: .appSettingsDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                hotKeyManager.register(shortcut: settingsStore.openPanelShortcut)
            }
        }

        Task(priority: .utility) { [appServerRunner] in
            await appServerRunner.prewarm()
        }
    }

    func stop() {
        hotKeyManager.unregister()
        if let dashboardPromptObserver {
            notificationCenter.removeObserver(dashboardPromptObserver)
            self.dashboardPromptObserver = nil
        }
        if let settingsObserver {
            notificationCenter.removeObserver(settingsObserver)
            self.settingsObserver = nil
        }
    }
}

extension Notification.Name {
    static let dashboardRequestOpenPrompt = Notification.Name("dashboardRequestOpenPrompt")
}
