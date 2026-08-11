// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ThinkingOrbsKit",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "ThinkingOrbsKit", targets: ["ThinkingOrbsKit"])
    ],
    targets: [
        .target(name: "ThinkingOrbsKit"),
        .testTarget(
            name: "ThinkingOrbsKitTests",
            dependencies: ["ThinkingOrbsKit"]
        )
    ]
)
