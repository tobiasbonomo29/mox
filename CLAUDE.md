# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Shopify theme for the MÖX eyewear store (Argentina), built on **Horizon 3.4.0**. Most files are stock Horizon; the store-specific work lives in files prefixed `mox-` (sections, blocks, snippets, assets) plus the JSON templates that wire them up. `docs/MOX-REDISENO.md` (Spanish) is the authoritative redesign log: architecture, admin changes made, pending admin configuration and known limitations — read it before larger changes.

The store owner communicates in Spanish (rioplatense, "vos"). Code comments, docs, user-facing theme text and commit messages are in Spanish; commit messages use the `MÖX: <descripción>` prefix.

## Commands

- `shopify theme dev --store a9pxrx-1g.myshopify.com --theme 189615604017 --store-password <clave>` — local preview at http://127.0.0.1:9292, synced to the **development theme `189615604017`**. The live theme is **"MOX 2026 - Septiembre" (#189870178609)**; the previous one, "MOX 2026 - Actualizado" (#189836591409), is kept unpublished as rollback. Older docs mention "Rebel". It must not be modified; publish (`shopify theme push`) only after the owner approves.
- The live theme gets edited outside git (Shopify code editor / theme editor). Before starting work, pull it into a scratch folder (`shopify theme pull --theme 189870178609 --path <tmp>`) and diff against the repo (`diff -rq --strip-trailing-cr`) so newer live changes aren't overwritten.
- `shopify theme check` — Theme Check lint. Unused legacy blocks carry ~27 pre-existing warnings (see below); don't add new ones.
- `node --test tests/mox-pricing.test.mjs` — tests for the pure pricing logic (`node --test tests/` fails on Node 24). Single test: add `--test-name-pattern="<nombre>"`.

There is no build step or package.json; assets are served as-is. `docs/` and `tests/` are excluded from uploads via `.shopifyignore`.

## Kit / pricing model (core business logic)

- Each line + frame combination is its own product with handle `{línea}-armazon-{armazón}` (e.g. `noche-armazon-marron`). `snippets/mox-product-meta.liquid` derives line/frame from the handle by matching the prefix against theme settings `mox_line_{1..3}_handle`; much of the theme depends on this convention.
- Each product has a **Kit** option with 3 variants ("Llevando 1/2/3"; one product uses "1 anteojo" — `parseTier` extracts the number). A variant's price is the **per-unit** price when buying N together.
- A kit of N glasses adds N real cart lines, each using the tier-N variant of its own product, with hidden properties `_moxKit` (kit id) and `_moxKitSize`. Shopify charges exactly those variant prices — never simulate discounts in the frontend.
- When a kit's quantity changes in the cart, lines are rebalanced to the matching tier variant (max 3), triggered by the theme's `cart:update` events and on page load (no polling).
- All amounts are integer cents; never operate with decimals.

JS layering (ES modules via the import map in `snippets/scripts.liquid`, `@theme/*` aliases):
- `assets/mox-pricing.js` — pure logic, no DOM (`resolveKit`, `planRebalance`, `installments`, …). Keep it DOM-free so it stays testable from Node.
- `assets/mox-cart.js` — serialized cart operation queue, all-or-nothing `addKit`, rebalance on `cart:update`. Uses Horizon's `@theme/events`.
- `assets/mox-buy.js` + `blocks/mox-buy.liquid` — product page buy UI; the block embeds a JSON catalog (`data-mox-catalog`) consumed by the script.
- `assets/mox-ui.js` — WhatsApp, kit notice, active menu section. `mox-cart.js`/`mox-ui.js`/`mox.css` are loaded globally from `layout/theme.liquid`.
- `assets/mox.css` — brand tokens and components.

Store-level content is configured in theme settings (`config/settings_schema.json`): the **"MOX"** group (line names/colors/lenses/levels, per-line lab data for the lens cards, shipping texts for 1 vs 2+ units, installments, payment discount, returns, WhatsApp), **"MOX · Diseño"** (incl. full-screen sections toggle, body class `mox-full-screen`) and **"MOX · Certificados"** (shared by the buy block and `sections/mox-certificates.liquid`). Free shipping applies only from 2 units — never show it unconditionally. Placeholders for missing content render only when `request.design_mode`; nothing is invented on the storefront.

## Legacy files

Older blocks/sections (`mox-kits`, `product-info-custom`, `mox-etiquetas`, `mox-info-acordeon`, `mox-videos`, `before-after`, etc.) remain in the repo but are no longer used by templates; they're candidates for deletion once the redesign is approved. Check `templates/*.json` to see what's actually in use before editing.
