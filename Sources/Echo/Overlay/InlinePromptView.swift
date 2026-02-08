import AppKit
import SwiftUI

struct InlinePromptView: View {
    @ObservedObject var viewModel: InlinePromptViewModel
    @State private var inputHeight: CGFloat = 26
    @State private var outputHeight: CGFloat = 140
    @State private var outputMeasuredWidth: CGFloat = 0

    private let outputMinHeight: CGFloat = 140
    private let outputMaxHeight: CGFloat = 420
    private let outputFontSize: CGFloat = 13
    private let outputLineSpacing: CGFloat = 2

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
                        isEditable: !viewModel.isRunning,
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
                            .foregroundStyle(Color(nsColor: .labelColor))
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

            if !viewModel.outputText.isEmpty {
                ScrollView {
                    Text(viewModel.outputText)
                        .font(.system(size: outputFontSize, weight: .regular, design: .monospaced))
                        .lineSpacing(outputLineSpacing)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                        .foregroundStyle(Color(nsColor: .labelColor))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(
                    GeometryReader { proxy in
                        Color.clear
                            .onAppear {
                                outputMeasuredWidth = proxy.size.width
                                updateOutputHeight()
                            }
                            .onChange(of: proxy.size.width) { newValue in
                                outputMeasuredWidth = newValue
                                updateOutputHeight()
                            }
                    }
                )
                .frame(height: outputHeight)
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 7)
                        .fill(Color(nsColor: .controlBackgroundColor))
                )

                if viewModel.canShowApplyButtons {
                    HStack(spacing: 8) {
                        Spacer()

                        Button {
                            viewModel.replaceOutput()
                        } label: {
                            Label("Replace", systemImage: "arrow.trianglehead.2.clockwise.rotate.90")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .buttonStyle(.bordered)

                        Button {
                            viewModel.insertOutput()
                        } label: {
                            Label("Insert", systemImage: "plus.circle.fill")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
        }
        .padding(8)
        .frame(width: 540)
        .onChange(of: viewModel.outputText) { _ in
            updateOutputHeight()
        }
    }

    private func updateOutputHeight() {
        guard !viewModel.outputText.isEmpty else {
            outputHeight = outputMinHeight
            return
        }

        let availableWidth = max(outputMeasuredWidth - 12, 1)
        let measuredTextHeight = measuredHeight(for: viewModel.outputText, availableWidth: availableWidth)
        let targetHeight = min(max(measuredTextHeight + 16, outputMinHeight), outputMaxHeight)

        if abs(outputHeight - targetHeight) > 0.5 {
            outputHeight = targetHeight
        }
    }

    private func measuredHeight(for text: String, availableWidth: CGFloat) -> CGFloat {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = outputLineSpacing
        paragraph.lineBreakMode = .byCharWrapping

        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedSystemFont(ofSize: outputFontSize, weight: .regular),
            .paragraphStyle: paragraph
        ]

        let rect = (text as NSString).boundingRect(
            with: NSSize(width: availableWidth, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: attributes
        )
        return ceil(rect.height)
    }
}
