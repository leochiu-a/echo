// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "EchoCopilot",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "EchoCopilot", targets: ["EchoCopilot"])
    ],
    targets: [
        .executableTarget(
            name: "EchoCopilot",
            path: "Sources/EchoCopilot"
        )
    ]
)
