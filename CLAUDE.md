# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A static (no build step) multi-page site under the Tipak brand. Five pages across two architectural tiers:

- **Brand/content pages** — root (`index.html`), `chi-siamo/` *(not yet built — pending founder bio content)*, `articoli/` (3 static articles + an index). These all share one `style.css` and one `brand.js` at the repo root (subpages reference them via `../style.css` / `../brand.js`). They're the same editorial voice/visual system (dark, Linear/Stripe-inspired minimal aesthetic), so duplicating that CSS three times wasn't worth it.
- **Product pages** — `curriculab/` and `aziende/`. Each is **fully self-contained**: its own `style.css`/`script.js`, no dependency on the root files or on each other. They're different tools with deliberately different visual identity (Curriculab is light-themed, `aziende/` is dark) — that's why they don't share the brand stylesheet.

There is no package.json, bundler, linter, or test suite anywhere in the repo — just plain files served directly. There's also no CMS/database behind the articles — they're hand-written HTML.

**The Tipak logo** is a small inline SVG snippet (pin/marker icon in `#ff6a00` + "TIPAK" wordmark that inherits the surrounding text color) pasted into every page's header/footer — not an image file, not a shared partial. If the logo needs to change, it has to be updated in each page.

## Commands

There is no build/lint/test tooling. To preview any page locally, serve the repo root with any static file server, e.g.:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/` (Tipak home), `http://localhost:8000/curriculab/` (CV builder), `http://localhost:8000/aziende/` (waitlist page), or `http://localhost:8000/articoli/` (articles). Opening the HTML files directly (`file://`) also works since there are no server-side dependencies, except for the subpages' relative `../style.css` references which need an actual server (or a `file://` root one level up) to resolve correctly.

## Architecture — Curriculab (`curriculab/`)

Light theme (white/near-white backgrounds, dark text, orange `--acc` used only for brand/action accents) — this was a deliberate restyle away from an earlier all-dark version, for readability. Responsive below `768px` (`.split-container` stacks to a single column; above that breakpoint it's a fixed side-by-side split and intentionally has no other responsive behavior). `buildCVHTML()` (the PDF/export path) must escape every interpolated field with the existing `esc()` helper, same as the live preview does — it didn't for a while and unescaped `&`/`<`/`>` in any field (e.g. a company named "AT&T") silently broke the exported HTML; don't reintroduce that gap.

Single-page, split-view app: left half is a form (`#form-section`), right half is a live A4 preview (`#preview-section`). There is no framework and no separate state object — **the DOM inputs are the source of truth**. Everything is driven by one function, `aggiornaCV()` (in `script.js`), called on virtually every `oninput`/`onchange` in `index.html`. On each call it:

1. Re-reads every form field directly from the DOM.
2. Re-renders the corresponding preview blocks in `#cv-document`.
3. Recomputes the ATS score (`calcolaATS()`, 7 boolean checks → percentage badge).
4. Autosaves the whole form to `localStorage` (`salvaLavoroAutomatico()`, key `cv_builder_autosave`).

`init()` (called from `<body onload="init()">`) restores that `localStorage` snapshot on load, or seeds one empty box per repeatable section on first visit.

**Repeatable sections** (Esperienze, Formazione, Lingue, Certificazioni) follow the same pattern, each with its own `crea Box*()` / `aggiungi*()` pair and a module-level counter (`expCount`, `forCount`, `linCount`, `certCount`). The counter is only used to label new boxes ("Esperienza 3") — reading values back out is always done by re-querying `.exp-input-box` / `.for-input-box` / `.lin-input-box` / `.cert-input-box` in DOM order, never by index/id, so counters and DOM order can drift without breaking anything except the labels. `rimuoviBox()` is generic and works for all four box types via `.closest('.dyn-card')`.

**PDF export is intentionally not a screenshot/canvas render.** `generaPDF()` calls `buildCVHTML()`, which independently re-reads the same form fields and returns a fully self-contained HTML document (own inline `<style>`, A4 print rules) — this is a separate render path from the live preview, not a serialization of it. The result is opened via a blob URL in a new tab for the user to print-to-PDF (falls back to a file download if the popup is blocked). This keeps the exported PDF's text real/selectable, which is the whole point (readable by ATS parsers like Taleo/SuccessFactors) — do not reintroduce an image-based export (e.g. html2pdf.js/canvas) here, that was deliberately removed.

**Supabase**: `script.js` creates `supabaseClient` at module load with a hardcoded project URL + publishable key. `salvaCandidato()` upserts into a `candidati` table but **is not currently called from anywhere** in the app — treat it as present-but-unwired rather than dead code to delete without checking first.

## Architecture — `aziende/`

Self-contained waitlist page with its own `script.js`/`style.css`, no dependency on the other pages. Two identical forms (hero + bottom CTA) both call `collegaForm()`, which validates the email client-side and inserts into a Supabase table named `waitlist` (different table from `curriculab/`'s `candidati`, same Supabase project/key). That `waitlist` table is not created by any code in this repo — it must exist in the Supabase project's schema (with an `insert`-only RLS policy for `anon`) for the form to work.

Also includes a fake interactive map demo (`#demo` section): a hand-drawn SVG city illustration (streets, park, water, decorative compass/zoom/scale chrome — no external map tiles/libraries) with clickable pins over hardcoded fake company data (`AZIENDE_DEMO` in `script.js`). Selecting a pin fills a details panel; its CTA scrolls to the waitlist form rather than doing anything real — there's no backend behind the fake companies.

## Deploy

The live site (`tipak.me`) is a Netlify site nominally linked to this repo's GitHub `main` branch for auto-deploy — but pushing to GitHub from a Claude Code session has been blocked (integration lacks write access; not fixable from within a session). The working deploy path has been manual: build/edit locally, then either drag-and-drop the changed folders onto the site's Deploys page in the Netlify dashboard, or use the Netlify MCP connector's `deploy-site` operation if it's connected and the sandbox's network policy allows reaching `netlify-mcp.netlify.app` (it hasn't, in every session tried so far — that's a sandbox egress restriction, not a Netlify/account problem). Don't assume `git push` works; check before relying on it.
