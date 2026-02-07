import ApplicationServices
import Foundation

struct AXContextSnapshot {
    let selectedText: String?
    let hasEditableSelection: Bool
}

final class AXContextManager {
    private let maxSelectedTextLength = 12_000

    func captureSnapshot() -> AXContextSnapshot {
        guard AXIsProcessTrusted() else {
            return AXContextSnapshot(selectedText: nil, hasEditableSelection: false)
        }

        guard let focusedElement = focusedElement() else {
            return AXContextSnapshot(selectedText: nil, hasEditableSelection: false)
        }

        let selectedText = captureSelectedText(from: focusedElement)
        let hasEditableSelection = selectedText != nil && isElementEditable(focusedElement)
        return AXContextSnapshot(selectedText: selectedText, hasEditableSelection: hasEditableSelection)
    }

    private func captureSelectedText(from focusedElement: AXUIElement) -> String? {
        guard
            let selectedValue = copyAttribute(
                kAXSelectedTextAttribute as CFString,
                from: focusedElement
            )
        else {
            return nil
        }

        if let text = selectedValue as? String {
            return normalizedSelectedText(text)
        }

        if let attributed = selectedValue as? NSAttributedString {
            return normalizedSelectedText(attributed.string)
        }

        return nil
    }

    private func focusedElement() -> AXUIElement? {
        let systemWideElement = AXUIElementCreateSystemWide()
        guard
            let focusedValue = copyAttribute(
                kAXFocusedUIElementAttribute as CFString,
                from: systemWideElement
            ),
            CFGetTypeID(focusedValue) == AXUIElementGetTypeID()
        else {
            return nil
        }
        return unsafeBitCast(focusedValue, to: AXUIElement.self)
    }

    private func isElementEditable(_ element: AXUIElement) -> Bool {
        if let editableValue = copyAttribute("AXEditable" as CFString, from: element) as? Bool {
            return editableValue
        }

        var isSettable = DarwinBoolean(false)
        let result = AXUIElementIsAttributeSettable(
            element,
            kAXSelectedTextRangeAttribute as CFString,
            &isSettable
        )
        return result == .success && isSettable.boolValue
    }

    private func copyAttribute(_ attribute: CFString, from element: AXUIElement) -> CFTypeRef? {
        var value: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element, attribute, &value)
        guard result == .success else { return nil }
        return value
    }

    private func normalizedSelectedText(_ text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return String(trimmed.prefix(maxSelectedTextLength))
    }
}
