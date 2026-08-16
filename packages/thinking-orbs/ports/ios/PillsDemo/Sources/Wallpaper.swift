// The background artwork (Figma 2596:5237).
//
// Loaded from the bundle by URL rather than as Image("wallpaper"): the PNG
// ships as a loose resource, not an asset catalog, and the name-based
// initialiser silently rendered nothing — a black screen with no warning at
// build or run time.

import SwiftUI

enum Wallpaper {
    static let image: Image = {
        guard
            let url = Bundle.main.url(forResource: "wallpaper", withExtension: "png"),
            let ui = UIImage(contentsOfFile: url.path)
        else {
            assertionFailure("wallpaper.png missing from the bundle")
            return Image(systemName: "square.fill")
        }
        return Image(uiImage: ui)
    }()
}
