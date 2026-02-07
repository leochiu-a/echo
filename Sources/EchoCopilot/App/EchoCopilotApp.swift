import SwiftUI

@main
struct EchoCopilotApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        Settings {
            SettingsView()
        }
    }
}

private struct SettingsView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Echo Copilot POC")
                .font(.headline)
            Text("Use Cmd+K in any app to open the inline panel.")
                .font(.subheadline)
        }
        .padding(16)
        .frame(width: 320)
    }
}
