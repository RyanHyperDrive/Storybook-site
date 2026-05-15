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
`/create/profile`, `/create/photos`, `/create/story`, `/create/style`,
`/create/character-sheet`.

### Deterministic fixtures

All wizard data is pinned by `scripts/fixtures/create-journey.js`. Before
each navigation the script:

- freezes `Date.now()` / `new Date()` at a fixed moment,
- forces `prefers-reduced-motion: reduce` so transitions don't flicker,
- seeds `localStorage` with a fake Supabase auth session, a fixed draft
  book id, and a fixed profile draft,
- mocks every Supabase REST/Storage/Auth call to return the same fixture
  rows (book, child profile, uploaded photo, child subject) and a stable
  placeholder image for any signed URL.

That means screenshots do not depend on the real backend, the real time,
randomly-generated UUIDs, or animation phase. To change what the fixture
renders, edit `scripts/fixtures/create-journey.js` only.

For each route + viewport it asserts:

- `[data-testid="wizard-layout"]` is visible (the auth gate must NOT render —
  fixture session is supposed to bypass it),
- exactly one `<h1>`,
- the stepper exposes all 5 steps,
- no `pageerror` or `console.error` while loading.

```bash
bunx playwright install chromium   # one-time
PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-create-journey.mjs
```

Screenshots: `visual-regression/create-journey/{slug}-{desktop-1280,mobile-390}.png`.

### Required test hooks

- `[data-testid="wizard-layout"]` — root of `WizardLayout`
- `[data-testid="wizard-stepper"]` — the 5-step `<ol>` inside the layout
- `[data-testid="auth-gate"]` — root of the `SignInPanel` rendered by `AuthGate`


### Pixel-diff against baseline

`scripts/visual-regression-create-journey-diff.mjs` compares the freshly
captured screenshots against committed baselines under
`visual-regression/create-journey/baseline/` using `pixelmatch`. CI fails the
build if any image differs by more than the ratio threshold.

```bash
# 1. capture screenshots (must run first)
PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-create-journey.mjs

# 2. diff vs committed baselines
node scripts/visual-regression-create-journey-diff.mjs
```

Knobs (env vars):

- `DIFF_PIXEL_THRESHOLD` — per-pixel color tolerance, 0..1. Default `0.1`.
- `DIFF_RATIO_THRESHOLD` — max fraction of differing pixels per image.
  Default `0.005` (0.5%). Anything higher fails the build.
- `UPDATE_BASELINES=1` — overwrite baselines from the latest screenshots and
  skip diffing. Use locally after a deliberate UI change, then commit
  `visual-regression/create-journey/baseline/*.png`.

When CI fails, the diff PNGs are written to
`visual-regression/create-journey/diff/` and uploaded as part of the
`visual-regression-screenshots` artifact alongside the actual + baseline
images.

## Homepage hero + first-steps

`scripts/visual-regression-home.mjs` captures the homepage above-the-fold
viewport, the hero section (`[data-testid="hero"]`), and the "How it works"
first-steps section (`[data-testid="how-it-works"]`) at desktop (1280) and
mobile (390). It also asserts the H1, primary CTA, $29.99 price, 4 hero trust
bullets, and 4 numbered steps are present. PNGs are written to
`visual-regression/home/`.

Run locally:

```sh
PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-home.mjs
```

## /pricing pixel-diff

`scripts/visual-regression-pricing.mjs` captures the full /pricing page plus
the hero, pricing card, add-ons row, and FAQ at desktop (1280) and mobile
(390), with `data-testid` hooks (`pricing-hero`, `pricing-card`,
`pricing-addons`, `pricing-faq`). Output goes to `visual-regression/pricing/`.

`scripts/visual-regression-pricing-diff.mjs` then diffs each PNG against the
committed baseline in `visual-regression/pricing/baseline/` using pixelmatch
and fails if more than `DIFF_RATIO_THRESHOLD` (default 0.5%) of pixels differ.

