/**
 * Direct port of `presets/preset-pixels-style-4.json`.
 * Pixel renderer + Nebula effect (mechanical / structured pixel mosaic).
 */
import type { EnginePreset } from './index';

export const PIXELS_MECHANIC: EnginePreset = {
  name: 'pixels-mechanic',
  modes: {
    dark: {
      theme: 'dark',
      effectIndex: 11,
      colors: ['#949494', '#2d2d2d', '#333333', '#3a3a3a', '#0b0b0b', '#060606', '#2f2f2f'],
      alphas: [1, 1, 1, 1, 1, 1, 1],
      cardBg: '#0f0f0f',
      dotMode: 1,
      pixelConfig: {
        cellSize: 0.22,
        gap: 0.14,
        dotOpacity: 0.68,
        dotSize: 0.8,
        dotSoftness: 0.1,
        hlScale: 0.8,
        fillOpacity: 0.44,
        edgeFade: 24,
        fadeStr: 1
      },
      dotConfig: {
        cellSize: 0.58,
        gap: 0,
        dotOpacity: 1,
        dotSize: 0.22,
        dotSoftness: 0.1,
        hlScale: 0.26,
        fillOpacity: 0,
        edgeFade: 34,
        fadeStr: 0.34
      },
      direction: 0,
      speed: 0.7,
      intensity: 1,
      scale: 1.4,
      softness: 0.76,
      distortion: 0.3,
      flicker: 0.5,
      complexity: 0.2,
      shape: 0.52,
      blur: 1,
      highlight: 0.32,
      vignette: 0.26,
      vigOpacity: 1,
      shaderOpacity: 1,
      revealConfig: {
        duration: 3,
        easing: 'easeOutCubic',
        maskShape: 'shaderColor4',
        softness: 0.5,
        blur: 0,
        pixDuration: 2.65,
        pixEasing: 'easeOutCubic',
        dotDuration: 2.05,
        dotEasing: 'easeOutCubic'
      },
      effect: 'Nebula'
    },
    light: {
      theme: 'light',
      effectIndex: 11,
      colors: ['#e0e0e0', '#fdfdfd', '#f2f2f2', '#0a0a0a', '#dcdcdc', '#f5f5f5', '#f5f5f5'],
      alphas: [1, 1, 1, 1, 1, 1, 1],
      cardBg: '#f5f5f5',
      dotMode: 1,
      pixelConfig: {
        cellSize: 0.22,
        gap: 0.14,
        dotOpacity: 0.68,
        dotSize: 0.8,
        dotSoftness: 0.1,
        hlScale: 0.8,
        fillOpacity: 0.18,
        edgeFade: 20,
        fadeStr: 1
      },
      dotConfig: {
        cellSize: 0.58,
        gap: 0,
        dotOpacity: 1,
        dotSize: 0.22,
        dotSoftness: 0.1,
        hlScale: 0.26,
        fillOpacity: 0,
        edgeFade: 34,
        fadeStr: 0.34
      },
      direction: 25,
      speed: 0.55,
      intensity: 0.85,
      scale: 0.9,
      softness: 0.76,
      distortion: 0.3,
      flicker: 0.5,
      complexity: 0.2,
      shape: 0.52,
      blur: 1,
      highlight: 0.92,
      vignette: 0,
      vigOpacity: 0,
      shaderOpacity: 1,
      revealConfig: {
        duration: 3,
        easing: 'easeOutCubic',
        maskShape: 'shaderColor3',
        softness: 0.5,
        blur: 0,
        pixDuration: 2.6,
        pixEasing: 'easeOutCubic',
        dotDuration: 2.05,
        dotEasing: 'easeOutCubic'
      },
      effect: 'Nebula'
    }
  }
};
