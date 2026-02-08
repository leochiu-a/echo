import Foundation

enum CopilotAction: String, CaseIterable, Codable {
    case edit
    case askQuestion

    func title(hasSelection: Bool) -> String {
        switch self {
        case .edit:
            return hasSelection ? "Edit Selection" : "Edit Text"
        case .askQuestion:
            return "Ask Question"
        }
    }
}
