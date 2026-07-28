# Changelog

## 1.5.0

### Added
- `colors` prop (web) and `colors:` parameter (BorderBeamKit) for custom brand palettes ([#4](https://github.com/Jakubantalik/border-beam/issues/4)). Pass an ordered list of colors; they cycle through the default palette's gradient stops while all hand-tuned geometry and per-stop alphas are preserved. Takes precedence over `colorVariant` and always renders with static colors so brand hues stay exact.
- `customColors` section in `beam-spec.json` documenting the shared derivation rules (reference variant, forced static colors, line-bloom recolor map) so ports stay in sync.

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
