import AppKit
import SwiftUI

struct AutoGrowingCommandInput: NSViewRepresentable {
    @Binding var text: String
    @Binding var dynamicHeight: CGFloat
    @Binding var isComposing: Bool

    let minHeight: CGFloat
    let maxHeight: CGFloat
    let isEditable: Bool
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

        let textView = IMEAwareTextView()
        textView.isEditable = isEditable
        textView.isSelectable = true
        textView.isRichText = false
        textView.importsGraphics = false
        textView.usesRuler = false
        textView.drawsBackground = false
        textView.backgroundColor = .clear
        textView.insertionPointColor = .labelColor
        textView.font = .monospacedSystemFont(ofSize: NSFont.systemFontSize, weight: .regular)
        textView.string = text
        textView.textContainerInset = NSSize(width: 0, height: 5)
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.widthTracksTextView = true
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.delegate = context.coordinator
        textView.onMarkedTextStateChange = { composing in
            DispatchQueue.main.async {
                isComposing = composing
            }
        }

        scrollView.documentView = textView
        context.coordinator.textView = textView
        context.coordinator.lastFocusRequestID = focusRequestID

        DispatchQueue.main.async {
            self.updateMeasuredHeight(for: textView)
            if isEditable {
                textView.window?.makeFirstResponder(textView)
            }
        }

        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        context.coordinator.parent = self
        guard let textView = context.coordinator.textView else { return }

        scrollView.hasVerticalScroller = false
        scrollView.hasHorizontalScroller = false
        textView.isEditable = isEditable

        if textView.string != text, !textView.hasMarkedText() {
            textView.string = text
        }
        isComposing = textView.hasMarkedText()

        if context.coordinator.lastFocusRequestID != focusRequestID {
            context.coordinator.lastFocusRequestID = focusRequestID
            DispatchQueue.main.async {
                if isEditable {
                    textView.window?.makeFirstResponder(textView)
                }
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
            parent.isComposing = textView.hasMarkedText()
            parent.updateMeasuredHeight(for: textView)
        }
    }
}

final class IMEAwareTextView: NSTextView {
    var onMarkedTextStateChange: ((Bool) -> Void)?

    override func setMarkedText(_ string: Any, selectedRange: NSRange, replacementRange: NSRange) {
        let updatedMarkedText = normalizedMarkedText(string)
        super.setMarkedText(updatedMarkedText, selectedRange: selectedRange, replacementRange: replacementRange)
        onMarkedTextStateChange?(hasMarkedText())
    }

    override func unmarkText() {
        super.unmarkText()
        onMarkedTextStateChange?(hasMarkedText())
    }

    override func didChangeText() {
        super.didChangeText()
        onMarkedTextStateChange?(hasMarkedText())
    }

    private func normalizedMarkedText(_ input: Any) -> NSAttributedString {
        if let attributed = input as? NSAttributedString {
            let mutable = NSMutableAttributedString(attributedString: attributed)
            mutable.addAttributes([
                .underlineColor: NSColor.labelColor,
                .foregroundColor: NSColor.labelColor
            ], range: NSRange(location: 0, length: mutable.length))
            return mutable
        }

        if let text = input as? String {
            return NSAttributedString(
                string: text,
                attributes: [
                    .underlineStyle: NSUnderlineStyle.single.rawValue,
                    .underlineColor: NSColor.labelColor,
                    .foregroundColor: NSColor.labelColor
                ]
            )
        }

        return NSAttributedString(string: "\(input)")
    }
}
