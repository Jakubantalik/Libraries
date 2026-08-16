// Geometry cost per frame. Canvas rasterisation is on top of this, but the
// dot loop is the part we control, and it is the part that would scale badly
// if a mode's density were pushed.
//
// Budget: a 60 fps frame is 16.6 ms. Anything here in the tens of
// microseconds means several orbs can share a screen without trouble.

import XCTest
@testable import ThinkingOrbsKit

final class OrbPerformanceTests: XCTestCase {
    func testFrameBuildCost() {
        let cases: [(OrbState, OrbSize)] = [
            (.composing, .px64),  // 566 dots — the heaviest
            (.working, .px64),    // 516
            (.breathing, .px64),  // 484
            (.searching, .px64),  // 204
            (.connecting, .px64), // dots + line pass
            (.shaping, .px20)     // the lightest
        ]
        print("state         size  dots  lines   µs/frame")
        for (state, size) in cases {
            let preset = resolvePreset(state, size)
            let sample = orbFrame(preset, size: size.value, t: 0.6)
            // warm up
            for i in 0..<200 { _ = orbFrame(preset, size: size.value, t: Double(i) * 0.016) }
            let n = 2000
            let t0 = DispatchTime.now().uptimeNanoseconds
            for i in 0..<n { _ = orbFrame(preset, size: size.value, t: Double(i) * 0.016) }
            let us = Double(DispatchTime.now().uptimeNanoseconds - t0) / 1000.0 / Double(n)
            print(String(format: "%@ %5d %5d %6d %10.1f",
                         state.rawValue.padding(toLength: 12, withPad: " ", startingAt: 0),
                         size.rawValue, sample.dots.count, sample.lines.count, us))
            // generous ceiling: 4 ms would still be a quarter of a frame
            XCTAssertLessThan(us, 4000, "\(state.rawValue) @\(size.rawValue) frame build too slow")
        }
    }
}
