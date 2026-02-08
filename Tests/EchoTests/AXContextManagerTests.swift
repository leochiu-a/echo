import Testing
@testable import Echo

@Test
func recoverLineBreaksKeepsShortTextUnchanged() {
    let text = "Short text. No changes."
    #expect(AXContextManager.recoverLineBreaksIfNeeded(in: text) == text)
}

@Test
func recoverLineBreaksKeepsExistingNewlines() {
    let text = String(repeating: "already\nwrapped ", count: 8)
    #expect(AXContextManager.recoverLineBreaksIfNeeded(in: text) == text)
}

@Test
func recoverLineBreaksAddsBreaksForCJKPunctuation() {
    let longText = String(
        repeating: "這是一段沒有換行但有標點的句子。這段文字應該在句號後換行！",
        count: 4
    )

    let output = AXContextManager.recoverLineBreaksIfNeeded(in: longText)
    #expect(output.contains("。\n"))
    #expect(output.contains("！\n"))
}

@Test
func recoverLineBreaksAddsBreaksForLatinPunctuation() {
    let longText = String(
        repeating: "This is a long paragraph without line breaks. It should wrap after punctuation? Yes; ",
        count: 3
    )

    let output = AXContextManager.recoverLineBreaksIfNeeded(in: longText)
    #expect(output.contains(".\n"))
    #expect(output.contains("?\n"))
    #expect(output.contains(";\n"))
}
