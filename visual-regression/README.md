# Visual regression baselines

`scripts/visual-regression-howitworks.mjs` writes screenshots of the homepage
"How it works" section here at three widths:

- `howitworks-mobile-390.png` — iPhone 12/13/14
- `howitworks-mobile-430.png` — iPhone Pro Max
- `howitworks-desktop-1280.png` — small desktop

## Run

```bash
bunx playwright install chromium   # one-time
PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-howitworks.mjs
```

Diff the new PNGs against the committed baselines (Git diff, Preview, or any
image-diff tool). Re-commit the baselines intentionally when the section's
design changes.

The script targets `[data-testid="how-it-works"]` on `/`. If that attribute is
removed or renamed, the script fails fast.
