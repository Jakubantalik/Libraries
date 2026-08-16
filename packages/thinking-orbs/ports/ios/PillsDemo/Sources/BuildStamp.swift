// Which build am I actually looking at?
//
// Taken from the app binary's own modification date, so it needs no build
// phase and cannot drift: an install from an older build physically carries
// an older executable. This exists because a stale install on the device
// looked exactly like a regression in the code.

import Foundation

enum BuildStamp {
    /// e.g. "Aug 14 20:41" — shown in the TUNE chip.
    static let short: String = {
        guard
            let url = Bundle.main.executableURL,
            let date = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?
                .contentModificationDate
        else { return "?" }
        let f = DateFormatter()
        f.dateFormat = "MMM d HH:mm"
        return f.string(from: date)
    }()
}
