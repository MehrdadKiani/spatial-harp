<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./public/spatial-harp-icon-transparent.png">
    <source media="(prefers-color-scheme: light)" srcset="./public/spatial-harp-logo-card.png">
    <img src="./public/spatial-harp-logo-card.png" width="140" alt="Spatial Harp Logo" />
  </picture>
</p>

# 🎵 Spatial Harp

[![Version](https://img.shields.io/badge/version-0.1.3-0891b2.svg?style=flat-square)](./package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-38ef7d.svg?style=flat-square)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black.svg?style=flat-square)](https://threejs.org/)
[![Tone.js](https://img.shields.io/badge/Tone.js-WebAudio-orange.svg?style=flat-square)](https://tonejs.github.io/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-HandLandmarker-blueviolet.svg?style=flat-square)](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)

A real-time, browser-based **Augmented Reality Spatial Harp & Audio-Visual Instrument** powered by webcam hand tracking, Three.js WebGL rendering, and Web Audio/Tone.js synthesis. Built in pure **TypeScript** using a strictly modular, decoupled, zero-GC architecture.

---

## ✨ Features

- **Mirrored Low-Latency AR Tracking**: Processes 21 3D hand landmarks in real time with local WebAssembly (WASM) and SIMD acceleration.
- **Mid-Air Spatial String Anchoring**: Pinch your thumb and index fingers on both hands to spawn, stretch, and lock 3D laser-like strings in mid-air space.
- **Dual-Wave Resonant Visual Sheath**: Plucked strings oscillate with damped harmonic motion, dynamic wave envelopes, and contact shockwaves.
- **Polyphonic Physical Modeling Synthesis**: Karplus-Strong string synthesis, customizable polyphony, studio reverb, and feedback delay.
- **Sound Presets & Harmonic Scales**:
  - **Presets**: *Plucked Harp*, *Laser Synth*, *Ambient Chime*, *Retro 8-Bit*.
  - **Musical Scales**: *Pentatonic*, *Natural Minor*, *Hirajōshi*, *Major*, *Blues*.
- **Endpoint Re-Grab & Repositioning**: Pinch existing string anchors to reposition, rotate, or fine-tune strings in 3D space.
- **Glassmorphic Responsive UI**: Cyberpunk-inspired HUD, live FPS/system diagnostics, audio meters, and a 4-step interactive visual tutorial.
- **100% Offline & Private**: Zero cloud dependencies. Video frames are processed entirely on-device; no camera data is ever recorded, stored, or transmitted.

---

## 🎮 How to Play

1. **Pinch & Stretch**: Pinch your thumb and index finger on **both hands** simultaneously. An elastic holographic string appears connecting your hands.
2. **Anchor in Space**: Move your hands to position the string in 3D space, then **release both pinches** to lock the string in mid-air.
3. **Pluck to Play**: Swipe any fingertip across an anchored string. Velocity determines loudness, brightness, and particle burst intensity.
4. **Re-Grab & Adjust**: Pinch either endpoint reticle of an existing string to pick it back up, stretch it, or rotate its position.
5. **Clear / Reset**: Use the trash button in the top navigation bar to clear all active strings.

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Camera Stream                         │
│                              │                               │
│                              ▼                               │
│          MediaPipe HandLandmarker (Local WASM/SIMD)          │
│                              │                               │
│                              ▼                               │
│              Pinch Detection & Gesture Solver                │
│                              │                               │
│               ┌──────────────┴──────────────┐                │
│               ▼                             ▼                │
│      Three.js WebGL Scene            Tone.js Synthesis       │
│    (Strings, Waves, Sparks)       (Polyphonic Instruments)   │
└──────────────────────────────────────────────────────────────┘
```

The codebase follows strict architectural separation:
```
src/
├── vision/       # Camera capture, MediaPipe HandLandmarker abstraction, smoothing filters
├── gestures/     # Pinch detection, dual-hand coordinator, string collision solver
├── instruments/  # 3D spatial strings, anchor state management, frets & rulers
├── audio/        # Web Audio / Tone.js synthesis engine, sound presets, harmonic scales
├── render/       # Three.js scene, video background, wave oscillation, spark particles
├── core/         # EventBus, RAF ticker loop, typed configuration loader
├── ui/           # Glassmorphic HUD, navigation bar, sound studio, tutorial modal
└── types/        # Strict TypeScript contracts and environment interfaces
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- A modern browser with webcam access (Chrome, Edge, Safari, Firefox)

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/your-username/spatial-harp.git
cd spatial-harp

# Install dependencies
npm install

# Start local development server (http://localhost:3000)
npm run dev

# Run automated unit test suite
npm test

# Run TypeScript checks and production build
npm run build

# Preview production build locally
npm run preview
```

### 🏷️ Deploying to Production & Releasing

When ready to ship changes from `main` to production:

```bash
# 1. Bump version
npm version patch -m "chore(release): v%s"

# 2. Merge main into release and push
git checkout release
git pull
git merge main
git push
```

Pushes to `release` automatically trigger:
- **Vercel Production Deployment**: Rebuilds and updates the live site.
- **GitHub Actions Tag & Release**: Tests the build, creates the `v*` Git tag, and publishes the official GitHub Release with auto-generated release notes.

---

## 📚 Documentation

Detailed documentation and architectural guides are maintained in the `docs/` directory:
- 📖 **[docs/documentation.md](./docs/documentation.md)** — Comprehensive architecture, subsystem design, and milestone implementation history.
- 🧠 **[docs/mindmap.md](./docs/mindmap.md)** — Codebase-to-functionality matrix and per-frame sequence diagrams.

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
