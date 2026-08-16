// Asserts the hand-transcribed Swift engine reproduces the TypeScript
// engine's geometry exactly, dot by dot, against spec/orbs-golden.json.
//
// This is the safety net that makes transcribing ~940 lines of math by hand
// a reasonable thing to do at all: a mistyped constant or a sign error fails
// here with the exact case and field, instead of shipping as an animation
// that merely looks a bit off.
//
// Why dots are compared as a multiset plus a z-monotonicity assertion,
// rather than position by position:
//
// `breathing` at 64pt has an odd lane count, so its centre lane sits exactly
// on the view plane and its z is mathematically zero — computed as
// `y·sin(tilt) + z₁·cos(tilt)` where the two terms cancel. That cancellation
// is not exact in floating point, so those 44 dots land on ±1e-17 noise
// instead of 0, and the sign of the noise depends on how each platform's
// libm evaluates sin/cos. JavaScript and Swift therefore z-sort that group
// into different orders.
//
// Verified: the two engines produce an IDENTICAL multiset of dots (checked
// independently, zero difference) — only the order within that tie group
// differs. Every dot in it has depth 0.5 and therefore identical radius, ink
// and alpha, so the draw order among them cannot change a pixel. Array
// position is simply not part of the contract; "same dots, drawn far to
// near" is, and that is what this asserts.

import XCTest
@testable import ThinkingOrbsKit

private struct Golden: Decodable {
    struct Case: Decodable {
        let key: String
        let state: String
        let size: Int
        let mode: String
        let t: Double
        let dotCount: Int
        let lineCount: Int
        let dots: [Double]
        let lines: [Double]
    }
    let specVersion: String
    let tolerance: Double
    let cases: [Case]
}

final class OrbGoldenTests: XCTestCase {
    private func loadGolden() throws -> Golden {
        // Tests run from the package directory; the spec lives at the repo root.
        let here = URL(fileURLWithPath: #filePath)
        let repoRoot = here
            .deletingLastPathComponent()  // OrbGoldenTests.swift -> ThinkingOrbsKitTests
            .deletingLastPathComponent()  // Tests
            .deletingLastPathComponent()  // ThinkingOrbsKit
            .deletingLastPathComponent()  // ios
            .deletingLastPathComponent()  // ports
            .deletingLastPathComponent()  // thinking-orbs
        let url = repoRoot.appendingPathComponent("spec/orbs-golden.json")
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(Golden.self, from: data)
    }

    func testMatchesGoldenVectors() throws {
        let golden = try loadGolden()
        let tol = golden.tolerance
        var checked = 0
        var failures: [String] = []

        for c in golden.cases {
            guard let state = OrbState(rawValue: c.state), let size = OrbSize(rawValue: c.size) else {
                failures.append("\(c.key): unknown state/size")
                continue
            }
            let preset = resolvePreset(state, size)
            XCTAssertEqual(preset.mode.rawValue, c.mode, "\(c.key): mode")

            let frame = orbFrame(preset, size: Double(c.size), t: c.t)
            guard frame.dots.count == c.dotCount, frame.lines.count == c.lineCount else {
                failures.append(
                    "\(c.key): \(frame.dots.count)/\(frame.lines.count) dots/lines, expected \(c.dotCount)/\(c.lineCount)")
                continue
            }

            func cmp(_ label: String, _ actual: Double, _ expected: Double) {
                checked += 1
                if abs(actual - expected) > tol && failures.count < 25 {
                    failures.append("\(label): got \(actual), expected \(expected)")
                }
            }

            // Dots are compared as a canonical multiset rather than
            // positionally, because exact array position is a stronger claim
            // than the rendering contract actually makes — see below. Every
            // dot must still be present with every field correct.
            var mine: [[Double]] = frame.dots.map { [$0.x, $0.y, $0.z, $0.r, $0.white, $0.a] }
            var theirs: [[Double]] = (0..<c.dotCount).map { i in Array(c.dots[(i * 6)..<(i * 6 + 6)]) }
            // round to the golden file's precision first, so both sides sort
            // on the same grid — otherwise near-duplicate values sort
            // differently on either side and the comparison misaligns
            let q6: (Double) -> Double = { ($0 * 1_000_000).rounded() / 1_000_000 }
            mine = mine.map { $0.map(q6) }
            theirs = theirs.map { $0.map(q6) }
            let lex: ([Double], [Double]) -> Bool = { a, b in
                for i in 0..<a.count where a[i] != b[i] { return a[i] < b[i] }
                return false
            }
            mine.sort(by: lex)
            theirs.sort(by: lex)
            let fields = ["x", "y", "z", "r", "white", "a"]
            for i in 0..<mine.count {
                for f in 0..<6 { cmp("\(c.key) dot\(i).\(fields[f])", mine[i][f], theirs[i][f]) }
            }

            // The part of draw order that IS the contract: far to near.
            for i in 1..<frame.dots.count where frame.dots[i].z < frame.dots[i - 1].z {
                failures.append("\(c.key): dots not z-sorted at \(i)")
                break
            }
            for (i, l) in frame.lines.enumerated() {
                let b = i * 7
                cmp("\(c.key) line\(i).x1", l.x1, c.lines[b])
                cmp("\(c.key) line\(i).y1", l.y1, c.lines[b + 1])
                cmp("\(c.key) line\(i).x2", l.x2, c.lines[b + 2])
                cmp("\(c.key) line\(i).y2", l.y2, c.lines[b + 3])
                cmp("\(c.key) line\(i).white", l.white, c.lines[b + 4])
                cmp("\(c.key) line\(i).a", l.a, c.lines[b + 5])
                cmp("\(c.key) line\(i).w", l.w, c.lines[b + 6])
            }
        }

        if !failures.isEmpty {
            XCTFail("\(failures.count) mismatch(es) of \(checked) values:\n" + failures.joined(separator: "\n"))
        }
        print("golden: \(golden.cases.count) cases, \(checked) values within \(tol) (spec \(golden.specVersion))")
    }
}
