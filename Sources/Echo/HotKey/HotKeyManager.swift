import Carbon
import Foundation

final class HotKeyManager {
    var onHotKeyPressed: (@MainActor () -> Void)?

    private var hotKeyRef: EventHotKeyRef?
    private var eventHandlerRef: EventHandlerRef?
    fileprivate var registeredHotKeyID = EventHotKeyID(signature: 0, id: 1)

    deinit {
        unregister()
    }

    func register(shortcut: KeyboardShortcut) {
        unregister()

        registeredHotKeyID = EventHotKeyID(signature: fourCharCode("ECHK"), id: 1)
        var eventSpec = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: OSType(kEventHotKeyPressed)
        )

        let userData = UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque())
        InstallEventHandler(
            GetApplicationEventTarget(),
            hotKeyEventHandler,
            1,
            &eventSpec,
            userData,
            &eventHandlerRef
        )

        RegisterEventHotKey(
            UInt32(shortcut.keyCode),
            shortcut.carbonModifiers,
            registeredHotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )
    }

    func unregister() {
        if let hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
            self.hotKeyRef = nil
        }
        if let eventHandlerRef {
            RemoveEventHandler(eventHandlerRef)
            self.eventHandlerRef = nil
        }
    }
}

private let hotKeyEventHandler: EventHandlerUPP = { _, eventRef, userData in
    guard
        let eventRef,
        let userData
    else {
        return noErr
    }

    let manager = Unmanaged<HotKeyManager>.fromOpaque(userData).takeUnretainedValue()
    var hotKeyID = EventHotKeyID()
    let result = GetEventParameter(
        eventRef,
        EventParamName(kEventParamDirectObject),
        EventParamType(typeEventHotKeyID),
        nil,
        MemoryLayout<EventHotKeyID>.size,
        nil,
        &hotKeyID
    )

    guard result == noErr, hotKeyID.id == manager.registeredHotKeyID.id else {
        return noErr
    }

    Task { @MainActor in
        manager.onHotKeyPressed?()
    }
    return noErr
}

private func fourCharCode(_ string: String) -> OSType {
    precondition(string.utf16.count == 4, "FourCharCode requires exactly four characters.")
    return string.utf16.reduce(0) { ($0 << 8) + OSType($1) }
}
