// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "AtriumTraffic",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(name: "AtriumTraffic", path: "Sources/AtriumTraffic")
    ]
)
