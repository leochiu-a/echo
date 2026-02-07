import ApplicationServices
import Foundation

struct AXContextSnapshot {
    let selectedText: String?
}

final class AXContextManager {
    private let maxSelectedTextLength = 12_000

    func captureSnapshot() -> AXContextSnapshot {
        AXContextSnapshot(selectedText: captureSelectedText())
    }

    private func captureSelectedText() -> String? {
        guard AXIsProcessTrusted() else { return nil }

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
        let focusedElementRef = unsafeBitCast(focusedValue, to: AXUIElement.self)

        guard
            let selectedValue = copyAttribute(
                kAXSelectedTextAttribute as CFString,
                from: focusedElementRef
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
