import AppKit
import SwiftUI

struct AutoGrowingCommandInput: NSViewRepresentable {
    @Binding var text: String
    @Binding var dynamicHeight: CGFloat

    let minHeight: CGFloat
    let maxHeight: CGFloat
    let focusRequestID: UUID

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = false
        scrollView.hasHorizontalScroller = false
        scrollView.autohidesScrollers = true
        scrollView.verticalScrollElasticity = .none
        scrollView.horizontalScrollElasticity = .none

        let textView = NSTextView()
        textView.isEditable = true
        textView.isSelectable = true
        textView.isRichText = false
        textView.importsGraphics = false
        textView.usesRuler = false
        textView.drawsBackground = false
        textView.backgroundColor = .clear
        textView.font = .monospacedSystemFont(ofSize: NSFont.systemFontSize, weight: .regular)
        textView.string = text
        textView.textContainerInset = NSSize(width: 0, height: 4)
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.widthTracksTextView = true
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.delegate = context.coordinator

        scrollView.documentView = textView
        context.coordinator.textView = textView
        context.coordinator.lastFocusRequestID = focusRequestID

        DispatchQueue.main.async {
            self.updateMeasuredHeight(for: textView)
            textView.window?.makeFirstResponder(textView)
        }

        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        context.coordinator.parent = self
        guard let textView = context.coordinator.textView else { return }

        scrollView.hasVerticalScroller = false
        scrollView.hasHorizontalScroller = false

        if textView.string != text {
            textView.string = text
        }

        if context.coordinator.lastFocusRequestID != focusRequestID {
            context.coordinator.lastFocusRequestID = focusRequestID
            DispatchQueue.main.async {
                textView.window?.makeFirstResponder(textView)
            }
        }

        updateMeasuredHeight(for: textView)
    }

    private func updateMeasuredHeight(for textView: NSTextView) {
        guard let layoutManager = textView.layoutManager, let textContainer = textView.textContainer else {
            return
        }

        let containerWidth = max(textView.bounds.width, 1)
        textContainer.containerSize = NSSize(width: containerWidth, height: .greatestFiniteMagnitude)
        layoutManager.ensureLayout(for: textContainer)

        let usedHeight = layoutManager.usedRect(for: textContainer).height
        let target = min(
            max(ceil(usedHeight + textView.textContainerInset.height * 2), minHeight),
            maxHeight
        )

        if abs(dynamicHeight - target) > 0.5 {
            DispatchQueue.main.async {
                dynamicHeight = target
            }
        }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: AutoGrowingCommandInput
        weak var textView: NSTextView?
        var lastFocusRequestID: UUID?

        init(parent: AutoGrowingCommandInput) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let textView else { return }
            parent.text = textView.string
            parent.updateMeasuredHeight(for: textView)
        }
    }
}
