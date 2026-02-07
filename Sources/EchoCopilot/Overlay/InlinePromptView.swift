import SwiftUI

struct InlinePromptView: View {
    @ObservedObject var viewModel: InlinePromptViewModel
    @State private var inputHeight: CGFloat = 32

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Echo Copilot")
                .font(.caption)
                .foregroundStyle(.secondary)

            AutoGrowingCommandInput(
                text: $viewModel.commandText,
                dynamicHeight: $inputHeight,
                minHeight: 32,
                maxHeight: 180,
                focusRequestID: viewModel.focusRequestID
            )
                .frame(height: inputHeight)
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

            if let contextInfo = viewModel.selectedContextInfo {
                Text(contextInfo)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if viewModel.hasExecuted {
                ScrollView {
                    Text(viewModel.outputText.isEmpty ? "No output yet." : viewModel.outputText)
                        .font(.system(.body, design: .monospaced))
                        .foregroundStyle(
                            viewModel.outputText.isEmpty
                                ? Color(nsColor: .secondaryLabelColor)
                                : Color(nsColor: .labelColor)
                        )
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(minHeight: 64, maxHeight: 110)
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
    }
}
