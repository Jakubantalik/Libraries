/**
 * Direct port of `presets/preset-pixels-style-3.json`.
 * Pixel renderer + Chromium Flow effect (organic chrome ridges).
 */
import type { EnginePreset } from './index';

export const PIXELS_ORGANIC: EnginePreset = {
  name: 'pixels-organic',
  modes: {
    dark: {
      theme: 'dark',
      effectIndex: 22,
      colors: ['#0f0f0f', '#4a4949', '#b9b9b9', '#0f0f0f', '#d8d8d8', '#0f0f0f', '#2f2f2f'],
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
      speed: 0.3,
      intensity: 1,
      scale: 1,
      softness: 0.76,
      distortion: 0.3,
      complexity: 0.2,
      shape: 0.52,
      blur: 1,
      highlight: 0.2,
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
      effect: 'Chromium Flow'
    },
    light: {
      theme: 'light',
      effectIndex: 22,
      colors: ['#e3e3e3', '#ffffff', '#f5f5f5', '#f5f5f5', '#080808', '#f5f5f5', '#f5f5f5'],
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
      speed: 0.3,
      intensity: 0.85,
      scale: 1,
      softness: 0.76,
      distortion: 0.3,
      complexity: 0.2,
      shape: 0.52,
      blur: 1,
      highlight: 0.7,
      vignette: 0,
      vigOpacity: 0,
      shaderOpacity: 1,
      revealConfig: {
        duration: 3,
        easing: 'easeOutCubic',
        maskShape: 'shaderColor4',
        softness: 0.5,
        blur: 0,
        pixDuration: 2.55,
        pixEasing: 'easeOutCubic',
        dotDuration: 2.05,
        dotEasing: 'easeOutCubic'
      },
      effect: 'Chromium Flow'
    }
  }
};
