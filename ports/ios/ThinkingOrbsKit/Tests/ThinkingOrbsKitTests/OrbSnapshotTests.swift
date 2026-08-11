// Writes PNG captures of every (state × size × theme) at the frozen
// timestamps the web harness uses, for cross-platform pixel diffing.
//
// A test rather than a standalone executable: XCTest already builds the
// package for the host platform and gives a @MainActor context, which
// ImageRenderer requires. `snapshot.sh` just runs this filter.

import XCTest
@testable import ThinkingOrbsKit

@available(iOS 16.0, macOS 13.0, *)
final class OrbSnapshotTests: XCTestCase {
    /// Must match demo/parity.ts on the web side.
    static let times = [0.6, 1.7, 3.3, 5.1]

    @MainActor
    func testWriteSnapshots() throws {
        // opt-in: only runs when snapshot.sh sets the output directory
        guard let outDir = ProcessInfo.processInfo.environment["ORB_SNAPSHOT_DIR"] else {
            throw XCTSkip("set ORB_SNAPSHOT_DIR to capture (see snapshot.sh)")
        }
        let dir = URL(fileURLWithPath: outDir)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        var written = 0
        var empty: [String] = []
        for state in OrbState.allCases {
            for size in OrbSize.allCases {
                for dark in [true, false] {
                    for t in Self.times {
                        let name = "\(state.rawValue)-\(size.rawValue)-\(dark ? "d" : "l")-\(t).png"
                        guard let data = OrbSnapshot.png(state: state, size: size, dark: dark, t: t) else {
                            XCTFail("render failed: \(name)")
                            continue
                        }
                        // A blank capture is the failure mode this harness is
                        // most likely to hit (frozen time not applied, view
                        // never laid out), and it would otherwise diff as a
                        // passing "no difference" against nothing.
                        if data.count < 200 { empty.append(name) }
                        try data.write(to: dir.appendingPathComponent(name))
                        written += 1
                    }
                }
            }
        }
        XCTAssertTrue(empty.isEmpty, "suspiciously small PNGs: \(empty.prefix(5))")
        print("wrote \(written) snapshots to \(outDir)")
    }
}
