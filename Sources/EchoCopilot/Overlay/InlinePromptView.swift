import SwiftUI

struct InlinePromptView: View {
    @ObservedObject var viewModel: InlinePromptViewModel
    @FocusState private var isCommandFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Echo Copilot")
                .font(.caption)
                .foregroundStyle(.secondary)

            TextEditor(text: $viewModel.commandText)
                .font(.system(.body, design: .monospaced))
                .focused($isCommandFocused)
                .frame(minHeight: 72, maxHeight: 100)
                .padding(6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(nsColor: .textBackgroundColor))
                )

            if viewModel.isRunning {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Running...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else if let error = viewModel.errorText {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            if !viewModel.outputText.isEmpty {
                ScrollView {
                    Text(viewModel.outputText)
                        .font(.system(.body, design: .monospaced))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 110)
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(nsColor: .controlBackgroundColor))
                )
            }

            HStack {
                Button("Run") {
                    viewModel.execute()
                }
                .keyboardShortcut(.return, modifiers: [])
                .disabled(viewModel.commandText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isRunning)

                Button("Accept") {
                    viewModel.accept()
                }
                .keyboardShortcut(.return, modifiers: [.command])
                .disabled(viewModel.isRunning)

                Spacer()

                Button("Close") {
                    viewModel.close()
                }
                .keyboardShortcut(.escape, modifiers: [])
            }
        }
        .padding(12)
        .frame(width: 480)
        .onAppear {
            isCommandFocused = true
        }
    }
}