Two-step run:

```sh
PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-pricing.mjs
node scripts/visual-regression-pricing-diff.mjs
```

To refresh baselines after an intentional design change:

```sh
UPDATE_BASELINES=1 node scripts/visual-regression-pricing-diff.mjs
```

## /pricing accessibility (axe-core)

`scripts/a11y-pricing.mjs` runs axe-core against `/pricing` at desktop (1280)
and mobile (390) using WCAG 2.1 A + AA + best-practice rules. Build fails on
any `serious` or `critical` violation (color contrast, button-name, ARIA,
landmarks, etc.). Full JSON reports per viewport are written to
`visual-regression/pricing-a11y/`.

Run locally:

```sh
PREVIEW_URL=http://localhost:8080 node scripts/a11y-pricing.mjs
```

Tune via env vars:

- `A11Y_FAIL_IMPACTS` — comma list of impact levels that fail the run.
  Default `serious,critical`. Use `minor,moderate,serious,critical` to be
  stricter, or `critical` to be looser.
- `A11Y_DISABLE_RULES` — comma list of axe rule ids to skip
  (e.g. `region,landmark-one-main`) when a finding is owned by shared layout
  code outside this page.

## /checkout accessibility (axe-core)

`scripts/a11y-checkout.mjs` runs axe-core against `/checkout/<bookId>` at
desktop (1280) and mobile (390). The page requires an authenticated user
and a real book row, so the script reuses the deterministic fixtures from
`scripts/fixtures/create-journey.js` to mock Supabase auth, REST, and
storage — no real backend calls. Build fails on any `serious` or
`critical` violation. JSON reports are written to
`visual-regression/checkout-a11y/`.

Run locally:

```sh
PREVIEW_URL=http://localhost:8080 node scripts/a11y-checkout.mjs
```

`A11Y_FAIL_IMPACTS` and `A11Y_DISABLE_RULES` work the same as for the
/pricing axe script.

## /checkout pixel-diff

`scripts/visual-regression-checkout.mjs` captures the full /checkout page,
the price card (`[data-testid="checkout-price-card"]`), and the primary CTA
(`[data-testid="checkout-cta"]`) at desktop (1280) and mobile (390). It
reuses the create-journey fixtures (mocked Supabase auth/REST/storage,
frozen clock) so the page renders the same book + $29.99 every run.
Screenshots go to `visual-regression/checkout/`.

`scripts/visual-regression-checkout-diff.mjs` then diffs each PNG against
the committed baseline in `visual-regression/checkout/baseline/` using
pixelmatch and fails when more than `DIFF_RATIO_THRESHOLD` (default 0.5%)
of pixels differ.

Two-step run:

```sh
PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-checkout.mjs
node scripts/visual-regression-checkout-diff.mjs
```

To refresh baselines after an intentional design change:

```sh
UPDATE_BASELINES=1 node scripts/visual-regression-checkout-diff.mjs
```

## /checkout/success + /checkout/cancel pixel-diff

`scripts/visual-regression-checkout-post.mjs` captures the full
`/checkout/success` (done state) and `/checkout/cancel` pages at desktop
(1280) and mobile (390). It reuses the create-journey fixtures (mocked
Supabase auth/REST) so the success page renders in the "Payment received"
state without touching the backend. Screenshots go to
`visual-regression/checkout-post/`.

`scripts/visual-regression-checkout-post-diff.mjs` diffs each PNG against
committed baselines in `visual-regression/checkout-post/baseline/` using
pixelmatch, failing CI above `DIFF_RATIO_THRESHOLD` (default 0.5%).

Two-step run:

```sh
PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-checkout-post.mjs
node scripts/visual-regression-checkout-post-diff.mjs
```

To refresh baselines after an intentional design change:

```sh
UPDATE_BASELINES=1 node scripts/visual-regression-checkout-post-diff.mjs
```
