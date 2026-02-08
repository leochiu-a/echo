import AppKit
import SwiftUI

struct DashboardSettingsSection: View {
    @ObservedObject var settingsStore: AppSettingsStore
    private let modelOptions = AppSettingsStore.supportedCodexModels

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            DashboardSectionHeading(section: .settings)

            SettingsSectionHeader(icon: "keyboard", title: "Keyboard Shortcuts")

            SettingsRow(
                title: "Open Input Panel",
                description: "Toggle the floating input panel. Default: Command + K."
            ) {
                ShortcutRecorderField(
                    shortcut: $settingsStore.openPanelShortcut,
                    defaultShortcut: AppSettingsStore.defaultOpenPanelShortcut
                )
            }

            SettingsRow(
                title: "Replace Action",
                description: "Apply output by replacing the current selection."
            ) {
                ShortcutRecorderField(
                    shortcut: $settingsStore.replaceShortcut,
                    defaultShortcut: AppSettingsStore.defaultReplaceShortcut
                )
            }

            SettingsRow(
                title: "Insert Action",
                description: "Apply output by inserting next to the current selection."
            ) {
                ShortcutRecorderField(
                    shortcut: $settingsStore.insertShortcut,
                    defaultShortcut: AppSettingsStore.defaultInsertShortcut
                )
            }

            SettingsSectionHeader(icon: "cpu", title: "Model")

            SettingsRow(
                title: "Codex Model",
                description: "Select the execution model (passed to codex exec --model)."
            ) {
                ModelSelectionField(selection: $settingsStore.codexModel, options: modelOptions)
            }

            HStack {
                Spacer()
                Button("Save Settings") {
                    ensureModelSelectionValid()
                }
                .buttonStyle(.plain)
                .pointerOnHover()
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.white.opacity(0.96))
                .padding(.horizontal, 22)
                .padding(.vertical, 12)
                .background(
                    Capsule()
                        .fill(DashboardTheme.actionTint)
                        .overlay(
                            Capsule()
                                .strokeBorder(Color.black.opacity(0.08), lineWidth: 1)
                        )
                )
                .shadow(color: DashboardTheme.actionTint.opacity(0.25), radius: 8, x: 0, y: 3)
            }
        }
        .padding(.top, 4)
        .onAppear {
            ensureModelSelectionValid()
        }
    }

    private func ensureModelSelectionValid() {
        guard modelOptions.contains(settingsStore.codexModel) else {
            settingsStore.codexModel = AppSettingsStore.defaultCodexModel
            return
        }
    }
}

private struct ModelSelectionField: View {
    @Binding var selection: String
    let options: [String]

    @State private var isHovered = false

    var body: some View {
        Menu {
            ForEach(options, id: \.self) { model in
                Button {
                    selection = model
                } label: {
                    HStack {
                        Text(model)
                        Spacer()
                        if selection == model {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 10) {
                Text(selection)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(DashboardTheme.primaryText)
                Spacer(minLength: 0)
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(DashboardTheme.subtleText)
            }
            .padding(.horizontal, 14)
            .frame(width: 390, height: 56)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(isHovered ? 0.82 : 0.72))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .strokeBorder(
                                isHovered ? DashboardTheme.actionTint.opacity(0.35) : Color.black.opacity(0.08),
                                lineWidth: 1
                            )
                    )
            )
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .pointerOnHover()
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.12)) {
                isHovered = hovering
            }
        }
    }
}

private struct SettingsRow<Control: View>: View {
    let title: String
    let description: String
    @ViewBuilder let control: () -> Control

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(DashboardTheme.primaryText)
                Text(description)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            control()
        }
    }
}

private struct ShortcutRecorderField: View {
    @Binding var shortcut: KeyboardShortcut
    let defaultShortcut: KeyboardShortcut

    @State private var isRecording = false
    @State private var eventMonitor: Any?

    var body: some View {
        HStack(spacing: 10) {
            Button {
                toggleRecording()
            } label: {
                HStack(spacing: 8) {
                    if isRecording {
                        ShortcutToken(text: "Press shortcut...")
                    } else {
                        ForEach(shortcut.displayTokens, id: \.self) { token in
                            ShortcutToken(text: token)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .frame(width: 320, height: 56, alignment: .leading)
                .padding(.horizontal, 10)
            }
            .buttonStyle(.plain)
            .pointerOnHover()

            Button {
                shortcut = defaultShortcut
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(DashboardTheme.subtleText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .pointerOnHover()
        }
        .padding(.horizontal, 10)
        .frame(width: 390, height: 56)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.65))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(
                            isRecording ? DashboardTheme.actionTint.opacity(0.35) : Color.black.opacity(0.08),
                            lineWidth: isRecording ? 1.5 : 1
                        )
                )
        )
        .onDisappear {
            stopRecording()
        }
    }

    private func toggleRecording() {
        isRecording ? stopRecording() : startRecording()
    }

    private func startRecording() {
        stopRecording()
        isRecording = true
        eventMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown]) { event in
            if event.keyCode == 53 {
                stopRecording()
                return nil
            }

            let modifiers = event.modifierFlags.normalizedShortcutModifiers
            guard !modifiers.isEmpty else {
                NSSound.beep()
                return nil
            }

            shortcut = KeyboardShortcut(keyCode: event.keyCode, modifiers: modifiers)
            stopRecording()
            return nil
        }
    }

    private func stopRecording() {
        isRecording = false
        if let eventMonitor {
            NSEvent.removeMonitor(eventMonitor)
            self.eventMonitor = nil
        }
    }
}

private struct ShortcutToken: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .foregroundStyle(DashboardTheme.primaryText)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(0.68))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Color.black.opacity(0.09), lineWidth: 1)
                    )
            )
    }
}
