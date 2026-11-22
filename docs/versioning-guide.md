# 🏷️ Versioning & Release Guide

This guide describes how versioning works in **Spatial Harp**, how to increment versions correctly, and how releases automatically reflect across the UI and deploy to **Vercel**.

---

## 📌 Single Source of Truth

The application follows strict **Semantic Versioning** ([SemVer](https://semver.org/)):

$$\text{v}\underbrace{\text{MAJOR}}_{\text{Breaking/Milestone}}.\underbrace{\text{MINOR}}_{\text{New Features}}.\underbrace{\text{PATCH}}_{\text{Fixes/Tweaks}}$$

The version string lives exclusively in the root **`VERSION`** file:
- **[`VERSION`](file:///home/mk/Files/JS/02-hand/VERSION)** $\rightarrow$ `v0.1.2`

Never manually edit version strings inside HTML, CSS, or TypeScript files.

---

## ⚙️ How It Propagates to the UI (Compile-Time Injection)

During development and production builds, [vite.config.ts](file:///home/mk/Files/JS/02-hand/vite.config.ts) extracts the version directly from the root `VERSION` file and embeds it as a global compile-time constant:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import fs from 'node:fs';

const appVersion = fs.readFileSync(new URL('./VERSION', import.meta.url), 'utf-8').trim();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  // ...
});
```

The global constant `__APP_VERSION__` is typed in [src/types/env.d.ts](file:///home/mk/Files/JS/02-hand/src/types/env.d.ts) and automatically rendered in:
1. **Navigation Bar**: The glassmorphic badge `v0.1.0` next to the brand title in [src/ui/nav-bar.ts](file:///home/mk/Files/JS/02-hand/src/ui/nav-bar.ts).
2. **System Diagnostics (HUD)**: Under `System Metrics` $\rightarrow$ `Version: v0.1.0` in [src/ui/hud.ts](file:///home/mk/Files/JS/02-hand/src/ui/hud.ts).
3. **Splash Launch Screen**: Footer metadata `SPATIAL HARP · v0.1.0 · OFFLINE AR ENGINE` in [src/ui/splash-screen.ts](file:///home/mk/Files/JS/02-hand/src/ui/splash-screen.ts).

---

## 🚀 How to Bump the Version (Step-by-Step)

Always use the standard `npm version` command from your terminal:

### 1. Patch Release (Bug fixes, audio tweaks, UI polish)
```bash
# 0.1.0 -> 0.1.1
npm version patch
```

### 2. Minor Release (New sound presets, new musical scales, new gesture modes)
```bash
# 0.1.0 -> 0.2.0
npm version minor
```

### 3. Major Release (Breaking architecture overhaul, major public release)
```bash
# 0.1.0 -> 1.0.0
npm version major
```

### What `npm version` does automatically:
1. Updates the `"version"` field in `package.json`.
2. Updates `package-lock.json` if present.
3. Automatically creates a Git commit (e.g. `0.1.1`).
4. Creates an annotated Git tag (e.g. `v0.1.1`).

---

## 🌐 Deploying to Vercel

The project includes a pre-configured [vercel.json](file:///home/mk/Files/JS/02-hand/vercel.json) optimized for Vite and high-performance WebAssembly.

### 1. First-Time Setup
1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/), click **"Add New Project"** $\rightarrow$ **"Import Git Repository"**.
3. Vercel automatically detects the **Vite** framework:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Click **Deploy**.

### 2. Continuous Deployment Workflow
Whenever you push changes or new version tags to GitHub:
- **Feature Branches / PRs**: Vercel automatically creates an isolated **Preview Deployment** (with its own unique URL) for testing.
- **Main/Master Branch**: Vercel runs `npm run build` and instantly updates the **Production Deployment**.

### 3. Pushing New Versions & Git Tags
When you have created a new version using `npm version`:
```bash
# Push master branch along with the new version tag:
git push origin master --tags
```
Vercel will detect the push, rebuild the app with the new version constant injected, and deploy it live!

---

## 🧪 Local Verification

Before committing or pushing, verify the build succeeds:
```bash
# Type check and build bundle
npm run build

# Preview production build locally
npm run preview
```
Open `http://localhost:4173` to see the new version badge live in your browser.
