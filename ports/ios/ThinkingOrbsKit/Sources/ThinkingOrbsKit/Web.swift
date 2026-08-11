// Web: a constellation wires itself — the "connecting" state. Nodes drift
// on the sphere under slow value noise; any pair closer than `thr` grows an
// edge, and bright packets run along randomly re-picked node pairs.
// Transcribed from src/engine/web.ts.

import Foundation

func frameWeb(_ size: Double, _ t: Double, _ o: [String: Double]) -> OrbFrame {
    let cx = size / 2
    let cy = size / 2
    let R = (size / 2) * 0.8 * (o["spread"] ?? 1)
    // note the projector carries the radius as its scale, so node vectors stay
    // unit-length and distances below are in unit-sphere space
    let pt = Projector(yaw: t * 0.12, tilt: 0.32, cx: cx, cy: cy, scale: R)
    let rs = radiusScale(size, pow: o["rsPow"] ?? 0.6)

    let nodeN = Int(o["nodeN"] ?? 30)
    let thr = o["thr"] ?? 0.72
    let nodeR = o["nodeR"] ?? 1.4
    let nodeRDepth = o["nodeRDepth"] ?? 1.8

    // nodes: fib lattice + slow noise wander, renormalised to the surface
    var nodes: [(Double, Double, Double)] = []
    nodes.reserveCapacity(nodeN)
    for i in 0..<nodeN {
        let d = fibDir(i, nodeN)
        let x = d.0 + 0.3 * (vnoise(Double(i) * 0.31 + 9, t * 0.24) - 0.5) * 2
        let y = d.1 + 0.3 * (vnoise(Double(i) * 0.53 + 27, t * 0.21) - 0.5) * 2
        let z = d.2 + 0.3 * (vnoise(Double(i) * 0.77 + 55, t * 0.27) - 0.5) * 2
        let l = (x * x + y * y + z * z).squareRoot()
        nodes.append((x / l, y / l, z / l))
    }

    var lines: [Line] = []
    var dots: [Dot] = []

    // edges between close neighbours, alpha by proximity + depth
    for i in 0..<nodeN {
        for j in (i + 1)..<nodeN {
            let dx = nodes[i].0 - nodes[j].0
            let dy = nodes[i].1 - nodes[j].1
            let dz = nodes[i].2 - nodes[j].2
            let dist = (dx * dx + dy * dy + dz * dz).squareRoot()
            if dist >= thr { continue }
            let (x1, y1, z1) = pt(nodes[i].0, nodes[i].1, nodes[i].2)
            let (x2, y2, z2) = pt(nodes[j].0, nodes[j].1, nodes[j].2)
            let depth = ((z1 + z2) / 2 + 1) / 2
            lines.append(Line(
                x1: x1, y1: y1, x2: x2, y2: y2,
                white: 0.42,
                a: (1 - dist / thr) * (0.3 + 0.55 * depth),
                w: Swift.max(0.6, (o["lineW"] ?? 0.8) * rs)
            ))
        }
    }

    for i in 0..<nodeN {
        let (px, py, z) = pt(nodes[i].0, nodes[i].1, nodes[i].2)
        let depth = (z + 1) / 2
        let pulse = 1 + 0.25 * sin(t * 1.4 + Double(i) * 2.7)
        dots.append(Dot(
            x: px, y: py, z: z,
            r: (nodeR + nodeRDepth * depth) * pulse * rs,
            white: 0.55 - 0.45 * depth
        ))
    }

    // signals: bright packets running between paired nodes
    let signals = Int(o["signals"] ?? 5)
    for s in 0..<signals {
        let seg = floor(t * 0.55 + Double(s) * 7.31)
        let a = Int(floor(hashD(seg, Double(s) * 3.1 + 1.7) * Double(nodeN)))
        let b = Int(floor(hashD(seg, Double(s) * 5.7 + 4.2) * Double(nodeN)))
        if a == b { continue }
        let f = frac(t * 0.55 + Double(s) * 7.31)
        let x = lerp(nodes[a].0, nodes[b].0, f)
        let y = lerp(nodes[a].1, nodes[b].1, f)
        let z = lerp(nodes[a].2, nodes[b].2, f)
        let l = Swift.max(1e-6, (x * x + y * y + z * z).squareRoot())
        let (px, py, zr) = pt(x / l, y / l, z / l)
        let depth = (zr + 1) / 2
        dots.append(Dot(
            x: px, y: py, z: zr,
            r: (nodeR * 1.5 + nodeRDepth * depth) * rs,
            white: 0.05,
            a: 0.5 + 0.5 * depth
        ))
    }

    return finalizeFrame(dots, lines, rMin: o["rMin"] ?? 0.3)
}
