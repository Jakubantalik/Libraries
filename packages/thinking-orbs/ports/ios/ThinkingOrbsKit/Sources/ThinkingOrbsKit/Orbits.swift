// Orbits: particles on tilted orbits — the "working" state. No nucleus
// (the tuned preset runs coreless): just ghost paths and the particles
// doing the work. Transcribed from src/engine/orbits.ts.

import Foundation

func frameOrbits(_ size: Double, _ t: Double, _ o: [String: Double]) -> OrbFrame {
    let cx = size / 2
    let cy = size / 2
    let R = (size / 2) * 0.82
    let pt = Projector(yaw: t * 0.12, tilt: 0.3, cx: cx, cy: cy, scale: 1)
    let rs = radiusScale(size, pow: o["rsPow"] ?? 0.6)

    var dots: [Dot] = []
    let orbitN = Int(o["orbitN"] ?? 12)
    let ghostN = Int(o["ghostN"] ?? 40)
    let particles = Int(o["particles"] ?? 3)

    // orbits: each a tilted circle — a ghost path + running particles
    for orb in 0..<orbitN {
        let h1 = hashD(Double(orb), 1.7)
        let h2 = hashD(Double(orb), 5.2)
        let h3 = hashD(Double(orb), 8.9)
        let ro = R * (0.45 + 0.52 * h1)
        let th = h1 * 2 * Double.pi
        let phi = acos(2 * h2 - 1)
        // orbit plane basis (u, v ⟂ normal n)
        let nx = sin(phi) * cos(th)
        let ny = cos(phi)
        let nz = sin(phi) * sin(th)
        var ux = -ny
        var uy = nx
        let uz = 0.0
        let ul = Swift.max(1e-6, (ux * ux + uy * uy).squareRoot())
        ux /= ul
        uy /= ul
        let vx = ny * uz - nz * uy
        let vy = nz * ux - nx * uz
        let vz = nx * uy - ny * ux
        let speed = (0.25 + 0.55 * h3) * (h3 > 0.5 ? 1 : -1)

        // ghost path
        for k in 0..<ghostN {
            let a = (Double(k) / Double(ghostN)) * 2 * Double.pi
            let (px, py, z) = pt(
                (ux * cos(a) + vx * sin(a)) * ro,
                (uy * cos(a) + vy * sin(a)) * ro,
                (uz * cos(a) + vz * sin(a)) * ro
            )
            let depth = (z / ro + 1) / 2
            dots.append(Dot(
                x: px, y: py, z: z,
                r: (o["ghostR"] ?? 0.9) * rs,
                white: 0.72,
                a: (o["ghostA"] ?? 0.5) * (0.4 + 0.6 * depth)
            ))
        }
        // the particles doing the work
        for m in 0..<particles {
            let a = t * speed + (Double(m) / Double(particles)) * 2 * Double.pi + h2 * 6
            let (px, py, z) = pt(
                (ux * cos(a) + vx * sin(a)) * ro,
                (uy * cos(a) + vy * sin(a)) * ro,
                (uz * cos(a) + vz * sin(a)) * ro
            )
            let depth = (z / ro + 1) / 2
            dots.append(Dot(
                x: px, y: py, z: z,
                r: ((o["partR"] ?? 1.2) + (o["partRDepth"] ?? 1.6) * depth) * rs,
                white: 0.3 - 0.22 * depth
            ))
        }
    }
    return finalizeFrame(dots, [], rMin: o["rMin"] ?? 0.3)
}
