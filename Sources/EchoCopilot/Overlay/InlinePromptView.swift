import SwiftUI

struct InlinePromptView: View {
    @ObservedObject var viewModel: InlinePromptViewModel
    @State private var inputHeight: CGFloat = 26

    private var isEditSelectionMode: Bool {
        viewModel.selectedAction == .edit && viewModel.hasSelectionContext
    }

    private var actionLabelColor: Color {
        isEditSelectionMode
            ? Color(nsColor: .tertiaryLabelColor)
            : Color(nsColor: .secondaryLabelColor)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                ZStack(alignment: .topLeading) {
            AutoGrowingCommandInput(
                text: $viewModel.commandText,
                dynamicHeight: $inputHeight,
                isComposing: $viewModel.isComposingInput,
                minHeight: 26,
                maxHeight: 92,
                focusRequestID: viewModel.focusRequestID
            )
            .frame(height: inputHeight)

                    if viewModel.commandText.isEmpty && !viewModel.isComposingInput {
                        Text(viewModel.actionLabel)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(actionLabelColor)
                            .padding(.leading, 1)
                            .padding(.top, 5)
                            .allowsHitTesting(false)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    RoundedRectangle(cornerRadius: 7)
                        .fill(Color(nsColor: .textBackgroundColor).opacity(0.6))
                )

                Button {
                    viewModel.close()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color(nsColor: .secondaryLabelColor))
                        .frame(width: 18, height: 18)
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 6) {
                Spacer()

                Menu {
                    Button(viewModel.hasSelectionContext ? "Edit Selection" : "Edit Text") {
                        viewModel.selectedAction = .edit
                    }
                    Button("Ask Question") {
                        viewModel.selectedAction = .askQuestion
                    }
                } label: {
                    Text(viewModel.actionLabel)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(actionLabelColor)
                }
                .menuStyle(.borderlessButton)

                if viewModel.isRunning {
                    Button {
                        viewModel.cancelExecution()
                    } label: {
                        Image(systemName: "stop.circle.fill")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Color(nsColor: .systemRed))
                    }
                    .buttonStyle(.plain)
                } else {
                    Button {
                        viewModel.execute()
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 17, weight: .semibold))
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
                    .font(.caption2)
                    .foregroundStyle(.red)
            }

            if viewModel.hasExecuted {
                ScrollView {
                    Text(viewModel.outputText.isEmpty ? "No output yet." : viewModel.outputText)
                        .font(.system(.footnote, design: .monospaced))
                        .foregroundStyle(
                            viewModel.outputText.isEmpty
                                ? Color(nsColor: .secondaryLabelColor)
                                : Color(nsColor: .labelColor)
                        )
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(minHeight: 44, maxHeight: 84)
                .padding(5)
                .background(
                    RoundedRectangle(cornerRadius: 7)
                        .fill(Color(nsColor: .controlBackgroundColor))
                )
            }
        }
        .padding(8)
        .frame(width: 540)
    }
}
