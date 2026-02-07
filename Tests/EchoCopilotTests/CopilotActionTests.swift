import Testing
@testable import EchoCopilot

@Test
func editTitleWithSelection() {
    #expect(CopilotAction.edit.title(hasSelection: true) == "Edit Selection")
}

@Test
func editTitleWithoutSelection() {
    #expect(CopilotAction.edit.title(hasSelection: false) == "Edit Text")
}

@Test
func askQuestionTitleAlwaysStable() {
    #expect(CopilotAction.askQuestion.title(hasSelection: false) == "Ask Question")
    #expect(CopilotAction.askQuestion.title(hasSelection: true) == "Ask Question")
}
