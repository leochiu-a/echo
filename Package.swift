// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Echo",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "Echo", targets: ["Echo"])
    ],
    dependencies: [
        .package(url: "https://github.com/swiftlang/swift-testing.git", from: "0.7.0")
    ],
    targets: [
        .executableTarget(
            name: "Echo",
            path: "Sources/Echo"
        ),
        .testTarget(
            name: "EchoTests",
            dependencies: [
                "Echo",
                .product(name: "Testing", package: "swift-testing")
            ],
            path: "Tests/EchoTests"
        )
    ]
)
