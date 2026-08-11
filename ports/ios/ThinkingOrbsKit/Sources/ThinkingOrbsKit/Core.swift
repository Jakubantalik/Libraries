// Shared primitives for the dotted 3D thought-orbs.
//
// Hand-transcribed from src/engine/core.ts. Every formula here must match
// the TypeScript exactly — OrbGoldenTests compares this package's output
// against spec/orbs-golden.json dot by dot, so a mistyped constant fails a
// test rather than shipping as a subtly wrong animation.
//
// Doubles throughout, deliberately: the golden vectors come from JavaScript
// numbers, which are IEEE-754 doubles. Using Float here would drift past the
// 1e-4 tolerance on the trig-heavy modes.

import Foundation

public struct Dot: Sendable {
    public var x: Double
    public var y: Double
    public var z: Double
    public var r: Double
    /// Ink value: 0 = darkest ink on paper. Mirrored on dark themes.
    public var white: Double
    public var a: Double

    public init(x: Double, y: Double, z: Double, r: Double, white: Double, a: Double = 1) {
        self.x = x; self.y = y; self.z = z; self.r = r; self.white = white; self.a = a
    }
}

/// A stroked edge between two projected points (the `connecting` web).
public struct Line: Sendable {
    public var x1: Double
    public var y1: Double
    public var x2: Double
    public var y2: Double
    public var white: Double
    public var a: Double
    public var w: Double
}

/// One rendered instant: a complete, final set of draw instructions.
/// `dots` is already z-sorted into draw order and radius-clamped; `lines`
/// are drawn first.
public struct OrbFrame: Sendable {
    public var dots: [Dot]
    public var lines: [Line]
}

/// Deterministic hash in [0, 1).
@inlinable
func hashD(_ a: Double, _ b: Double) -> Double {
    let h = sin(a * 12.9898 + b * 78.233) * 43758.5453
    return h - floor(h)
}

/// Value noise on a 2D lattice — smooth, deterministic, cheap.
@inlinable
func vnoise(_ x: Double, _ y: Double) -> Double {
    let xi = floor(x)
    let yi = floor(y)
    var fx = x - xi
    var fy = y - yi
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    let a = hashD(xi, yi)
    let b = hashD(xi + 1, yi)
    let c = hashD(xi, yi + 1)
    let d = hashD(xi + 1, yi + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/// Stable directions on a unit sphere (Fibonacci lattice).
@inlinable
func fibDir(_ i: Int, _ n: Int) -> (Double, Double, Double) {
    let golden = Double.pi * (3 - (5.0).squareRoot())
    let y = 1 - (2 * (Double(i) + 0.5)) / Double(n)
    let rad = (1 - y * y).squareRoot()
    let a = Double(i) * golden
    return (rad * cos(a), y, rad * sin(a))
}

/// Shortest signed angular distance, wrapped to (-π, π].
@inlinable
func angleDelta(_ a: Double, _ b: Double) -> Double {
    atan2(sin(a - b), cos(a - b))
}

@inlinable
func lerp(_ a: Double, _ b: Double, _ f: Double) -> Double { a + (b - a) * f }

@inlinable
func frac(_ x: Double) -> Double { x - floor(x) }

/// Shared spin + tilt + orthographic projection.
///
/// The TS version returns a closure; a struct is the Swift equivalent and
/// avoids an allocation per frame in the inner loops.
struct Projector {
    let st: Double, ct: Double, sy: Double, cyw: Double
    let cx: Double, cy: Double, scale: Double

    init(yaw: Double, tilt: Double, cx: Double, cy: Double, scale: Double) {
        self.st = sin(tilt); self.ct = cos(tilt)
        self.sy = sin(yaw); self.cyw = cos(yaw)
        self.cx = cx; self.cy = cy; self.scale = scale
    }

    @inlinable
    func callAsFunction(_ x: Double, _ y: Double, _ z: Double) -> (Double, Double, Double) {
        let x1 = x * cyw + z * sy
        let z1 = -x * sy + z * cyw
        let y1 = y * ct - z1 * st
        let z2 = y * st + z1 * ct
        return (cx + x1 * scale, cy - y1 * scale, z2)
    }
}

/// Dot radii were tuned for a 300pt frame; sub-linear scaling keeps small
/// spinners legible. Lower pow = radii shrink less with size.
@inlinable
func radiusScale(_ size: Double, pow p: Double) -> Double {
    Foundation.pow(size / 300, p)
}

/// Turn raw mode output into a finished frame: drop invisible marks, clamp
/// radii to the mode's floor, and z-sort far→near into draw order.
///
/// Sort note: JavaScript's Array.prototype.sort is stable (required since
/// ES2019) and Swift's `sort` is NOT, so ties would be free to reorder and
/// the golden comparison would fail on modes that emit co-planar dots
/// (`shaping` puts every dot at z = 0). Sorting by index as a tiebreaker
/// reproduces JS's stability exactly.
func finalizeFrame(_ dots: [Dot], _ lines: [Line], rMin: Double = 0.3) -> OrbFrame {
    var visible: [Dot] = []
    visible.reserveCapacity(dots.count)
    for var d in dots where d.a >= 0.02 {
        d.r = Swift.max(rMin, d.r)
        visible.append(d)
    }
    let sorted = visible.enumerated()
        .sorted { $0.element.z != $1.element.z ? $0.element.z < $1.element.z : $0.offset < $1.offset }
        .map(\.element)
    return OrbFrame(dots: sorted, lines: lines.filter { $0.a >= 0.02 })
}
