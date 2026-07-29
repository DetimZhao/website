# [detimzhao.github.io/website/](https://detimzhao.github.io/website/)

Personal site. Vanilla HTML, CSS, JS.

## Run

```sh
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

A local server is needed. Opening `index.html` directly can break video loading.

## Structure

| File | Purpose |
|------|---------|
| `index.html` | Page shell |
| `style.css` | Layout and animations |
| `script.js` | Binary rain, ASCII video overlay, interactions |
| `assets/videos/IMG_0783.mp4` / `_rev.mp4` | Clip 0 (forward + reverse) |
| `assets/videos/IMG_1309.mp4` / `_rev.mp4` | Clip 1 (forward + reverse) |
| `assets/videos/IMG_1417.mp4` / `_rev.mp4` | Clip 2 (forward + reverse) |
| `Detim_Zhao_Resume.pdf` | Resume |
| `favicon.svg` | DZ monogram |
| `apple-touch-icon.svg` / `.png` | iOS home screen icon |

## Features

- Binary rain canvas with spotlight follow
- WebGL ASCII video overlay with boomerang playback
- Clip rotation: sequential cycle across 3 clips with shader crossfade
- Rotating taglines and status line
- Bio panel toggle
- Keyboard shortcuts: `Space` play/pause, `N` next clip, `B` bio, `?` help
- Video opacity slider
- GoatCounter analytics

## Deploy

GitHub Pages via `.github/workflows/static.yml`. Resume PDF auto-synced via `update-resume.yml`.
