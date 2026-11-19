import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Needed when launched with `swift run` rather than from the app bundle.
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

@main
struct AtriumTrafficApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var store = TrafficStore()

    var body: some Scene {
        WindowGroup("Atrium Traffic") {
            RootView()
                .environment(store)
                .frame(minWidth: 980, minHeight: 620)
        }
        .defaultSize(width: 1280, height: 800)
        .commands {
            CommandGroup(after: .toolbar) {
                Button("Refresh") { store.refreshCount += 1 }
                    .keyboardShortcut("r")
            }
        }

        Settings {
            SettingsView()
                .environment(store)
        }
    }
}

struct RootView: View {
    @Environment(TrafficStore.self) private var store

    var body: some View {
        if store.signedIn {
            MainView()
        } else {
            SetupView()
        }
    }
}

struct SetupView: View {
    @Environment(TrafficStore.self) private var store
    @State private var clientID = UserDefaults.standard.string(forKey: GoogleAuth.clientIDKey) ?? ""
    @State private var clientSecret = Keychain.get("client_secret") ?? ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Atrium Traffic")
                .font(.largeTitle.weight(.semibold))
            Text("Connect to the Google Analytics property that atrium.earth already reports to. Access is read-only, and the credentials stay in your Mac's keychain.")
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Form {
                TextField("OAuth client ID", text: $clientID, prompt: Text("…apps.googleusercontent.com"))
                SecureField("Client secret", text: $clientSecret)
            }
            .formStyle(.grouped)
            .scrollDisabled(true)
            .frame(height: 120)

            HStack {
                if store.signingIn {
                    ProgressView().controlSize(.small)
                    Text("Finish signing in in your browser…").foregroundStyle(.secondary)
                    Button("Cancel") { store.cancelSignIn() }
                } else {
                    Button("Sign in with Google") {
                        store.signIn(clientID: clientID, clientSecret: clientSecret)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(clientID.isEmpty || clientSecret.isEmpty)
                }
                Spacer()
                Link("Create a client ID", destination: URL(string: "https://console.cloud.google.com/apis/credentials")!)
            }

            if let message = store.authMessage {
                Text(message).foregroundStyle(.red)
            }
            Text("The one-time Google Cloud setup is in apps/AtriumTraffic/README.md.")
                .font(.footnote)
                .foregroundStyle(.tertiary)
        }
        .padding(40)
        .frame(maxWidth: 560)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct SettingsView: View {
    @Environment(TrafficStore.self) private var store
    @State private var propertyID = ""

    var body: some View {
        Form {
            TextField("Analytics property ID", text: $propertyID, prompt: Text("123456789"))
                .onSubmit { store.selectProperty(propertyID) }
            Text("The numeric ID from Analytics → Admin → Property details. Only needed if the property menu is empty.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Button("Sign Out of Google") { store.signOut() }
                .disabled(!store.signedIn)
        }
        .formStyle(.grouped)
        .frame(width: 440)
        .onAppear { propertyID = store.propertyID }
    }
}
