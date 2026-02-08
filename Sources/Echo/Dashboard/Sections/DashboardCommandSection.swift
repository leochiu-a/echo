import SwiftUI

struct DashboardCommandSection: View {
    @ObservedObject var settingsStore: AppSettingsStore

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            DashboardSectionHeading(section: .commands)

            commandHelpCard

            HStack {
                Text("\(settingsStore.slashCommands.count) command\(settingsStore.slashCommands.count == 1 ? "" : "s")")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)

                Spacer()

                Button {
                    addCommand()
                } label: {
                    Label("Add Command", systemImage: "plus")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                }
                .buttonStyle(.borderedProminent)
                .tint(DashboardTheme.actionTint)
                .pointerOnHover()
            }

            if settingsStore.slashCommands.isEmpty {
                emptyStateCard
            } else {
                ForEach(Array(settingsStore.slashCommands.enumerated()), id: \.element.id) { index, _ in
                    commandCard(index: index)
                }
            }
        }
        .padding(.top, 4)
    }

    private var commandHelpCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Slash command mapping")
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)
            Text("Type `/` in the inline input to trigger autocomplete. Use `{{input}}` in prompt templates to inject remaining text after the command.")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(DashboardTheme.subtleText)
            Text("Example: `/reply Thanks for the update` -> prompt template receives `Thanks for the update`.")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(DashboardTheme.subtleText)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(DashboardTheme.cardBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(DashboardTheme.cardBorder, lineWidth: 1)
                )
        )
    }

    private var emptyStateCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("No commands yet.")
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(DashboardTheme.primaryText)
            Text("Create one command and start typing `/` in the prompt panel to use autocomplete.")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(DashboardTheme.subtleText)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(DashboardTheme.cardBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(DashboardTheme.cardBorder, lineWidth: 1)
                )
        )
    }

    private func commandCard(index: Int) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Command #\(index + 1)")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)

                Spacer()

                Button(role: .destructive) {
                    settingsStore.slashCommands.remove(at: index)
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(DashboardTheme.subtleText)
                        .frame(width: 28, height: 28)
                        .background(
                            Circle()
                                .fill(Color.black.opacity(0.05))
                        )
                }
                .buttonStyle(.borderless)
                .pointerOnHover()
            }

            HStack(spacing: 10) {
                Text("/")
                    .font(.system(size: 18, weight: .bold, design: .monospaced))
                    .foregroundStyle(DashboardTheme.actionTint)
                TextField("command-name", text: commandBinding(for: index))
                    .textFieldStyle(.plain)
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
                    .foregroundStyle(DashboardTheme.primaryText)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.white.opacity(0.92))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(DashboardTheme.actionTint.opacity(0.15), lineWidth: 1)
                            )
                    )
                    .environment(\.colorScheme, .light)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Prompt template")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(DashboardTheme.subtleText)

                TextEditor(text: promptBinding(for: index))
                    .font(.system(size: 13, weight: .regular, design: .monospaced))
                    .foregroundStyle(DashboardTheme.primaryText)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 96, maxHeight: 180)
                    .padding(8)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.white.opacity(0.92))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(DashboardTheme.actionTint.opacity(0.15), lineWidth: 1)
                            )
                    )
                    .environment(\.colorScheme, .light)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(DashboardTheme.cardBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(DashboardTheme.cardBorder, lineWidth: 1)
                )
        )
    }

    private func commandBinding(for index: Int) -> Binding<String> {
        Binding(
            get: {
                guard settingsStore.slashCommands.indices.contains(index) else { return "" }
                return settingsStore.slashCommands[index].command
            },
            set: { newValue in
                guard settingsStore.slashCommands.indices.contains(index) else { return }
                settingsStore.slashCommands[index].command = newValue
            }
        )
    }

    private func promptBinding(for index: Int) -> Binding<String> {
        Binding(
            get: {
                guard settingsStore.slashCommands.indices.contains(index) else { return "" }
                return settingsStore.slashCommands[index].prompt
            },
            set: { newValue in
                guard settingsStore.slashCommands.indices.contains(index) else { return }
                settingsStore.slashCommands[index].prompt = newValue
            }
        )
    }

    private func addCommand() {
        settingsStore.slashCommands.append(
            SlashCommandSetting(
                command: "",
                prompt: "Rewrite this email to sound clear, concise, and polite:\n\n{{input}}"
            )
        )
    }
}
