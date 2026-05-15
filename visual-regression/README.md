# Visual regression baselines

## How it works section

`scripts/visual-regression-howitworks.mjs` writes screenshots of the homepage
"How it works" section here at three widths:

- `howitworks-mobile-390.png` — iPhone 12/13/14
- `howitworks-mobile-430.png` — iPhone Pro Max
- `howitworks-desktop-1280.png` — small desktop

```bash
bunx playwright install chromium   # one-time
PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-howitworks.mjs
```

The script targets `[data-testid="how-it-works"]` on `/`. If that attribute is
removed or renamed, the script fails fast.

## Sample reader modal ("Five art styles")

`scripts/visual-regression-sample-modal.mjs` opens each of the 5 sample books
from the homepage, clicks through Cover → Dedication → Page 1 → Page 2, and:

- saves a screenshot of the modal at Page 1 and Page 2 to
  `visual-regression/sample-modal/{style}-{viewport}-page{1,2}.png`
  for desktop (1280) and mobile (390),
- asserts the illustration panel is **not mostly blank cream/white** by
  drawing the rendered `<img>` into a canvas and checking both the
  non-near-white pixel ratio (≥ 0.55) and the per-channel color range (≥ 60),
- asserts the footer trust line ("Fictional sample preview…") and the
  "Start free character preview" CTA stay visible.

```bash
bunx playwright install chromium   # one-time
PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-sample-modal.mjs
```

Exit code is non-zero on any failure (blank illustration, missing footer/CTA,
selector change).

### Comic Book art-content rule

The Comic Book sample (`comic_book-*.png`) must remain free of:

- speech bubbles or word balloons (filled or empty),
- caption boxes,
- sound-effect words ("BAM", "POW", …),
- any readable embedded text inside the artwork.

This is enforced by the generation prompt and asset review — the script
cannot OCR for it. Whenever the comic_book sample assets change, open the
saved `comic_book-desktop-1280-page1.png` and `comic_book-desktop-1280-page2.png`
and visually confirm the rule before committing.

### Required test hooks

The script depends on these stable selectors — do not remove them without
updating the script:

- `[data-testid="samples"]` on the "Five art styles" section
- `[data-testid="sample-card-{styleKey}"]` on each sample cover button
- `[data-testid="modal-illustration"]` on the modal's illustration panel
- The modal's pager "Next page" button (`aria-label="Next page"`)
- Footer copy beginning with "Fictional sample preview"
- Footer link labelled "Start free character preview"

## /create guided landing

`scripts/visual-regression-create.mjs` captures `/create` at desktop (1280) and
mobile (390) and asserts the conversion-critical building blocks remain intact:

- H1 + primary "Start free character preview" CTA visible
- `$29.99` pricing line near the CTA
- 4-item trust grid (`[data-testid="trust-grid"]`): private photos, no model
  training, parent-approved, free regeneration
- "What happens after you start" pipeline strip — every step from
  About child → Photo upload → Story + style → Approve character → Pay (only now) → Ready in 10–20 min
- Journey preview panel (`[data-testid="journey-preview"]`) with ≥3 images
- 5 step cards
- On mobile: headline, CTA, and trust grid render within the first ~1400px
  (no awkward empty space pushing trust below the fold)

```bash
bunx playwright install chromium   # one-time
PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-create.mjs
```

Screenshots: `visual-regression/create/create-{desktop-1280,mobile-390}.png`.

### Required test hooks

- `[data-testid="create-landing"]` — root of `/create`
- `[data-testid="trust-grid"]` — 4-item trust list near the CTA
- `[data-testid="journey-preview"]` — photo→character→book panel

## /create wizard journey

`scripts/visual-regression-create-journey.mjs` walks every step of the
multi-step book creation flow at desktop (1280) and mobile (390):

- `/create/profile` — must render the wizard layout (auth-optional)
- `/create/photos`, `/create/story`, `/create/style`, `/create/character-sheet`
  — must render either the wizard layout or the sign-in gate (these routes
  are auth-gated, so unauthenticated runs are expected to land on the gate)

For each route + viewport it asserts:

- `[data-testid="wizard-layout"]` OR `[data-testid="auth-gate"]` is visible
- exactly one `<h1>` is rendered
- when the wizard renders, the stepper exposes all 5 steps
- no `pageerror` or `console.error` was emitted while loading

```bash
bunx playwright install chromium   # one-time
PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-create-journey.mjs
```

Screenshots: `visual-regression/create-journey/{slug}-{desktop-1280,mobile-390}.png`.

### Required test hooks

- `[data-testid="wizard-layout"]` — root of `WizardLayout`
- `[data-testid="wizard-stepper"]` — the 5-step `<ol>` inside the layout
- `[data-testid="auth-gate"]` — root of the `SignInPanel` rendered by `AuthGate`

