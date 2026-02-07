import AppKit
import SwiftUI

@MainActor
final class OverlayPanelController {
    private let viewModel = InlinePromptViewModel()
    private lazy var panel: FloatingPanel = makePanel()
    private var keyMonitor: Any?
    private var previousApp: NSRunningApplication?

    init() {
        viewModel.onRequestClose = { [weak self] in
            self?.dismiss()
        }
        viewModel.onRequestAccept = { [weak self] acceptedText in
            self?.copyToClipboard(acceptedText)
        }
    }

    func toggleNearMouse() {
        if panel.isVisible {
            dismiss()
            return
        }
        showNearMouse()
    }

    private func showNearMouse() {
        previousApp = NSWorkspace.shared.frontmostApplication
        viewModel.prepareForPresentation()

        let panelSize = panel.frame.size
        let mouse = NSEvent.mouseLocation
        let targetOrigin = NSPoint(x: mouse.x + 12, y: mouse.y - panelSize.height - 12)
        let adjustedOrigin = clampedOrigin(for: targetOrigin, panelSize: panelSize)

        panel.setFrameOrigin(adjustedOrigin)
        panel.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        installKeyMonitor()
    }

    private func dismiss() {
        panel.orderOut(nil)
        uninstallKeyMonitor()
        previousApp?.activate(options: [.activateIgnoringOtherApps])
    }

    private func makePanel() -> FloatingPanel {
        let panel = FloatingPanel(
            contentRect: NSRect(x: 0, y: 0, width: 480, height: 260),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )

        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.level = .floating
        panel.isFloatingPanel = true
        panel.hasShadow = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.hidesOnDeactivate = false

        let content = InlinePromptView(viewModel: viewModel)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.black.opacity(0.12), lineWidth: 1)
            )
        panel.contentView = NSHostingView(rootView: content)

        return panel
    }

    private func clampedOrigin(for origin: NSPoint, panelSize: NSSize) -> NSPoint {
        guard let screen = NSScreen.screens.first(where: { NSMouseInRect(NSEvent.mouseLocation, $0.frame, false) })
            ?? NSScreen.main
        else {
            return origin
        }

        let visible = screen.visibleFrame
        let minX = visible.minX + 8
        let maxX = visible.maxX - panelSize.width - 8
        let minY = visible.minY + 8
        let maxY = visible.maxY - panelSize.height - 8

        return NSPoint(
            x: min(max(origin.x, minX), maxX),
            y: min(max(origin.y, minY), maxY)
        )
    }

    private func installKeyMonitor() {
        uninstallKeyMonitor()
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown]) { [weak self] event in
            guard let self else { return event }

            switch event.keyCode {
            case 53: // Esc
                viewModel.close()
                return nil
            case 126: // Up
                viewModel.historyUp()
                return nil
            case 125: // Down
                viewModel.historyDown()
                return nil
            case 36: // Return
                if event.modifierFlags.contains(.command) {
                    viewModel.accept()
                    return nil
                }
                if event.modifierFlags.intersection([.command, .option, .control]).isEmpty
                    && !event.modifierFlags.contains(.shift)
                {
                    viewModel.execute()
                    return nil
                }
                return event
            default:
                return event
            }
        }
    }

    private func uninstallKeyMonitor() {
        if let keyMonitor {
            NSEvent.removeMonitor(keyMonitor)
            self.keyMonitor = nil
        }
    }

    private func copyToClipboard(_ text: String) {
        guard !text.isEmpty else { return }
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
    }
}

final class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
