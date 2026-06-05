# Changelog

## 1.1.0

### Changed
- Retuned the `pulse-outside` and `pulse-inner` presets to match the latest prototype values (opacities, brightness/saturation, glow/bloom blur, drift, and glow sizing).
- `pulse-outside` no longer paints its own idle hairline (`hairlineOpacity` defaults to `0`). The colored stroke now rides directly on the wrapped element's own 1px border instead of doubling it, matching the prototype's single-hairline look.

### Fixed
- `pulse-inner` bloom alignment: the bloom ring used a 2px padding while the stroke used 1px, so the bloom sat 1px further inward than the stroke. Both now share the same 1px edge ring.

### Performance
- The pulse breathing motion is driven from a single shared, ~30fps `requestAnimationFrame` loop (`pulseDriver.ts`) instead of per-instance CSS `@property` keyframes. This reduces repaint frequency, works without `@property` support, and pauses automatically when the instance is inactive, offscreen, or the user prefers reduced motion.

## 1.0.1

- Initial published release with `sm`, `md`, `line`, `pulse-inner`, and `pulse-outside` types.
