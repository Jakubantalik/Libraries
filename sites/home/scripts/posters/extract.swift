// First frame of every clip as a JPEG, via AVFoundation. Run by
// scripts/posters/build.sh; see there for the resize + LQIP step.
import AVFoundation
import AppKit

let args = CommandLine.arguments.dropFirst()
guard args.count == 2 else { fputs("usage: extract <in.mp4> <out.jpg>\n", stderr); exit(2) }
let src = URL(fileURLWithPath: args.first!), dst = URL(fileURLWithPath: args.last!)
let asset = AVURLAsset(url: src)
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
let cg = try gen.copyCGImage(at: .zero, actualTime: nil)
let rep = NSBitmapImageRep(cgImage: cg)
guard let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.95]) else { exit(1) }
try data.write(to: dst)
print("\(src.lastPathComponent) -> \(cg.width)x\(cg.height)")
