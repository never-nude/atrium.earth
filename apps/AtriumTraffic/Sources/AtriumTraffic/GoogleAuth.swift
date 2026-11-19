import AppKit
import CryptoKit
import Foundation
import Network
import Security

/// Credentials live in the login keychain, never in the repository or in defaults.
enum Keychain {
    private static let service = "earth.atrium.traffic"

    static func set(_ value: String?, for key: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(base as CFDictionary)
        guard let value, !value.isEmpty else { return }
        var item = base
        item[kSecValueData as String] = Data(value.utf8)
        SecItemAdd(item as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}

enum AuthError: LocalizedError {
    case signedOut
    case missingClient
    case message(String)

    var errorDescription: String? {
        switch self {
        case .signedOut: return "Google sign-in has expired. Sign in again."
        case .missingClient: return "Enter the OAuth client ID and secret first."
        case .message(let text): return text
        }
    }
}

/// Google OAuth for an installed app: system browser, loopback redirect, PKCE.
actor GoogleAuth {
    static let scope = "https://www.googleapis.com/auth/analytics.readonly"
    static let clientIDKey = "oauthClientID"

    private var access: (token: String, expires: Date)?

    nonisolated static var hasRefreshToken: Bool { Keychain.get("refresh_token") != nil }

    private func credentials() throws -> (id: String, secret: String) {
        let id = (UserDefaults.standard.string(forKey: Self.clientIDKey) ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let secret = (Keychain.get("client_secret") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty, !secret.isEmpty else { throw AuthError.missingClient }
        return (id, secret)
    }

    func signIn() async throws {
        let client = try credentials()
        let receiver = try LoopbackReceiver()
        let port = try await receiver.start()
        defer { receiver.stop() }

        let redirect = "http://127.0.0.1:\(port)"
        let verifier = Self.randomToken()
        let state = Self.randomToken()
        let challenge = Self.base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))

        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: client.id),
            URLQueryItem(name: "redirect_uri", value: redirect),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: Self.scope),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: "consent"),
            URLQueryItem(name: "state", value: state),
        ]
        let url = components.url!
        await MainActor.run { _ = NSWorkspace.shared.open(url) }

        guard let query = await receiver.next() else { throw CancellationError() }
        if let error = query["error"] {
            throw AuthError.message("Google did not grant access (\(error)).")
        }
        guard query["state"] == state, let code = query["code"] else {
            throw AuthError.message("The sign-in response did not match this request.")
        }

        let token = try await tokenRequest([
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": verifier,
            "redirect_uri": redirect,
            "client_id": client.id,
            "client_secret": client.secret,
        ])
        guard let refresh = token.refresh_token else {
            throw AuthError.message("Google returned no refresh token. Try signing in again.")
        }
        Keychain.set(refresh, for: "refresh_token")
        access = (token.access_token, Date().addingTimeInterval(TimeInterval(token.expires_in)))
    }

    func signOut() {
        Keychain.set(nil, for: "refresh_token")
        access = nil
    }

    func token() async throws -> String {
        if let access, access.expires > Date().addingTimeInterval(60) { return access.token }
        guard let refresh = Keychain.get("refresh_token") else { throw AuthError.signedOut }
        let client = try credentials()
        let token = try await tokenRequest([
            "grant_type": "refresh_token",
            "refresh_token": refresh,
            "client_id": client.id,
            "client_secret": client.secret,
        ])
        access = (token.access_token, Date().addingTimeInterval(TimeInterval(token.expires_in)))
        return token.access_token
    }

    private struct TokenResponse: Decodable {
        let access_token: String
        let expires_in: Int
        let refresh_token: String?
    }

    private struct TokenFailure: Decodable {
        let error: String?
        let error_description: String?
    }

    private func tokenRequest(_ fields: [String: String]) async throws -> TokenResponse {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data(
            fields.map { "\(Self.formEncode($0.key))=\(Self.formEncode($0.value))" }
                .joined(separator: "&").utf8
        )
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            let failure = try? JSONDecoder().decode(TokenFailure.self, from: data)
            if failure?.error == "invalid_grant" {
                signOut()
                throw AuthError.signedOut
            }
            let detail = failure?.error_description ?? failure?.error ?? "unknown error"
            throw AuthError.message("Google token request failed: \(detail)")
        }
        return try JSONDecoder().decode(TokenResponse.self, from: data)
    }

    private static func formEncode(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    private static func randomToken() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return base64URL(Data(bytes))
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private final class Once: @unchecked Sendable {
    var done = false
}

/// One-shot HTTP listener on 127.0.0.1 that captures Google's redirect.
final class LoopbackReceiver {
    private let listener: NWListener
    private let queue = DispatchQueue(label: "earth.atrium.traffic.oauth")
    private let stream: AsyncStream<[String: String]>
    private let continuation: AsyncStream<[String: String]>.Continuation

    init() throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: .ipv4(.loopback), port: .any)
        listener = try NWListener(using: parameters)
        let pair = AsyncStream<[String: String]>.makeStream()
        stream = pair.stream
        continuation = pair.continuation
    }

    func start() async throws -> UInt16 {
        let listener = self.listener
        let continuation = self.continuation
        let queue = self.queue
        listener.newConnectionHandler = { connection in
            Self.serve(connection, on: queue, continuation: continuation)
        }
        return try await withCheckedThrowingContinuation { ready in
            let once = Once()
            listener.stateUpdateHandler = { state in
                guard !once.done else { return }
                switch state {
                case .ready:
                    once.done = true
                    ready.resume(returning: listener.port?.rawValue ?? 0)
                case .failed(let error):
                    once.done = true
                    ready.resume(throwing: error)
                case .cancelled:
                    once.done = true
                    ready.resume(throwing: CancellationError())
                default:
                    break
                }
            }
            listener.start(queue: queue)
        }
    }

    /// The redirect's query parameters, or nil if the wait was cancelled.
    func next() async -> [String: String]? {
        for await query in stream { return query }
        return nil
    }

    func stop() {
        listener.cancel()
        continuation.finish()
    }

    private static func serve(
        _ connection: NWConnection,
        on queue: DispatchQueue,
        continuation: AsyncStream<[String: String]>.Continuation
    ) {
        connection.start(queue: queue)
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { data, _, _, _ in
            let request = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            let target = request.split(separator: " ").dropFirst().first.map(String.init) ?? "/"
            var query: [String: String] = [:]
            for item in URLComponents(string: "http://127.0.0.1\(target)")?.queryItems ?? [] {
                query[item.name] = item.value ?? ""
            }
            let relevant = query["code"] != nil || query["error"] != nil
            let body = relevant
                ? "<!doctype html><meta charset=utf-8><title>Atrium Traffic</title>"
                    + "<body style=\"font:16px -apple-system;margin:20vh auto;max-width:28em;text-align:center\">"
                    + "<h2>Atrium Traffic is connected.</h2><p>You can close this tab.</p>"
                : ""
            let head = "HTTP/1.1 \(relevant ? "200 OK" : "404 Not Found")\r\n"
                + "Content-Type: text/html; charset=utf-8\r\n"
                + "Content-Length: \(body.utf8.count)\r\nConnection: close\r\n\r\n"
            connection.send(content: Data((head + body).utf8), completion: .contentProcessed { _ in
                connection.cancel()
            })
            if relevant { continuation.yield(query) }
        }
    }
}
