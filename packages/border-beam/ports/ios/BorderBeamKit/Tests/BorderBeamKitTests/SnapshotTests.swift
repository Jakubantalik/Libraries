#if canImport(AppKit)
import AppKit
import SwiftUI
import Testing
@testable import BorderBeamKit

/// Renders every beam type × color variant × theme to PNGs through the real
/// SwiftUI + Metal pipeline, so frames can be diffed against the web demo
/// (PORT_PLAN.md Phase 3).
///
/// `ImageRenderer` does execute `colorEffect` Metal shaders, but it never
/// delivers `onAppear` — hence `\.beamFrozenTime`, which pins a deterministic
/// frame at full opacity.
///
/// Requires the Metal library, so run under Xcode:
///   DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
///   xcodebuild test -scheme BorderBeamKit -destination 'platform=macOS'
///
/// Output: $BEAM_SNAPSHOT_DIR (defaults to a temp dir; path is printed).
@MainActor
struct SnapshotTests {
    static let cardSize = CGSize(width: 348, height: 122)
    static let cardRadius: Double = 20

    /// Freeze time per family, chosen so each lands on a fully-visible frame.
    ///
    /// `line` must sit between 32.5% and 67.5% of its cycle — outside that its
    /// `edgeFade` keyframe ramps the whole effect toward zero, so an arbitrary
    /// time can capture a legitimately near-invisible beam.
    static func frozenTime(for size: BeamSize) -> Double {
        switch size {
        case .sm, .md: return 0.49            // 25% of the 1.96 s rotation
        case .line: return 3.1 * 0.5          // mid-travel, edgeFade == 1
        case .pulseInner, .pulseOutside: return 0.8
        }
    }

    static var outputDir: URL {
        let env = ProcessInfo.processInfo.environment["BEAM_SNAPSHOT_DIR"]
        let dir = env.map { URL(fileURLWithPath: $0) }
            ?? FileManager.default.temporaryDirectory.appendingPathComponent("beam-snapshots")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// A card mimicking the web demo's surface, wrapped in the beam.
    @ViewBuilder
    static func card(
        size: BeamSize, variant: BeamColorVariant, theme: BeamTheme, active: Bool = true
    ) -> some View {
        let isDark = theme != .light
        BorderBeam(
            size: size,
            colorVariant: variant,
            theme: theme,
            active: active,
            borderRadius: cardRadius
        ) {
            RoundedRectangle(cornerRadius: cardRadius)
                .fill(isDark ? Color(white: 0.094) : Color(white: 0.97))
                .overlay(
                    RoundedRectangle(cornerRadius: cardRadius)
                        .strokeBorder(isDark ? Color(white: 0.24) : Color(white: 0.85), lineWidth: 1)
                )
                .frame(width: cardSize.width, height: cardSize.height)
        }
    }

    /// Renders one combination onto a demo-like background and returns the PNG.
    /// `active: false` yields the beam-off reference used for blank detection.
    static func render(
        size: BeamSize, variant: BeamColorVariant, theme: BeamTheme, active: Bool = true
    ) -> Data? {
        let isDark = theme != .light
        // Padding leaves room for pulse-outside's halo, which spills outward.
        let pad: CGFloat = 60
        let scene = ZStack {
            (isDark ? Color(white: 0.027) : Color(white: 1.0))
            card(size: size, variant: variant, theme: theme, active: active)
        }
        .frame(
            width: cardSize.width + pad * 2,
            height: cardSize.height + pad * 2
        )
        .environment(\.beamFrozenTime, frozenTime(for: size))
        .environment(\.colorScheme, isDark ? .dark : .light)

        let renderer = ImageRenderer(content: scene)
        renderer.scale = 2
        guard let img = renderer.nsImage,
              let tiff = img.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff)
        else { return nil }
        return rep.representation(using: .png, properties: [:])
    }

    @Test func rendersFullMatrix() throws {
        let dir = Self.outputDir
        var written = 0
        var blank: [String] = []

        for size in BeamSize.allCases {
            for variant in BeamColorVariant.allCases {
                for theme: BeamTheme in [.dark, .light] {
                    let name = "\(size.rawValue)_\(variant.rawValue)_\(theme.rawValue).png"
                    let png = try #require(
                        Self.render(size: size, variant: variant, theme: theme),
                        "render returned nil for \(name)"
                    )
                    try png.write(to: dir.appendingPathComponent(name))
                    written += 1
                    // Compare against the same card with the beam switched off.
                    // Diffing (rather than looking for color) is what makes the
                    // greyscale `mono` variant detectable at all.
                    let off = try #require(
                        Self.render(size: size, variant: variant, theme: theme, active: false),
                        "beam-off render returned nil for \(name)"
                    )
                    if !Self.differs(png, off) { blank.append(name) }
                }
            }
        }

        print("SNAPSHOT_DIR=\(dir.path)")
        print("SNAPSHOT_COUNT=\(written)")
        if !blank.isEmpty {
            print("SNAPSHOT_BLANK=\(blank.joined(separator: ","))")
        }
        #expect(written == BeamSize.allCases.count * BeamColorVariant.allCases.count * 2)
        #expect(blank.isEmpty, "these combinations rendered no beam: \(blank)")
    }

    /// True when two renders differ measurably — i.e. the beam painted
    /// something. Works for greyscale (`mono`) as well as colored variants.
    static func differs(_ a: Data, _ b: Data) -> Bool {
        guard let ra = NSBitmapImageRep(data: a), let rb = NSBitmapImageRep(data: b),
              ra.pixelsWide == rb.pixelsWide, ra.pixelsHigh == rb.pixelsHigh
        else { return false }
        var changed = 0
        let stepX = max(1, ra.pixelsWide / 160)
        let stepY = max(1, ra.pixelsHigh / 160)
        for x in stride(from: 0, to: ra.pixelsWide, by: stepX) {
            for y in stride(from: 0, to: ra.pixelsHigh, by: stepY) {
                guard let ca = ra.colorAt(x: x, y: y), let cb = rb.colorAt(x: x, y: y) else { continue }
                let d = abs(ca.redComponent - cb.redComponent)
                    + abs(ca.greenComponent - cb.greenComponent)
                    + abs(ca.blueComponent - cb.blueComponent)
                if d > 0.01 { changed += 1 }
            }
        }
        return changed > 5
    }
}
#endif
