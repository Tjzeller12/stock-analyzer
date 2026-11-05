# Ticker Glass — AlphaBot design language

Status: v1, applied to MainPage first. Other pages adopt it incrementally.

## Concept

**A trading floor at night, seen through glass.**

Two materials, one rule each:

| Material | Era | Job | Rule |
|---|---|---|---|
| **Glass** | Modern | Structure: panes, bars, buttons | Glass *holds* things. It is never the message. |
| **Signal** (LED dot-matrix) | Old Wall Street | Information that moves with the market | **If it changes with the market, it lights up.** |

Everything else (labels, paragraphs, news headlines, form text) is clean modern sans. The LED treatment is rationed — if every word glows, nothing does.

## 1. The dot grid

The signature of the language. One uniform dot grid underlies every display surface. Characters are not drawn *on* the grid — they are made *of* it. Lit dots form the glyph; the surrounding dots stay visible but dark ("unlit"), like a real board.

- Lit and unlit dots share **one grid per display**: the display paints the unlit dots, and a dot-shaped mask on its content layer turns solid glowing text into lit dots at the same positions. The mask stays still while content moves under it (the ticker), so dots switch on and off like a real board.
- Never use `background-attachment: fixed` for this. It forces Chrome to repaint on every scroll frame and stalls the ticker.
- Pitch (dot spacing) is a token, not a free choice:

| Token | Pitch | Use |
|---|---|---|
| `--led-pitch-sm` | 2px | Card titles, small readouts (≥ 14px text) |
| `--led-pitch-md` | 3px | Stat values, ticker tape (≥ 20px text) |
| `--led-pitch-lg` | 4px | Hero numbers (≥ 36px text) |

- Below ~14px, LED text is illegible. Never use it there — use `font-mono` tabular numbers in the signal color instead.

## 2. Color

Brand green stays the anchor. Signal colors are its *emissive* versions — what the green looks like when it's light rather than paint.

| Token | Dark | Light | Meaning |
|---|---|---|---|
| `--primary-green` | `#069042` | `#069042` | Brand. Buttons, accents. Unchanged. |
| `--signal-up` | `#2cff8f` | `#2cff8f` | Lit LED: gains, positive, "live" |
| `--signal-down` | `#ff4d5e` | `#ff4d5e` | Lit LED: losses |
| `--signal-flat` | `#ffb238` | `#ffb238` | Lit LED: neutral, warnings, stale data (classic amber board) |
| `--signal-text` | `#e9fff2` | `#e9fff2` | Lit LED: neutral readouts (white-green phosphor) |
| `--led-off` | white 7% | white 7% | Unlit dot |
| `--canvas` | `#040806` | `#e9eeeb` | The night behind the glass |

Signal colors are identical in both themes because **displays are always dark** (see §3). Only glass and canvas change with the theme.

Signal colors are emissive and only work on a display. For up/down text directly on a pane (table cells, news sources), use the **ink** versions, which change per theme for contrast:

| Token | Dark | Light |
|---|---|---|
| `--ink-up` | `#2ee88a` | `#07803c` |
| `--ink-down` | `#ff5d6c` | `#d42c3d` |

## 3. Surfaces (back to front)

1. **Canvas** — near-black with a few huge, heavily blurred color glows (green, a little amber/red) fixed to the viewport. This is the city bokeh from the photos, and it's functional: glass only reads as glass when there is something behind it to blur.
2. **Pane** (`.tg-pane`) — the card. Frosted glass: `backdrop-filter: blur + saturate`, a top-lit gradient, a 1px specular highlight on the top edge, and a diagonal reflection streak across the surface. A very faint dot grid sits *behind* the glass, as if the pane were mounted in front of a switched-off board.
3. **Display** (`.tg-display`) — a recessed LED module set into a pane. Always dark, in both themes, with the unlit dot grid clearly visible and an inner shadow. LED text lives here.
4. **Well** — a shallow recess in a pane for control bars and filters (`bg-black/5 dark:bg-black/30`, inner shadow, hairline border). Unlike a display it follows the theme, because it holds ordinary UI text.
5. **Chip / keycap** (`.tg-btn`) — glass buttons. Primary buttons are green glass with an inner glow; secondary are clear glass.

