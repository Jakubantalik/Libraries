// Morph: a dotted outline cycling circle → triangle → square → circle —
// the "shaping" state. Each shape is a continuous closed path parameterised
// by arc length (top-centre start, clockwise). Every frame the engine blends
// the two neighbouring paths, then lays the dots EVENLY along the blended
// outline. Transcribed from src/engine/morph.ts.

import Foundation

private func smoothE(_ x: Double) -> Double { x * x * (3 - 2 * x) }

private struct PolyPath {
    let verts: [(Double, Double)]
    let segLengths: [Double]
    let total: Double

    init(_ verts: [(Double, Double)]) {
        self.verts = verts
        var L: [Double] = []
        var sum = 0.0
        for i in 0..<verts.count {
            let a = verts[i]
            let b = verts[(i + 1) % verts.count]
            let l = ((b.0 - a.0) * (b.0 - a.0) + (b.1 - a.1) * (b.1 - a.1)).squareRoot()
            L.append(l)
            sum += l
        }
        self.segLengths = L
        self.total = sum
    }

    func point(_ f: Double) -> (Double, Double) {
        var target = f * total
        var i = 0
        while target > segLengths[i] && i < verts.count - 1 {
            target -= segLengths[i]
            i += 1
        }
        let a = verts[i]
        let b = verts[(i + 1) % verts.count]
        let ff = segLengths[i] != 0 ? Swift.min(1, target / segLengths[i]) : 0
        return (a.0 + (b.0 - a.0) * ff, a.1 + (b.1 - a.1) * ff)
    }
}

private enum Shape {
    case circle
    case poly(PolyPath)

    func point(_ f: Double) -> (Double, Double) {
        switch self {
        case .circle:
            let a = -Double.pi / 2 + f * 2 * Double.pi
            return (cos(a) * 0.24, sin(a) * 0.24)
        case .poly(let p):
            return p.point(f)
        }
    }
}

private let TRIANGLE = PolyPath([(0.0, -0.26), (0.24, 0.16), (-0.24, 0.16)])
// 5-vertex walk so the path STARTS at top-centre like the other shapes
private let SQUARE = PolyPath([(0, -0.2), (0.2, -0.2), (0.2, 0.2), (-0.2, 0.2), (-0.2, -0.2)])
private let CYCLE: [Shape] = [.circle, .poly(TRIANGLE), .poly(SQUARE)]

// low floor keeps sparse outlines possible while never degenerating
private func morphN(_ d: Double) -> Int {
    Swift.max(6, Int((34 * d).rounded(.toNearestOrAwayFromZero)))
}

private let HOLD = 1.4
private let MORPH = 0.9
private let SEG = HOLD + MORPH

func frameMorph(_ size: Double, _ t: Double, _ o: [String: Double]) -> OrbFrame {
    let K = CYCLE.count
    let tc = t.truncatingRemainder(dividingBy: SEG * Double(K))
    let k = Int(floor(tc / SEG))
    let local = tc - Double(k) * SEG
    let m = local > HOLD ? smoothE((local - HOLD) / MORPH) : 0
    let sprd = o["spread"] ?? 1

    // blend the two shape PATHS at m, then measure the blended outline
    let pA = CYCLE[k]
    let pB = CYCLE[(k + 1) % K]
    let M = 160
    var pts: [(Double, Double)] = []
    pts.reserveCapacity(M)
    for i in 0..<M {
        let f = Double(i) / Double(M)
        let a = pA.point(f)
        let b = pB.point(f)
        pts.append(((a.0 + (b.0 - a.0) * m) * sprd, (a.1 + (b.1 - a.1) * m) * sprd))
    }
    var L: [Double] = []
    L.reserveCapacity(M)
    var total = 0.0
    for i in 0..<M {
        let a = pts[i]
        let b = pts[(i + 1) % M]
        let l = ((b.0 - a.0) * (b.0 - a.0) + (b.1 - a.1) * (b.1 - a.1)).squareRoot()
        L.append(l)
        total += l
    }

    // dot radius depends ONLY on rDot (the size knob); the count sets the
    // gaps. Formed shapes breathe a little (uniform pulse).
    let n = morphN(o["iconD"] ?? 1)
    let re = (o["rDot"] ?? 0.021) * 1.35 * sprd
    let pulse = 1 + 0.02 * sin(local * 3.1)

    var dots: [Dot] = []
    dots.reserveCapacity(n)
    let c2 = size / 2
    var seg = 0
    var acc = 0.0
    for k2 in 0..<n {
        let target = (Double(k2) / Double(n)) * total
        while acc + L[seg] < target && seg < M - 1 {
            acc += L[seg]
            seg += 1
        }
        let a = pts[seg]
        let b = pts[(seg + 1) % M]
        let f = L[seg] != 0 ? Swift.min(1, (target - acc) / L[seg]) : 0
        let x = (a.0 + (b.0 - a.0) * f) * pulse
        let y = (a.1 + (b.1 - a.1) * f) * pulse
        dots.append(Dot(
            x: c2 + x * size,
            y: c2 + y * size,
            z: 0,
            r: Swift.max(0.35, re * size),
            white: 0.1
        ))
    }
    return finalizeFrame(dots, [], rMin: o["rMin"] ?? 0.3)
}
