# iiif-viewer

> A modern IIIF image viewer plugin built on **Vue 3 + Vite + TypeScript + OpenSeadragon**. It can be embedded in any Vue 3 application.

[![npm version](https://img.shields.io/badge/npm-0.1.0-blue)](https://www.npmjs.com/package/@tony2y/iiif-viewer)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![vue](https://img.shields.io/badge/vue-%5E3.5-42b883)](https://vuejs.org/)
[![openseadragon](https://img.shields.io/badge/openseadragon-%5E6.0-blue)](https://openseadragon.github.io/)

**English** | [简体中文](./README.md) | [Preview ](https://tony2y.github.io/iiif-viewer/)

---

## 1. Overview and Core Features

`@tony2y/iiif-viewer` is a Vue 3 component library (also shipped as a plugin) for embedding an [IIIF](https://iiif.io/)-compliant image viewer into a web page. The rendering engine is [OpenSeadragon](https://openseadragon.github.io/), which loads images as tiles on demand for deep-zoom scenarios.

### Core features

| Category                 | Capabilities                                                                                                                                                                                                                                                                                                             |
|--------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **IIIF standard**        | IIIF **Image API 2.x / 3.x** (`info.json`); IIIF **Presentation API 2.1 / 3.0** (`manifest.json`, multi-canvas paging); label language mapping, metadata / rights / provider / thumbnail normalization                                                                                                                   |
| **Input detection**      | Auto-detects an "Image API service base URL", an "`info.json` URL", a "`manifest.json` URL", a "static image URL", or an "OSD tileSource"; when URL heuristics fail it **re-checks the response body** (supports unusual addresses such as `/presentation/{id}`)                                                         |
| **Image interaction**    | Zoom (wheel / double-click / buttons / keyboard), pan and drag, arbitrary-angle rotation, horizontal flip, reset, fullscreen, built-in OSD navigator                                                                                                                                                                     |
| **Multi-canvas**         | Previous / next page, page status, thumbnail strip (falls back to the Image API `full/!120,120/0/default.jpg` when a thumbnail is missing); page turns keep the current zoom and pan, with optional `fade` / `zoom-swap` transitions                                                                                     |
| **Single/double page**   | Single-page / double-page view toggle (toolbar button, `initialDoublePage` prop, and `setDoublePage()` / `toggleDoublePage()`); the index snaps to an even number, paging advances by 2, both pages share the same height and are **flush at the spine**, and the last spread may hold a single page rendered full-width |
| **Color adjustment**     | Live brightness / contrast / saturation: one toolbar button → a right-side slide-out panel, composed into a single CSS `filter` applied to the canvas (the navigator is unaffected, all three renderers work, no tile refetch)                                                                                           |
| **Table of contents**    | Parses IIIF `structures` (v2 `ranges` / v3 `items`) into a unified tree; the info panel shows a "Contents / Item information" tab pair; clicking an entry navigates and the current page is highlighted                                                                                                                  |
| **UI**                   | Dark gallery theme (default) / light theme / follow system; glassmorphic floating toolbar with four docking positions; loading skeleton and progress ring; error card (with error code and retry); metadata drawer panel                                                                                                 |
| **Internationalization** | Built-in `zh-CN` / `en-US`, zero extra runtime dependencies; override or extend messages via `messages`                                                                                                                                                                                                                  |
| **Responsive**           | Built on CSS container queries (`@container`), decoupled from viewport width; in narrow containers the toolbar is compacted into a "More" menu                                                                                                                                                                           |
| **Accessibility**        | Every control has an accessible name and a visible focus ring; icons are decorative and hidden from the accessibility tree; shortcut hints are readable by screen readers; full `prefers-reduced-motion` support                                                                                                         |
| **Type safety**          | Complete TypeScript typings (Props / Emits / Slots / Expose / core capabilities / IIIF structures), with `.d.ts` shipped in the artifacts                                                                                                                                                                                |
| **Tooling**              | Vite library-mode build (ESM + UMD + a single CSS file + d.ts), ESLint 10 flat config, Prettier, Vitest unit tests                                                                                                                                                                                                       |
| **Dependency boundary**  | `openseadragon` is a peerDependency and marked as build external, so **the library artifacts contain no OSD code**; a custom OSD instance can be injected via the `openseadragon` prop / plugin config (with a compatibility check)                                                                                      |

---

## 2. Tech Stack and Versions

### Runtime dependencies (peerDependencies)

| Package         | Version range | Notes                                                                                        |
| --------------- | ------------- | -------------------------------------------------------------------------------------------- |
| `vue`           | `^3.5.0`      | Host framework, using the Composition API + `<script setup>`                                 |
| `openseadragon` | `^6.0.0`      | Image rendering engine (ships its own TypeScript types; `@types/openseadragon` not required) |

### OpenSeadragon Provided by the Consumer (Dependency Boundary and Injection)

`openseadragon` is a **peerDependency** of this library and is declared as **external** at build time:

- The **ESM artifact** keeps `import OpenSeadragon from "openseadragon"`, resolved by the consumer's bundler;
- The **UMD artifact** treats `OpenSeadragon` as a global variable (`window.OpenSeadragon`).

As a result, **the library artifacts contain no OpenSeadragon code**, and the consumer must install it once to avoid multiple copies of OSD on the same page (multiple instances each register global events and styles, which breaks interaction).

```bash
pnpm add @tony2y/iiif-viewer openseadragon
```

In a few scenarios the consumer needs to **explicitly specify** the OSD source. Pass it through the `openseadragon` prop (or the plugin config `createIiifViewer({ openseadragon })`), for example: a CDN / `<script>` include where only `window.OpenSeadragon` is available; a self-compiled or patched OSD build; or multiple OSD versions coexisting on the page.

The injected object must have the same shape as the OSD default export — it must be **callable** (`OpenSeadragon(options)`) and expose namespace members such as `Viewer` / `Viewport`.

**Version compatibility**: this library is developed and tested against OSD **6.x** (exported constant `TESTED_OSD_MAJOR = 6`), and supports a minimum major version of `MIN_SUPPORTED_OSD_MAJOR = 4`. Injected objects go through `verifyOpenSeadragon(candidate)`:

- Missing required APIs (`Viewer.prototype.open` / `destroy` / `addHandler`, `Viewport.prototype.rotateTo` / `setFlip` / `viewportToImageZoom` / `fitHorizontally` / `fitVertically`) or a major version below 4 → judged incompatible; the component enters the `OSD_INIT_FAILED` error state (no exception is thrown);
- A major version above the tested one, or an unreadable version → only `console.warn`, and execution continues.

Related exports: `resolveOpenSeadragon(provided?)`, `builtinOpenSeadragon`, and the types `OpenseadragonNamespace`, `OsdCompatibilityReport`.

> Related optimization: in double-page view, the zoom percentage is computed from the first `TiledImage.viewportToImageZoom()`, avoiding the OSD "is not accurate with multi-image" warning printed in multi-image scenarios.

### Development dependencies (devDependencies)

| Package                         | Version    | Purpose                                  |
| ------------------------------- | ---------- | ---------------------------------------- |
| `vite`                          | `^8.3.0`   | Build and dev server (library mode)      |
| `@vitejs/plugin-vue`            | `^6.0.9`   | SFC compilation                          |
| `typescript`                    | `~5.9.3`   | Type system                              |
| `vue-tsc`                       | `^3.3.11`  | Type checking                            |
| `vite-plugin-dts`               | `^5.1.1`   | Generates `.d.ts`                        |
| `@vue/language-core`            | `^3.3.11`  | SFC support for d.ts generation          |
| `vitest`                        | `^4.1.11`  | Unit testing                             |
| `@vitest/coverage-v8`           | `^4.1.11`  | Coverage                                 |
| `jsdom`                         | `^27.4.0`  | Test DOM environment                     |
| `@vue/test-utils`               | `^2.5.1`   | Component testing                        |
| `eslint`                        | `^10.11.0` | Linting (flat config)                    |
| `eslint-plugin-vue`             | `^10.11.0` | Vue rules                                |
| `@vue/eslint-config-typescript` | `^14.9.0`  | TS + Vue flat preset                     |
| `@vue/eslint-config-prettier`   | `^10.2.0`  | Disables rules conflicting with Prettier |
| `prettier`                      | `^3.9.8`   | Code formatting                          |
| `globals`                       | `^17.12.0` | ESLint global definitions                |
| `@types/node`                   | `^26.6.2`  | Node types                               |

### Browser compatibility baseline

| Browser       | Minimum version |
| ------------- | --------------- |
| Chrome / Edge | 105             |
| Safari        | 16              |
| Firefox       | 110             |

---

## 3. Local Development Setup

### 3.1 Prerequisites

| Item            | Requirement                               |
| --------------- | ----------------------------------------- |
| Node.js         | `>= 20.19.0`                              |
| Package manager | pnpm (recommended, `>= 9`) or npm `>= 10` |
| Browser         | See "Browser compatibility baseline"      |

Check the versions:

```bash
node -v     # expect v20.19.0 or later
pnpm -v     # expect 9.x / 10.x
```

### 3.2 Install and run

```bash
# 1. Install dependencies
pnpm install

# 2. Start the dev server (playground demo page, default http://localhost:5173)
pnpm dev

# To open the browser automatically
pnpm dev --open

# 3. Type checking / linting / unit tests
pnpm typecheck
pnpm lint
pnpm test

# 4. Build the library artifacts
pnpm build
```

### 3.3 Available scripts

| Script                              | Description                                                    |
| ----------------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                          | Starts the Vite dev server, entry `index.html` → `playground/` |
| `pnpm build`                        | Library-mode build, output to `dist/`                          |
| `pnpm preview`                      | Previews the built artifacts                                   |
| `pnpm demo:build`                   | Builds the demo site (output `demo-dist/`, see 3.6)            |
| `pnpm demo:preview`                 | Previews the demo site (with the `base` prefix applied)        |
| `pnpm typecheck`                    | `vue-tsc --noEmit`, full type checking                         |
| `pnpm test`                         | `vitest run`, runs unit tests once                             |
| `pnpm test:watch`                   | Test watch mode                                                |
| `pnpm test:coverage`                | Generates a coverage report (`coverage/`)                      |
| `pnpm lint` / `pnpm lint:fix`       | ESLint check / auto-fix                                        |
| `pnpm format` / `pnpm format:check` | Prettier format / check                                        |
| `pnpm prepublishOnly`               | Pre-publish hook: lint → typecheck → test → build              |

### 3.4 Directory structure

```
iiif-viewer/
├─ index.html                  # Dev/playground entry (not part of the library build)
├─ vite.config.ts              # Library build + dev server + Vitest config
├─ vite.demo.config.ts         # Demo-site build config (GitHub Pages, output demo-dist/)
├─ .github/workflows/          # deploy-demo.yml: automatic demo deployment
├─ eslint.config.js            # ESLint 10 flat config
├─ tsconfig.json               # Base config (src + playground + tests)
├─ tsconfig.lib.json           # Config dedicated to d.ts generation
├─ playground/                 # Local demo application
├─ src/
│  ├─ index.ts                 # Public entry (plugin, components, composables, types)
│  ├─ core/                    # Pure-function capability layer
│  │  ├─ iiif.ts               # Input detection, info / manifest normalization, structures TOC tree
│  │  ├─ color.ts              # Color adjustment: range clamping and CSS filter composition
│  │  └─ openseadragon.ts      # OSD injection and compatibility check (verifyOpenSeadragon)
│  ├─ types/                   # All public types
│  ├─ composables/             # useIiifSource / useOpenSeadragon / useViewerI18n etc.
│  ├─ locales/                 # zh-CN / en-US messages
│  ├─ components/              # Components (including base/ primitives)
│  │  ├─ ViewerColorPanel.vue  # Color adjustment panel (brightness / contrast / saturation)
│  │  └─ ViewerToc.vue         # Table of contents (TOC) tree
│  └─ styles/                  # Design tokens and base styles
└─ tests/                      # Vitest unit tests
```

### 3.5 Troubleshooting

| Symptom                                                                | Cause and remedy                                                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERR_PNPM_UNSUPPORTED_ENGINE` or a Node version error when Vite starts | Node is older than 20.19.0; upgrade Node                                                                                                    |
| `Port 5173 is already in use`                                          | Use another port: `pnpm dev --port 5188 --strictPort`                                                                                       |
| A peer dependency warning during install                               | Install the peer dependencies as well: `pnpm add vue openseadragon` (this repo already installs them as devDependencies for the playground) |
| Broken styles (no borders / no glassmorphism)                          | The stylesheet was not imported; make sure the code includes `import '@tony2y/iiif-viewer/style.css'`                                       |
| WebGL texture warnings from cross-origin tiles in the console          | See [6.3 Troubleshooting](#63-troubleshooting); passing `crossOriginPolicy: 'Anonymous'` is recommended                                     |

---

## 4. Usage and Code Examples

### 4.1 Install dependencies

```bash
# pnpm
pnpm add @tony2y/iiif-viewer openseadragon

# npm
npm install @tony2y/iiif-viewer openseadragon
```

### 4.2 Import styles (required)

Styles are not inlined into JS, so they must be imported once explicitly:

```ts
import '@tony2y/iiif-viewer/style.css'
```

### 4.3 Option 1: Import a single component on demand (recommended)

```vue
<!-- App.vue -->
<script setup lang="ts">
import { IiifViewer } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

const source =
  'https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen/info.json'
</script>

<template>
  <div style="height: 640px">
    <IiifViewer :source="source" locale="zh-CN" />
  </div>
</template>
```

### 4.4 Option 2: Global registration via the plugin (with global defaults)

```ts
// main.ts
import { createApp } from 'vue'
import { createIiifViewer } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'
import App from './App.vue'

createApp(App)
  .use(
    createIiifViewer({
      // The following are global defaults; a single component's props override them
      locale: 'zh-CN',
      theme: 'dark',
      toolbar: { position: 'bottom' },
      osdOptions: { crossOriginPolicy: 'Anonymous' },
    }),
  )
  .mount('#app')
```

After registration the following components are available globally: `IiifViewer`, `ViewerToolbar`, `ViewerStatusBar`, `ViewerThumbnails`, `ViewerInfoPanel`, `ViewerColorPanel`, `ViewerToc`, `ViewerLoading`, `ViewerError`, `ViewerButton`, `ViewerIcon`, `ViewerTooltip`.

### 4.5 Example: manifest multi-canvas + thumbnails + info panel

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { IiifViewer } from '@tony2y/iiif-viewer'
import type { IiifViewerExposed } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

// The address looks like /presentation/{id} and does not contain "manifest":
// the component first tries <url>/info.json, then falls back to requesting the original
// address and detects it as a manifest from the response body
const source = 'https://iiif.wellcomecollection.org/presentation/b18035723'

const viewer = ref<IiifViewerExposed | null>(null)

function zoomIn() {
  viewer.value?.zoomIn(1.5)
}
</script>

<template>
  <div style="height: 720px">
    <IiifViewer
      ref="viewer"
      :source="source"
      :show-thumbnails="true"
      :show-info-panel="true"
      :toolbar="{ position: 'bottom' }"
      :osd-options="{ crossOriginPolicy: 'Anonymous' }"
      @load-success="(p) => console.log('canvases loaded:', p.canvases.length)"
      @page-change="(p) => console.log('current page:', p.index + 1, '/', p.total)"
      @load-error="(e) => console.error('load failed:', e.code, e.message)"
    />
  </div>
</template>
```

### 4.6 Example: i18n and theming

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { IiifViewer } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

const locale = ref<'zh-CN' | 'en-US'>('en-US')
const theme = ref<'dark' | 'light' | 'auto'>('dark')

// Override / extend the built-in messages (same keys as built-in; overridden ones fall back automatically)
const messages = {
  'toolbar.zoomIn': 'Zoom in a bit',
  'viewer.label': 'Collection image viewer',
}
</script>

<template>
  <input v-model="locale" />
  <select v-model="theme">
    <option value="dark">Dark</option>
    <option value="light">Light</option>
    <option value="auto">Follow system</option>
  </select>

  <div style="height: 560px">
    <IiifViewer
      source="https://example.org/iiif/id/info.json"
      :locale="locale"
      :theme="theme"
      :messages="messages"
    />
  </div>
</template>
```

### 4.7 Example: calling imperative methods via a template ref

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { IiifViewer } from '@tony2y/iiif-viewer'
import type { IiifViewerExposed } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

const viewer = ref<IiifViewerExposed | null>(null)

function actions() {
  viewer.value?.open('https://example.org/iiif/another/info.json') // switch resource
  viewer.value?.rotateTo(90) // rotate to 90°
  viewer.value?.goToPage(3) // jump to the 4th canvas
  viewer.value?.toggleFullscreen()

  // read the live state
  console.log(viewer.value?.getState())
  // the underlying OpenSeadragon instance (advanced usage)
  console.log(viewer.value?.viewer)
}
</script>

<template>
  <div style="height: 560px">
    <IiifViewer ref="viewer" source="https://example.org/manifest.json" />
  </div>
  <button type="button" @click="actions">Run</button>
</template>
```

### 4.8 Example: direct CDN / UMD include (no bundler)

The UMD artifact exposes the global `IiifViewer` and treats `Vue` and `OpenSeadragon` as external globals.

```html
<link rel="stylesheet" href="https://unpkg.com/@tony2y/iiif-viewer/dist/iiif-viewer.css" />
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<script src="https://unpkg.com/openseadragon@6/build/openseadragon/openseadragon.min.js"></script>
<script src="https://unpkg.com/@tony2y/iiif-viewer/dist/index.umd.cjs"></script>

<div id="app" style="height: 640px"></div>
<script>
  const { createApp, h } = Vue

  createApp({
    render() {
      return h(IiifViewer.IiifViewer, {
        source:
          'https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen/info.json',
        locale: 'zh-CN',
      })
    },
  }).mount('#app')
</script>
```

### 4.9 Example: custom slots

```vue
<IiifViewer :source="source">
  <!-- custom loading state -->
  <template #loading>
    <div class="my-loading">Opening the collection image…</div>
  </template>

  <!-- custom error state (scoped params expose the error and a retry method) -->
  <template #error="{ error, retry }">
    <div class="my-error">
      <p>{{ error.code }}</p>
      <button type="button" @click="retry">Try again</button>
    </div>
  </template>

  <!-- append a custom action to the right of the toolbar -->
  <template #toolbar-extra="{ state }">
    <button type="button" @click="download(state)">Download</button>
  </template>
</IiifViewer>
```

### 4.10 Example: double-page reading

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { IiifViewer } from '@tony2y/iiif-viewer'
import type { IiifViewerExposed } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

const source = 'https://iiif.wellcomecollection.org/presentation/b18035723'
const viewer = ref<IiifViewerExposed | null>(null)

// switching imperatively is also possible via viewer.value?.toggleDoublePage()
function toSpread() {
  viewer.value?.setDoublePage(true)
}
</script>

<template>
  <div style="height: 720px">
    <IiifViewer
      ref="viewer"
      :source="source"
      :initial-double-page="true"
      :toolbar="{ position: 'bottom', doublePage: true }"
      @double-page-change="(v) => console.log('double-page mode:', v)"
      @page-change="(p) => console.log('current page:', p.index + 1, '/', p.total)"
    />
  </div>
  <button type="button" @click="toSpread">Switch to double page</button>
</template>
```

> In double-page view, `currentIndex` snaps to an **even number** and one screen renders `[start, start + 1]` — **both pages share the same height and are flush at the spine** (like an open book); paging advances by 2. The last spread may hold a single page (rendered full-width). When the canvas count is 1, no spread is produced. The toolbar renders the toggle button only when the canvas count is > 1, and its icon / text reflects the **current** mode (single page → "Single-page view" + book icon; double page → "Double-page view" + open-book icon), with the toggle state expressed via `aria-pressed`.

### 4.11 Example: color adjustment

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { IiifViewer } from '@tony2y/iiif-viewer'
import type { IiifViewerExposed } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

const viewer = ref<IiifViewerExposed | null>(null)

// partial fields are allowed; the others keep their current values
function dim() {
  viewer.value?.setColors({ brightness: 80 })
}
function reset() {
  viewer.value?.resetColors()
}
</script>

<template>
  <div style="height: 640px">
    <IiifViewer
      ref="viewer"
      source="https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen/info.json"
      :color-adjust="true"
      @colors-change="(c) => console.log('brightness / contrast / saturation:', c)"
      @color-toggle="(open) => console.log('color panel:', open)"
    />
  </div>
  <button type="button" @click="dim">Dim</button>
  <button type="button" @click="reset">Reset</button>
</template>
```

> Brightness and contrast range from `50–150`; saturation ranges from `0–200`; **the neutral value is 100** for all three. When all three are at 100 the `filter` is cleared to avoid a needless compositing layer. With `colorAdjust: false` the toolbar hides the color button, no panel is rendered, and the canvas filter is cleared.

### 4.12 Example: injecting a custom OpenSeadragon

```vue
<script setup lang="ts">
import { IiifViewer } from '@tony2y/iiif-viewer'
import '@tony2y/iiif-viewer/style.css'

// The page already loaded an OSD build via <script>; point at its source explicitly
const osd = window.OpenSeadragon as typeof import('openseadragon')
</script>

<template>
  <div style="height: 640px">
    <IiifViewer :source="source" :openseadragon="osd" />
  </div>
</template>
```

> When `openseadragon` is not passed, the instance from `peerDependencies` is used. Injection is only needed to point at a self-compiled build, when multiple OSD copies exist on the page, or when it is loaded via a CDN global. The injected object first goes through `verifyOpenSeadragon()`; see [2. Tech Stack and Versions](#2-tech-stack-and-versions).

---

## 5. Full Configuration Reference

### 5.1 Props

| Name                | Type                                        | Default                                          | Options / notes                                                                                                                          |
| ------------------- | ------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `source`            | `string \| IiifTileSource \| Array`         | **required**                                     | Image API service base URL, `info.json` URL, `manifest.json` URL, static image URL, or a ready-made OSD tileSource (arrays supported)    |
| `sourceType`        | `'auto' \| 'info' \| 'manifest' \| 'image'` | `'auto'`                                         | Forces the input type; `auto` uses heuristics plus a response-body re-check                                                              |
| `locale`            | `string`                                    | plugin config → `navigator.language` → `'en-US'` | UI language, built-in `zh-CN` / `en-US`; other values are normalized by `zh*` / `en*`, unknown ones fall back to `en-US`                 |
| `messages`          | `Record<string, string>`                    | `undefined`                                      | Override / extend built-in messages; keys in [5.6 Message keys](#56-message-keys)                                                        |
| `theme`             | `'dark' \| 'light' \| 'auto'`               | plugin config → `'dark'`                         | `auto` follows the system `prefers-color-scheme`                                                                                         |
| `toolbar`           | `boolean \| IiifViewerToolbarOptions`       | `true`                                           | `false` hides the toolbar; an object toggles individual items, see [5.2 Toolbar options](#52-toolbar-options)                            |
| `showNavigator`     | `boolean`                                   | `true`                                           | Whether to show the top-right navigator (mini-map); changes apply at runtime (created with `false`, switching to `true` recreates the viewer) |
| `showStatusBar`     | `boolean`                                   | `true`                                           | Whether to show the bottom status bar                                                                                                    |
| `showThumbnails`    | `boolean`                                   | `false`                                          | **Initial** expanded state of the thumbnail strip; multi-canvas only, auto-hidden for a single canvas                                    |
| `showInfoPanel`     | `boolean`                                   | `false`                                          | **Initial** expanded state of the metadata panel                                                                                         |
| `keyboardShortcuts` | `boolean`                                   | `true`                                           | Whether to enable keyboard shortcuts (only when the stage is focused)                                                                    |
| `fitMode`           | `'contain' \| 'width' \| 'height'`          | `'contain'`                                      | Initial fit mode: fit fully / fill width / fill height                                                                                   |
| `minZoom`           | `number`                                    | `0.5`                                            | Minimum zoom factor, mapped to OSD `minZoomImageRatio`                                                                                   |
| `maxZoom`           | `number`                                    | `20`                                             | Maximum zoom factor, mapped to OSD `maxZoomPixelRatio`                                                                                   |
| `rotateStep`        | `number`                                    | `90`                                             | Rotation step in degrees                                                                                                                 |
| `timeout`           | `number`                                    | `15000`                                          | Timeout in milliseconds for fetching `info.json` / `manifest.json`                                                                       |
| `aspectRatio`       | `string \| number`                          | `'4 / 3'`                                        | Stage aspect ratio, e.g. `'16 / 9'`, `1`; `'auto'` fills the parent height (the **parent must have a definite height**)                  |
| `osdOptions`        | `Partial<OpenSeadragon.Options>`            | `undefined`                                      | Pass-through / override for native OpenSeadragon options, **highest priority**                                                           |
| `initialDoublePage` | `boolean`                                   | `false`                                          | Whether to start in double-page view; changing this prop at runtime also toggles it, equivalent to `setDoublePage()`                     |
| `colorAdjust`       | `boolean`                                   | `true`                                           | Whether to enable brightness / contrast / saturation adjustment; `false` hides the button, renders no panel and clears the canvas filter |
| `pageTransition`    | `IiifViewerPageTransition`                  | `false`                                          | Page / resource transition: `false` disables, or a `'fade'` / `'zoom-swap'` preset or options object                                     |
| `openseadragon`     | `OpenseadragonNamespace`                    | `undefined`                                      | Explicitly specifies the OpenSeadragon source (defaults to the peerDependency); the injected object goes through `verifyOpenSeadragon()` |

#### Differences from OSD defaults

Internally the component disables OpenSeadragon's built-in navigation controls and drives them from its own toolbar. The defaults below can all be overridden via `osdOptions`:

```ts
{
  showNavigationControl: false,
  showZoomControl: false,
  showHomeControl: false,
  showFullPageControl: false,
  showRotationControl: false,
  keyboardNavEnabled: false,        // keyboard interaction is handled by the component on the stage
  navigatorPosition: 'TOP_RIGHT',
  navigatorSizeRatio: 0.16,
  navigatorAutoFade: false,
  visibilityRatio: 0.6,
  constrainDuringPan: false,
  preserveViewport: true,           // the component decides when to re-fit, so page turns keep the view
  wrapHorizontal: false,
  wrapVertical: false,
  animationTime: 0.8,               // 0 under prefers-reduced-motion
  springStiffness: 10,              // 100 under prefers-reduced-motion
  gestureSettingsMouse: { scrollToZoom: true, clickToZoom: false, dblClickToZoom: true, pinchToZoom: true, flickEnabled: true, flickMomentum: 0.18, pinchRotate: false },
  gestureSettingsTouch: { pinchToZoom: true, dblClickToZoom: true, flickEnabled: true, flickMomentum: 0.18, pinchRotate: false },
}
```

> The colors of the navigator and display region are expressed with `var(--iiif-navigator-*)`, so switching themes follows automatically without recreating the OSD instance.

### 5.2 Toolbar options

```ts
interface IiifViewerToolbarOptions {
  position?: 'top' | 'bottom' | 'left' | 'right' // dock position, default 'bottom'
  zoom?: boolean // zoom in / out, default true
  rotate?: boolean // rotate left / right, default true
  flip?: boolean // horizontal flip, default true
  reset?: boolean // reset view, default true
  fullscreen?: boolean // fullscreen toggle, default true
  pageNav?: boolean // previous / next page, default true (rendered only for multi-canvas)
  thumbnails?: boolean // thumbnail toggle, default true (rendered only for multi-canvas)
  info?: boolean // metadata panel toggle, default true
  doublePage?: boolean // single / double page toggle, default true (rendered only when canvas count > 1)
}
```

Usage example:

```vue
<IiifViewer :source="source" :toolbar="{ position: 'right', rotate: false, flip: false }" />
<IiifViewer :source="source" :toolbar="false" />
```

In a narrow container (width < 480px) the toolbar keeps only `zoom out / zoom in / reset / rotate left / rotate right / fullscreen`, and the remaining actions collapse into a "More" popup menu.

### 5.3 Events

| Event                   | Payload                                     | When it fires                                                                         |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `ready`                 | `viewer: OpenSeadragon.Viewer`              | The OpenSeadragon instance has been created                                           |
| `destroy`               | —                                           | The component unmounts and the instance is destroyed                                  |
| `load-start`            | `source: IiifViewerSource`                  | Resource loading starts                                                               |
| `load-success`          | `{ kind, imageInfo?, manifest?, canvases }` | Resource loaded successfully (`kind` ∈ `info` / `manifest` / `image` / `tile-source`) |
| `load-error`            | `error: IiifViewerErrorLike`                | Resource loading failed (with `code` and `i18nKey`)                                   |
| `zoom-change`           | `zoom: number`                              | Zoom percentage changed (100 means 1:1)                                               |
| `rotation-change`       | `degrees: number`                           | Rotation changed (0–359)                                                              |
| `flip-change`           | `flipped: boolean`                          | Flip state changed                                                                    |
| `page-change`           | `{ index: number; total: number }`          | Canvas changed (`index` is 0-based)                                                   |
| `double-page-change`    | `value: boolean`                            | Single / double page mode switched                                                    |
| `colors-change`         | `colors: IiifColorAdjustments`              | Color adjustment values changed (already normalized)                                  |
| `color-toggle`          | `open: boolean`                             | Color adjustment panel opened / closed                                                |
| `fullscreen-change`     | `value: boolean`                            | Fullscreen state changed                                                              |
| `progress-change`       | `percent: number`                           | Tile loading progress changed (0–100)                                                 |
| `info-toggle`           | `open: boolean`                             | Metadata panel opened / closed                                                        |
| `page-transition-start` | `IiifViewerPageTransitionPayload`           | A page transition started (off when `pageTransition` is disabled                      |
| `page-transition-end`   | `IiifViewerPageTransitionPayload`           | A page transition finished, including interrupted ones                                |

### 5.4 Slots

| Slot            | Scoped params                                       | Description                                         |
| --------------- | --------------------------------------------------- | --------------------------------------------------- |
| `loading`       | —                                                   | Replaces the built-in loading overlay               |
| `error`         | `{ error: IiifViewerErrorLike; retry: () => void }` | Replaces the built-in error overlay                 |
| `toolbar-extra` | `{ state: IiifViewerState }`                        | Appends a custom action to the right of the toolbar |

### 5.5 Methods (`defineExpose`)

| Method / property                 | Signature                                          | Description                                                                                    |
| --------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `viewer`                          | `OpenSeadragon.Viewer \| null`                     | The underlying OSD instance; `null` until ready                                                |
| `getState()`                      | `() => IiifViewerState`                            | Returns a live state snapshot                                                                  |
| `open(source)`                    | `(source: IiifViewerSource) => void`               | Switches the resource (takes precedence over the `source` prop, cleared when `source` changes) |
| `zoomIn(step?)`                   | `(step?: number) => void`                          | Zoom in, default step 1.5                                                                      |
| `zoomOut(step?)`                  | `(step?: number) => void`                          | Zoom out, default step 1.5                                                                     |
| `zoomTo(zoom)`                    | `(zoom: number) => void`                           | Zooms to an OSD viewport zoom value                                                            |
| `resetHome()`                     | `() => void`                                       | Resets flip / rotation and returns to the initial view                                         |
| `rotateBy(degrees)`               | `(degrees: number) => void`                        | Adds rotation on top of the current angle                                                      |
| `rotateTo(degrees, immediately?)` | `(degrees: number, immediately?: boolean) => void` | Rotates to a specific angle                                                                    |
| `flipHorizontal()`                | `() => void`                                       | Toggles horizontal flip                                                                        |
| `goToPage(index)`                 | `(index: number) => void`                          | Jumps to a specific canvas                                                                     |
| `prevPage()` / `nextPage()`       | `() => void`                                       | Previous / next canvas                                                                         |
| `setDoublePage(enabled)`          | `(enabled: boolean) => void`                       | Sets double-page view (snaps the current page to the spread start when enabling)               |
| `toggleDoublePage()`              | `() => void`                                       | Toggles double-page view                                                                       |
| `setNavigatorVisible(v)`          | `(visible: boolean) => void`                       | Shows / hides the top-right navigator, equivalent to the `showNavigator` prop                  |
| `setColors(partial)`              | `(partial: Partial<IiifColorAdjustments>) => void` | Sets color adjustment (partial fields allowed; the others keep their current values)           |
| `resetColors()`                   | `() => void`                                       | Resets color adjustment to the neutral values (100 / 100 / 100)                                |
| `toggleFullscreen()`              | `() => void`                                       | Toggles fullscreen                                                                             |
| `retry()`                         | `() => void`                                       | Reloads the current resource                                                                   |

The `IiifViewerState` structure:

```ts
{
  zoomPercent: number       // zoom percentage relative to the original pixels (100 means 1:1)
  rotation: number          // 0–359
  flipped: boolean
  page: number              // current canvas index, 0-based
  total: number
  fullscreen: boolean
  canGoPrev: boolean
  canGoNext: boolean
  progress: number          // 0–100
  doublePage: boolean       // whether double-page view is active
  colors: IiifColorAdjustments // the currently applied color adjustment values
  imageInfo?: IiifImageInfo
  manifest?: IiifManifest
  canvas?: IiifCanvas
}
```

### 5.6 Message keys

Use these keys when overriding via `messages` (unoverridden ones fall back to the built-in values):

| Group            | Keys                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component        | `viewer.label`                                                                                                                                                                                                                                                                                                                                        |
| Toolbar          | `toolbar.label`, `toolbar.zoomIn`, `toolbar.zoomOut`, `toolbar.reset`, `toolbar.rotateLeft`, `toolbar.rotateRight`, `toolbar.flipHorizontal`, `toolbar.fullscreen`, `toolbar.exitFullscreen`, `toolbar.prev`, `toolbar.next`, `toolbar.thumbnails`, `toolbar.info`, `toolbar.more`, `toolbar.doublePage`, `toolbar.singlePage`, `toolbar.colorAdjust` |
| Status bar       | `status.loading`, `status.page`, `status.pageRange`, `status.spread`, `status.zoom`, `status.rotated`, `status.flipped`                                                                                                                                                                                                                               |
| Empty state      | `empty.noCanvas`                                                                                                                                                                                                                                                                                                                                      |
| Info panel       | `info.title`, `info.description`, `info.metadata`, `info.rights`, `info.provider`, `info.rawManifest`, `info.close`, `info.tabs.toc`, `info.tabs.info`, `info.toc.empty`                                                                                                                                                                              |
| Color adjustment | `color.title`, `color.brightness`, `color.contrast`, `color.saturation`, `color.neutral`, `color.reset`, `color.close`                                                                                                                                                                                                                                |
| Accessibility    | `a11y.shortcutsHint`, `a11y.thumbnails`, `a11y.retry`                                                                                                                                                                                                                                                                                                 |
| Errors           | `errors.<CODE>.title`, `errors.<CODE>.desc` (`<CODE>` in [5.7 Error codes](#57-error-codes))                                                                                                                                                                                                                                                          |

`status.page` / `status.pageRange` / `status.zoom` / `status.rotated` support `{name}` interpolation: the `status.page` template is `Page {current} / {total}`, and the `status.pageRange` template is `Pages {from}–{to} of {total}` (shown as a page range in double-page view).

### 5.7 Error codes

`IiifViewerError` carries a stable `code`, usable for programmatic branching via `error.code`, or `error.i18nKey` (such as `errors.TIMEOUT`) for a message lookup.

| Error code            | Meaning                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `INVALID_SOURCE`      | The provided `source` is empty or unrecognizable                       |
| `INVALID_SOURCE_TYPE` | `sourceType` does not match the actual content                         |
| `NETWORK_ERROR`       | Network error (DNS / CORS / offline)                                   |
| `HTTP_ERROR`          | The server returned a non-2xx status code                              |
| `TIMEOUT`             | Request timed out (see the `timeout` prop)                             |
| `UNSUPPORTED_VERSION` | Unsupported IIIF version, or a IIIF Collection was passed              |
| `INVALID_IIIF_INFO`   | Malformed `info.json` or missing fields (e.g. `width` / `height`)      |
| `INVALID_MANIFEST`    | Malformed `manifest`                                                   |
| `NO_CANVAS`           | The manifest has no renderable canvas                                  |
| `OSD_INIT_FAILED`     | OpenSeadragon failed to initialize or the tile source cannot be opened |

### 5.8 Plugin config (`createIiifViewer`)

| Option              | Type                                  | Default     | Description                                             |
| ------------------- | ------------------------------------- | ----------- | ------------------------------------------------------- |
| `locale`            | `string`                              | `undefined` | Global default language                                 |
| `messages`          | `Record<string, string>`              | `undefined` | Global default message overrides                        |
| `theme`             | `'dark' \| 'light' \| 'auto'`         | `undefined` | Global default theme                                    |
| `toolbar`           | `boolean \| IiifViewerToolbarOptions` | `undefined` | Global default toolbar config                           |
| `osdOptions`        | `Partial<OpenSeadragon.Options>`      | `undefined` | Global default OSD options                              |
| `initialDoublePage` | `boolean`                             | `undefined` | Global default for double-page view                     |
| `colorAdjust`       | `boolean`                             | `undefined` | Whether the color adjustment module is enabled globally |
| `pageTransition`    | `IiifViewerPageTransition`            | `undefined` | Default page transition effect                          |
| `openseadragon`     | `OpenseadragonNamespace`              | `undefined` | Global OpenSeadragon instance                           |

Priority: **component props > plugin config > built-in defaults**.

### 5.9 CSS variables (design tokens)

All variables are scoped to `.iiif-viewer` and never leak into the host page. Override the same variables externally to customize the theme:

```css
.my-page .iiif-viewer {
  --iiif-color-accent: #b45309;
  --iiif-radius-md: 4px;
  --iiif-font-ui: 'Noto Sans SC', system-ui, sans-serif;
}
```

| Group         | Variable                                                            | Dark default                      | Light value             |
| ------------- | ------------------------------------------------------------------- | --------------------------------- | ----------------------- |
| Base          | `--iiif-color-bg`                                                   | `#0b0c0e`                         | `#fafafa`               |
|               | `--iiif-color-surface`                                              | `#141619`                         | `#ffffff`               |
|               | `--iiif-color-surface-2`                                            | `#1c1f24`                         | `#f1f3f5`               |
|               | `--iiif-color-fg`                                                   | `#f4f5f7`                         | `#09090b`               |
|               | `--iiif-color-fg-muted`                                             | `#9ba1a9`                         | `#475569`               |
|               | `--iiif-color-border`                                               | `rgba(255,255,255,.10)`           | `#e4e4e7`               |
|               | `--iiif-color-border-strong`                                        | `rgba(255,255,255,.18)`           | `#d4d4d8`               |
| Accent        | `--iiif-color-accent`                                               | `#0e7490`                         | `#0e7490`               |
|               | `--iiif-color-accent-hover`                                         | `#0891b2`                         | `#155e75`               |
|               | `--iiif-color-accent-fg`                                            | `#ffffff`                         | `#ffffff`               |
|               | `--iiif-color-accent-text`                                          | `#22d3ee`                         | `#0e7490`               |
|               | `--iiif-color-danger`                                               | `#ef4444`                         | `#dc2626`               |
|               | `--iiif-color-danger-fg`                                            | `#ffffff`                         | `#ffffff`               |
|               | `--iiif-color-danger-soft`                                          | `rgba(239,68,68,.16)`             | `rgba(220,38,38,.12)`   |
|               | `--iiif-color-ring`                                                 | `#22d3ee`                         | `#0e7490`               |
| Glassmorphism | `--iiif-glass-bg`                                                   | `rgba(20,22,25,.72)`              | `rgba(255,255,255,.74)` |
|               | `--iiif-popup-bg`                                                   | `rgba(20,22,25,.94)`              | `rgba(255,255,255,.96)` |
|               | `--iiif-glass-border`                                               | `rgba(255,255,255,.14)`           | `rgba(9,9,11,.1)`       |
|               | `--iiif-glass-blur`                                                 | `14px`                            | same                    |
|               | `--iiif-overlay-scrim`                                              | `rgba(6,7,9,.72)`                 | `rgba(250,250,250,.76)` |
| Navigator     | `--iiif-navigator-bg`                                               | `#0b0c0e`                         | `#ffffff`               |
|               | `--iiif-navigator-border`                                           | `rgba(255,255,255,.18)`           | `rgba(9,9,11,.16)`      |
|               | `--iiif-navigator-region`                                           | `#22d3ee`                         | `#0e7490`               |
| Spacing       | `--iiif-space-1` … `--iiif-space-6`                                 | `4 / 8 / 12 / 16 / 24 / 32 px`    | same                    |
| Radius        | `--iiif-radius-sm` / `md` / `lg` / `full`                           | `6px` / `10px` / `14px` / `999px` | same                    |
| Shadows       | `--iiif-shadow-sm` / `md` / `lg`                                    | see `src/styles/tokens.css`       | lighter                 |
| Typography    | `--iiif-font-ui`                                                    | system sans-serif stack           | same                    |
|               | `--iiif-font-display`                                               | system serif stack                | same                    |
|               | `--iiif-font-mono`                                                  | system monospace stack            | same                    |
|               | `--iiif-font-size-xs` … `xl`                                        | `11 / 12 / 13 / 15 / 18 px`       | same                    |
|               | `--iiif-line-height`                                                | `1.5`                             | same                    |
| Motion        | `--iiif-duration-fast` / `--iiif-duration` / `--iiif-duration-slow` | `150ms` / `200ms` / `300ms`       | same                    |
|               | `--iiif-ease`                                                       | `cubic-bezier(.22,.61,.36,1)`     | same                    |
| Layering      | `--iiif-z-stage` / `overlay` / `panel` / `toolbar` / `popup`        | `1 / 5 / 15 / 20 / 30`            | same                    |
|               | `--iiif-toolbar-clearance`                                          | `64px`                            | same                    |
| Focus         | `--iiif-focus-ring`                                                 | double `box-shadow` focus ring    | same                    |

> The side panel (`--iiif-z-panel: 15`) sits deliberately below the floating toolbar (`--iiif-z-toolbar: 20`) so the drawer never covers the toolbar and its buttons stay clickable; panel content additionally leaves `--iiif-toolbar-clearance` (`64px`) of bottom space so it is not occluded by the toolbar.
>
> When the system enables "reduce motion", `--iiif-duration-*` drops to `0.01ms` automatically.

### 5.10 Keyboard shortcuts

Only active when the stage (`.iiif-viewer__stage`) is focused; set `keyboardShortcuts` to `false` to disable them entirely.

| Key             | Behavior                                      |
| --------------- | --------------------------------------------- |
| `+` / `=` / `↑` | Zoom in                                       |
| `-` / `_` / `↓` | Zoom out                                      |
| `0`             | Reset view                                    |
| `R`             | Rotate clockwise by `rotateStep`              |
| `Shift + R`     | Rotate counter-clockwise by `rotateStep`      |
| `F`             | Toggle fullscreen                             |
| `←` / `→`       | Previous / next canvas (multi-canvas)         |
| `I`             | Toggle the metadata panel                     |
| `Esc`           | Close the info panel / color adjustment panel |

### 5.11 Advanced usage: using core capabilities directly

Suited to building a wrapper or integrating with your own state management:

```ts
import {
  IiifViewerError,
  detectResourceKind,
  getIiifDocument,
  getImageInfo,
  getManifest,
  parseManifest,
  parseImageInfo,
  parseStructures,
  findFirstCanvasIndex,
  buildImageFilter,
  verifyOpenSeadragon,
  toTileSource,
  tileSourceKey,
  createOsdOptions,
  resolveUrl,
  useIiifSource,
  useOpenSeadragon,
  useViewerI18n,
} from '@tony2y/iiif-viewer'

try {
  // One call handles both info.json and manifest (with response-body re-check and failure fallback)
  const doc = await getIiifDocument('https://example.org/presentation/123', { locale: 'en-US' })
  if (doc.kind === 'manifest') {
    console.log(doc.manifest?.canvases.length)
  } else {
    console.log(doc.imageInfo?.width, doc.imageInfo?.height)
  }
} catch (error) {
  if (error instanceof IiifViewerError) {
    console.error(error.code, error.i18nKey)
  }
}
```

---

## 6. Appendix

### 6.1 Accessibility and interaction constraints

- Every clickable element provides hover / active / `:focus-visible` feedback, with transitions of 150–300ms
- Icons are all inline vector SVG with a uniform `stroke-width: 1.75`; emoji are not used as structural icons
- Decorative icons set `aria-hidden="true"`; icon buttons have `aria-label` and a Tooltip, with toggle state expressed via `aria-pressed`
- The metadata panel and the color adjustment panel use `role="dialog"` + `aria-labelledby`; focus moves to the close button on open and returns on close, and `Esc` is supported; color sliders have `<label for>` and `aria-valuetext`
- The info panel's "Contents / Item information" tabs use `role="tablist" / "tab" / "tabpanel"` + roving `tabindex`, supporting `←` `→` `Home` `End` to switch (focus movement activates)
- On touch devices, button hit areas automatically grow to 44×44px
- Full support for `prefers-reduced-motion: reduce`: changes apply live and page transitions degrade to no animation

### 6.2 Responsive behavior

| Container width | Behavior                                                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 480px         | Full toolbar, status bar shows title and rotation/flip info, thumbnails 60×60                                                                                                                                                                   |
| < 480px         | Toolbar compacted to "zoom out / zoom in / reset / rotate left / rotate right / fullscreen / ⋯More"; left/right docking degrades to bottom; status bar compacted to "page + zoom"; thumbnails 48×48; the metadata panel becomes a bottom drawer |

The criterion is the **actual width of the component container** (CSS container queries + `ResizeObserver`), decoupled from the browser viewport, so it responds correctly in any layout.

### 6.3 Troubleshooting

**Q: Cross-origin images produce WebGL texture creation warnings in the console; the image still shows but performance is mediocre?**

This is OpenSeadragon's WebGL renderer automatically falling back to the Canvas renderer when it cannot read cross-origin pixels; functionality is unaffected. If the image service is correctly configured with CORS (as the IIIF Image API spec requires), enabling the cross-origin policy explicitly is recommended for WebGL acceleration and `canvas` export support:

```vue
<IiifViewer :source="source" :osd-options="{ crossOriginPolicy: 'Anonymous' }" />
```

Or set it globally:

```ts
app.use(createIiifViewer({ osdOptions: { crossOriginPolicy: 'Anonymous' } }))
```

> Note: if some images do not send CORS headers, enabling this will cause loading failures, so the component does **not** force it by default.

**Q: The address does not contain "manifest"; can it still be detected?**

Yes. The detection order is: URL heuristics (containing `manifest` / `/collection/` / `/presentation/`) → request `{url}/info.json` → if the response body is actually a manifest, parse it as a manifest → if the `info.json` request fails, fall back to requesting the original address and detect from the content.

**Q: Why is the IIIF tileSource passed as a URL string rather than `{ type: 'iiif', url }`?**

OpenSeadragon's `IIIFTileSource.supports()` only inspects the **content characteristics** of `info.json` (`protocol` / `@context` etc.) and does not recognize the `{ type: 'iiif', url }` form; only `{ type: 'image', url }` is an inline configuration that OSD explicitly supports. The component generates the corresponding tileSource automatically per this convention, so consumers need not care.

**Q: The viewer height collapses after setting `aspectRatio` to `'auto'`?**

`'auto'` means filling the parent height, so the **parent container must have a definite height** (e.g. `height: 640px` or a concrete height in a flex layout). If you want the component to decide its own height, use a concrete ratio such as `'4 / 3'` or `'16 / 9'`.

**Q: No thumbnail strip or paging buttons for a single-canvas resource?**

This is expected: `pageNav` and `thumbnails` are rendered only when `canvases.length > 1`.

**Q: Can the floating toolbar still be clicked after a right-side panel opens?**

Yes. The side panel's layer (`--iiif-z-panel: 15`) sits deliberately **below** the floating toolbar (`--iiif-z-toolbar: 20`), so the drawer never covers the toolbar and its buttons stay clickable; panel content additionally leaves `--iiif-toolbar-clearance` (`64px`) of bottom space so it is not occluded by the toolbar.

**Q: How do I disable the color adjustment module? Does the filter affect the navigator?**

Set `colorAdjust` to `false`: the toolbar hides the color button, no panel is rendered, and the canvas filter is cleared (you can also set it globally via `createIiifViewer({ colorAdjust: false })`). The filter is applied inline only on the OSD `.openseadragon-canvas` container, so the **navigator is a separate element and is not tinted**; it also covers all three renderers (Canvas / WebGL / HTML).

**Q: How do I inject an OpenSeadragon loaded from a CDN `<script>`?**

If the page only has the global `window.OpenSeadragon` (without bundler resolution), pass it to the `openseadragon` prop or the plugin config:

```ts
app.use(createIiifViewer({ openseadragon: window.OpenSeadragon }))
```

The injected object must be isomorphic to the OSD default export (callable, and exposing members such as `Viewer` / `Viewport`), and it goes through `verifyOpenSeadragon()`; see [2. Tech Stack and Versions](#2-tech-stack-and-versions).

### 6.4 Public IIIF resources verified locally

The playground presets the following resources for end-to-end verification:

| Resource                                                                | Type                           | Notes                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `https://iiif.wellcomecollection.org/presentation/b18035723`            | Presentation 3 · 36 canvases   | Multilingual labels, metadata, rights, provider, canvas thumbnails; includes a TOC (Front Cover / Title Page / Back Cover) |
| `https://iiif.harvardartmuseums.org/manifests/object/299843`            | Presentation 2 · single canvas | A v2 manifest with 8 metadata entries                                                                                      |
| `https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json`         | Presentation 3 · 5 canvases    | An official IIIF Cookbook example; canvases have no label (falls back to `Canvas N`)                                       |
| `https://iiif.io/api/image/3.0/example/reference/…-gottingen/info.json` | Image API 3.0                  | Official IIIF example image                                                                                                |
| `https://iiif.io/api/image/2.1/example/reference/…-gottingen/info.json` | Image API 2.1                  | Official IIIF example image                                                                                                |

### 6.5 License

[MIT](./LICENSE)

### 6.6 Acknowledgements

- [IIIF](https://iiif.io/) —— the image interoperability framework specification
- [OpenSeadragon](https://openseadragon.github.io/) —— the deep-zoom rendering engine
- Built-in icon paths are drawn in the style of [Lucide](https://lucide.dev/) (ISC license)
