import SwiftUI

struct InlinePromptView: View {
    @ObservedObject var viewModel: InlinePromptViewModel
    @State private var inputHeight: CGFloat = 30

    private var actionLabel: String {
        viewModel.hasSelectionContext ? "Edit Selection" : "Edit Text"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                ZStack(alignment: .topLeading) {
            AutoGrowingCommandInput(
                text: $viewModel.commandText,
                dynamicHeight: $inputHeight,
                isComposing: $viewModel.isComposingInput,
                minHeight: 30,
                maxHeight: 120,
                focusRequestID: viewModel.focusRequestID
            )
            .frame(height: inputHeight)

                    if viewModel.commandText.isEmpty && !viewModel.isComposingInput {
                        Text("Edit selected code")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color(nsColor: .secondaryLabelColor))
                            .padding(.leading, 2)
                            .padding(.top, 4)
                            .allowsHitTesting(false)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(nsColor: .textBackgroundColor).opacity(0.6))
                )

                Button {
                    viewModel.close()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color(nsColor: .secondaryLabelColor))
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 8) {
                Menu {
                    Button(actionLabel) {}
                } label: {
                    Text(actionLabel)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color(nsColor: .secondaryLabelColor))
                }
                .menuStyle(.borderlessButton)

                Spacer()

                if viewModel.isRunning {
                    Button {
                        viewModel.cancelExecution()
                    } label: {
                        Image(systemName: "stop.circle.fill")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundStyle(Color(nsColor: .systemRed))
                    }
                    .buttonStyle(.plain)
                } else {
                    Button {
                        viewModel.execute()
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundStyle(
                                viewModel.commandText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    ? Color(nsColor: .tertiaryLabelColor)
                                    : Color(nsColor: .labelColor)
                            )
                    }
                    .buttonStyle(.plain)
                    .keyboardShortcut(.return, modifiers: [])
                    .disabled(viewModel.commandText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }

            if let error = viewModel.errorText {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            if viewModel.hasExecuted {
                ScrollView {
                    Text(viewModel.outputText.isEmpty ? "No output yet." : viewModel.outputText)
                        .font(.system(.callout, design: .monospaced))
                        .foregroundStyle(
                            viewModel.outputText.isEmpty
                                ? Color(nsColor: .secondaryLabelColor)
                                : Color(nsColor: .labelColor)
                        )
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(minHeight: 52, maxHeight: 96)
                .padding(6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(nsColor: .controlBackgroundColor))
                )
            }
        }
        .padding(10)
        .frame(width: 560)
    }
}
