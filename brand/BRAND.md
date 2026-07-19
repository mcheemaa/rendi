# Rendi brand

Rendi (REN-dee), from the Italian verb rendere: to render, and to give back. The
product turns questions into live interfaces that remember how you use them.

> Questions become interfaces.

## The wordmark

`rendi-wordmark.svg`. A monoline script drawn as one continuous stroke that writes
itself, ending when the dot of the i lands as an amber datapoint and stays alive.
The name is a verb meaning "you render"; the logo performs it.

- Transparent background. The stroke inherits `currentColor`; place it on any
  surface and set the text color.
- The dot reads `var(--rendi-accent)` and stays amber in every theme.
- It ships as a pair. `rendi-wordmark.svg` is static and renders identically in
  every consumer (browsers, img tags, previews, sanitizers).
  `rendi-wordmark-animated.svg` carries the SMIL self-writing draw and plays in
  browsers, including inside img tags. In-app inline surfaces use the CSS draw
  pattern shown on the brand board, which also respects `prefers-reduced-motion`.
- The draw is also the product's loading language.

## The mark

The ri ligature: the wordmark's r flowing into its i in one continuous stroke,
first letter to last, with the amber dot landing as the i's tittle.
`rendi-mark.svg` is the static form; `rendi-mark-animated.svg` writes itself
cursively (same draw system as the wordmark, faster). `favicon.svg` is the tab
form: its ink adapts to the browser theme, the dot stays amber. At 16 pixels
the atomic form is the dot alone.

## Color: the Ember system

Defined in `tokens.css`, light and dark designed together.

| Token | Light | Dark |
| --- | --- | --- |
| Background | #F8F5EF | #0E1113 |
| Surface | #FFFFFF | #171B1F |
| Ink | #1E2226 | #EBE8E1 |
| Muted | #6E6A61 | #A29C90 |
| Line | #E6E1D6 | #262B30 |
| Accent (amber) | #B97A18 | #E8A33D |
| Chart 1 amber | #B97A18 | #C68128 |
| Chart 2 teal | #068C7C | #159C88 |
| Chart 3 violet | #7A5EA8 | #7D6BD9 |
| Chart 4 rose | #C14F4F | #C96262 |

Chart series colors are assigned in fixed order and passed a six-check palette
validation (lightness band, chroma floor, colorblind separation, normal-vision
separation, surface contrast) in each mode.

## Type

- UI: Instrument Sans
- Display and numerals: Instrument Serif
- Code and SQL: Geist Mono

## Rules

- The dot is the brand atom: the i's tittle, the mark's terminal, the loading
  pulse, the smallest favicon. It is always amber.
- One accent. Amber never competes with a second brand color.
- The wordmark draws itself at most once per surface; after that it rests.
- Never set the wordmark in a font. It is a drawing, not text.
