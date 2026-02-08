import SwiftUI

@main
struct EchoApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup("Echo Dashboard") {
            DashboardView()
        }

        Settings {
            SettingsView()
        }
    }
}

private struct SettingsView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Echo POC")
                .font(.headline)
            Text("Use Cmd+K in any app to open the inline panel.")
                .font(.subheadline)
        }
        .padding(16)
        .frame(width: 320)
    }
}
