<div align="center">

<img src="./src-tauri/icons/128x128@2x.png" alt="markmap_cc" width="128" height="128" />

# markmap_cc

**A native desktop editor where Markdown and mind maps live as one.**

Every note is a zoomable, editable, exportable mind map.

[![Tauri](https://img.shields.io/badge/Tauri-2.10-FFC131?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-1.77+-CE412B?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Platform](https://img.shields.io/badge/macOS-Apple%20Silicon-000?logo=apple&logoColor=white)](#-download)
[![Release](https://img.shields.io/github/v/release/clearsky0601/markmap_cc?color=blueviolet)](https://github.com/clearsky0601/markmap_cc/releases)

**English** · [简体中文](./README.md)

</div>

---

## ✨ What is this

`markmap_cc` is a desktop-class **Markdown × mind-map** editor built with **Tauri + React**.

The core idea is simple — **Markdown _is_ the map, the map _is_ Markdown**:

- Type Markdown on the left, see the live mind map on the right. **Two-way, real-time sync.**
- Double-click a node to edit text in place — the underlying Markdown is patched surgically, preserving your original formatting.
- Stuck? Box-select a branch, drop it into the AI side panel as a quoted context, and let the model continue your line of thinking.

## 🎯 Features

| | |
|---|---|
| 🧠 **Two-way Markdown ↔ map sync** | The editor and markmap view stay in lockstep. |
| ✍️ **Inline node editing** | Double-click a node to edit; overlay font and padding scale with zoom. |
| 🪟 **Multi-select & box-select** | Drag to lasso, `⌘+Click` to add or remove from selection. |
| ↩️ **Unified undo stack** | `⌘Z / ⌘⇧Z` works across both the editor and the map. |
| 🤖 **Built-in AI chat** | Any OpenAI-compatible provider; selected nodes become quoted context. |
| 📁 **File tree + recents** | Left sidebar manages local Markdown files; recents are tracked automatically. |
| 👀 **External-change detection** | Edited the file in another app? You get a reload prompt — no silent overwrites. |
| 💾 **Autosave** | Saves quietly in the background; `⌘S` defaults to your **H1 title** as the filename. |
| 🎨 **Theming** | Light / dark / follow-system. |
| 📤 **Export** | One-click export to **PNG** or **SVG**. |
| ⚡ **Native performance** | Tauri, not Electron — small bundle, fast startup, low memory. |

## 📦 Download

**Latest: [v0.1.0](https://github.com/clearsky0601/markmap_cc/releases/tag/v0.1.0)**

| Platform | File |
|---|---|
| 🍎 macOS (Apple Silicon) | [`markmap_cc_0.1.0_aarch64.dmg`](https://github.com/clearsky0601/markmap_cc/releases/download/v0.1.0/markmap_cc_0.1.0_aarch64.dmg) |
| 📦 Source | [`markmap_cc-0.1.0-source.zip`](https://github.com/clearsky0601/markmap_cc/releases/download/v0.1.0/markmap_cc-0.1.0-source.zip) |

> ⚠️ Only an Apple Silicon build is published right now. Intel Mac / Windows / Linux builds are on the roadmap.

> The app is unsigned. macOS will warn the first time you open it. Allow it in *System Settings → Privacy & Security*, or run:
>
> ```bash
> xattr -dr com.apple.quarantine /Applications/markmap_cc.app
> ```

## ⌨️ Shortcuts

| Action | Keys |
|---|---|
| Open file | `⌘O` |
| Save | `⌘S` (suggests H1 as filename when untitled) |
| Undo / Redo | `⌘Z` / `⌘⇧Z` |
| Add to selection | `⌘+Click` |
| Box-select | Drag on empty canvas |

## 🛠️ Build from source

Requires [Rust](https://www.rust-lang.org/tools/install) (1.77+) and [Bun](https://bun.sh) (recommended) or Node.js + npm.

```bash
# Clone
git clone https://github.com/clearsky0601/markmap_cc.git
cd markmap_cc

# Install
bun install

# Dev mode (hot reload)
bun tauri dev

# Release build (.app + .dmg on macOS)
bun tauri build
# Output: src-tauri/target/release/bundle/{macos,dmg}/
```

## 🧱 Tech stack

<table>
  <tr>
    <td><b>Frontend</b></td>
    <td>React 19 · TypeScript · Vite · Zustand · CodeMirror 6 · markmap-lib · markmap-view</td>
  </tr>
  <tr>
    <td><b>Markdown</b></td>
    <td>unified · remark-parse · mdast-util-to-markdown · unist-util-visit</td>
  </tr>
  <tr>
    <td><b>Desktop shell</b></td>
    <td>Tauri 2 · Rust 2021 · notify · reqwest</td>
  </tr>
  <tr>
    <td><b>Plugins</b></td>
    <td>tauri-plugin-fs · tauri-plugin-dialog · tauri-plugin-store · tauri-plugin-log</td>
  </tr>
</table>

## 🗺️ Roadmap

- [ ] Intel Mac (`x86_64-apple-darwin`) build
- [ ] Windows / Linux builds
- [ ] Code signing + auto-update
- [ ] Tags / backlinks / full-text search
- [ ] Per-node fold-state persistence
- [ ] iPad-friendly layout exploration

## 🤝 Contributing

Issues and PRs are welcome.

1. Fork → branch → change → `bun run lint` → `bun tauri build` to self-check
2. PR description: motivation, what changed, screenshots if UI

## 🙏 Acknowledgements

- [markmap](https://github.com/markmap/markmap) — the engine that turns Markdown into a mind map
- [Tauri](https://tauri.app) — turns a web app into a 5MB native desktop bundle
- [CodeMirror](https://codemirror.net) — the editor under the hood

---

<div align="center">

If this project helps you, a ⭐ is the best kind of thanks ✨

</div>
