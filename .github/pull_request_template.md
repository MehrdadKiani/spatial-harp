## 🎵 Description
<!-- Briefly describe the purpose of this PR and what problem or feature it addresses. -->

## 🛠️ Type of Change
- [ ] 🚀 New Feature (new audio preset, scale, gesture mode, visual effect)
- [ ] 🐛 Bug Fix (gesture tracking, collision edge-case, audio glitch)
- [ ] ⚡ Performance & Zero-GC (vector recycling, mesh pool, shader optimization)
- [ ] 🎨 UI & Aesthetics (glassmorphism, HUD, responsive styling)
- [ ] 📖 Documentation & CI (guides, workflows, typings)

## 📋 Architectural Checklist
Please verify that your contribution strictly adheres to the core repository rules:
- [ ] **Zero UI Framework Rule**: 100% vanilla TypeScript and direct DOM (no React, Vue, Svelte, or vDOM libraries).
- [ ] **Zero Garbage Collection in Tick Loop**: No per-frame allocations (`Vector3`, geometries, arrays) inside `requestAnimationFrame` loops.
- [ ] **Modular Layer Decoupling**: Subsystems remain isolated (`vision`, `gestures`, `instruments`, `audio`, `render`) communicating via `EventBus`.
- [ ] **Offline & Local Asset First**: All models and WASM binaries load locally from `public/`; no runtime CDN dependencies.
- [ ] **Strict TypeScript Typing**: No `any` types; all contracts typed in `src/types/`.
- [ ] **Build & Tests Pass**: Verified locally with `npm test && npm run build` (zero errors).

## 📷 Screenshots / Demos (if visual or audio change)
<!-- Add a screenshot, short recording, or animated GIF demonstrating the change -->

## 🔗 Related Issues
<!-- e.g. Closes #12, Fixes #34 -->