Corners: panes `20px`, displays `12px`, buttons `10px`. Borders are always translucent white (never grey).

## 4. Typography

| Role | Font | Notes |
|---|---|---|
| UI / body | Inter (variable) | Everything readable. Headlines `600–700`, body `400–500`. |
| Numbers | JetBrains Mono, `tabular-nums` | Prices, %, counts inside tables and lists. Columns of digits must align. |
| LED | JetBrains Mono `800`, dot-masked | Card titles, stat values, ticker tape. Uppercase, tracking `0.08em`. |

Card titles are LED, uppercase, small (`--led-pitch-sm`) — they read like the label strip on a terminal.

## 5. Motion

- **Ticker tape** scrolls continuously (≈ 40px/s), pauses on hover.
- **No hover sheen.** A flying highlight across every pane is too much, especially on the stock page. Glass is a static top-edge highlight only. Panes do not scale or animate on hover.
- **Live dot** — a single pulsing signal-up dot next to anything that's live data.
- All motion is disabled under `prefers-reduced-motion`.
- Do not use `backdrop-filter` on panes: N cards each sampling the page behind them will hitch. Tint + the canvas glow is enough.
- Do not duplicate LED DOM for glow (`filter: blur` copies overflow the card and fight the ticker). Glow is a post-mask `drop-shadow` on `.tg-led-layer`.

## 6. Components (MainPage v1)

| Component | Treatment |
|---|---|
| `Header` | Glass bar over the canvas. Title in LED. Nav as glass keycaps. |
| `TickerTape` (new) | Full-width display strip under the header. Watchlist + holdings scroll as `SYMBOL  PRICE  ▲ +1.23%` in signal colors. |
| `Card` | Becomes a pane. Title becomes an LED label with a live dot. |
| `PerformanceSummary` | Stat tiles become displays with LED values — the hero moment. |
| Stock tables | Transparent on the pane, uppercase micro headers, mono tabular numbers, gains/losses in ink colors, green-tinted hover row. |
| News | Glass rows; source in `ink-up` mono, time in muted mono. |
| Buttons / controls | Keycaps. Control bars and filters sit in wells. |

## 7. Do / don't

- **Do** light up prices, returns, titles, and the ticker. **Don't** light up paragraphs, form labels, or anything under 14px.
- **Do** put LED text only on a display (dark surface with unlit dots). **Don't** put LED text directly on a light pane.
- **Do** use signal red/green only for direction (up/down). **Don't** use them decoratively.
- **Do** keep panes translucent. **Don't** give a pane an opaque background — it stops being glass.

## 8. Implementation map

- Tokens and utilities: `client/src/index.css` (`--tg-*` / `--signal-*` / `--led-*` variables, `.tg-*` classes).
- LED: `<LedDisplay pitch>` + `<LedText tone>` (`components/common/LedText.tsx`). Padding goes on the display's layer (`layerClassName`), never on the display, or the two grids drift apart. Labels under 14px sit outside the display. Glow comes from a blurred, unmasked copy behind the dots (`.tg-led-bloom`). Never put glow inside the mask: it lights neighbouring dots and fattens the glyphs.
- Surfaces: `Card` (pane), `LedDisplay`, `.tg-btn`, `.tg-btn-primary` (flat green, glow on hover only — no gloss), `.tg-input` (text fields, selects, CodeMirror).
- Fonts: `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` (bundled, no CDN).
- Tailwind `dark:` is bound to the app's `data-theme="dark"` (not the OS setting) via `@custom-variant` in `index.css`.

## 9. Rollout

`Card`, `Header`, the canvas, and the `dark:` fix are shared. Applied on MainPage, Stock page (LED quote board, glass metric categories, pill timeframe selector kept), and Discovery (LED tickers on recommendation cards). Still to adopt: Profile, Onboarding, Login/Register.
