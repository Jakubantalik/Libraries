// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "BorderBeamKit",
    platforms: [
        .iOS(.v17),
        // macOS 14 ships the same SwiftUI Shader APIs; kept so the package can
        // be type-checked and previewed on Mac during development.
        .macOS(.v14),
    ],
    products: [
        .library(name: "BorderBeamKit", targets: ["BorderBeamKit"])
    ],
    targets: [
        .target(
            name: "BorderBeamKit",
            resources: [
                .copy("Resources/beam-spec.json"),
                // Compiled into the bundle's default.metallib by Xcode's build
                // system (SwiftPM alone leaves it uncompiled — build the
                // package via Xcode for the shaders to work).
                .process("BeamShaders.metal"),
            ]
        ),
        .testTarget(
            name: "BorderBeamKitTests",
            dependencies: ["BorderBeamKit"]
        ),
    ]
)
