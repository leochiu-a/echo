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
    dependencies: [
        .package(url: "https://github.com/swiftlang/swift-testing.git", from: "0.7.0")
    ],
    targets: [
        .executableTarget(
            name: "EchoCopilot",
            path: "Sources/EchoCopilot"
        ),
        .testTarget(
            name: "EchoCopilotTests",
            dependencies: [
                "EchoCopilot",
                .product(name: "Testing", package: "swift-testing")
            ],
            path: "Tests/EchoCopilotTests"
        )
    ]
)
