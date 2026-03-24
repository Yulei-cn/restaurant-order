# Repository Guidelines

## Project Structure & Current Scope
This repository supports a cloud-only restaurant workflow: frontend on Vercel, database on Supabase, code in GitHub. The main pages currently maintained are:

- `index.html`: public-facing ordering page. It now returns a customer-facing pickup number after successful submission.
- `box-meals.html`: mobile-first public marketing page exposed on Google Maps; static/promotional only.
- `FACTURE.html`: invoice and receipt page.
- `mes-commandes.html`: cashier order board.
- `admin.html`: unified backend entry for admin login and navigation.
- `api/`: serverless endpoints for order submission, admin auth, and order status updates.
- `supabase/schema.sql` and `supabase/rls.sql`: schema and security rules.
- `Photo/` plus root images/audio: static assets.

Roadmap and scope must stay explicit:

- Phase 1: static public presentation pages for discovery and promotion.
- Phase 2: internal loop only. Staff create orders, `mes-commandes.html` refreshes, and the kitchen receives tickets.
- Phase 3: external customer ordering with online payment before arrival, then in-store pickup by order number.

The current delivery target is phase 2. Do not let phase-3 payment work disrupt the internal cashier loop or the public static pages.

Current implementation snapshot:

- `admin.html` is the backend gateway for `mes-commandes.html` and `FACTURE.html`.
- `api/list-orders.js` and `api/mark-printed.js` are now protected by server-side admin session checks.
- `index.html` and `box-meals.html` now use true single-language rendering: French view is fully French, Chinese view is fully Chinese.
- `index.html` submission success shows the pickup number (`orderNumber`), total, time, and pickup instructions.

## Deployment & Development Workflow
This project is intentionally operated in the cloud. It does not aim to expose a full local server workflow or a complete self-explanatory deployment recipe. Treat Vercel and Supabase as the operational environment.

Useful repo commands:

- `rg --files`: list project files quickly.
- `rg "admin-session|list-orders|mark-printed" api mes-commandes.html`: trace the cashier loop.
- `rg "setLang|pickupLabel|pickupTitle" index.html box-meals.html`: trace public-page language and pickup UX.

Update `.env.example` only when required variable names change. Never commit live secrets.

## Coding Style & Naming Conventions
Use 2-space indentation in HTML, CSS, and JavaScript. Keep files UTF-8 encoded. Prefer direct, readable vanilla JavaScript and preserve the existing static-page structure unless a change clearly benefits maintainability.

Use lowercase file names with hyphens for new pages or endpoints, for example `admin-login.js`. Keep business-critical checks on the server side where possible.

## Testing Guidelines
There is no automated suite yet. Validate changes manually against the current phase-2 flow:

- create an internal order
- place a customer order from `index.html` and confirm the pickup number is shown
- confirm it appears in `mes-commandes.html`
- update status from the cashier UI
- verify French and Chinese both render as single-language pages on `index.html` and `box-meals.html`
- verify mobile layout on `index.html`, `box-meals.html`, `FACTURE.html`, and `mes-commandes.html`

## Commit & Pull Request Guidelines
Recent history uses short update-style commit subjects. Prefer concise imperative messages such as `Fix admin session validation` or `Adjust mobile layout for FACTURE`.

PRs should state which page or API changed, what part of the cashier loop was affected, any Supabase or RLS impact, and include screenshots for UI edits.

## Security Notes
Do not expose passwords, session secrets, or Supabase server keys in client code. The current security work is only an initial baseline, so avoid expanding public access before the phase-2 internal loop is stable.

Security expectations by phase:

- Phase 2: protect admin access, keep service-role secrets server-side, and stabilize the internal order loop.
- Phase 3: add payment-webhook integrity, payment-to-order reconciliation, stronger endpoint authorization, and a review of public ordering abuse risks before enabling external ordering.

Known intentional boundaries:

- No full local-server setup is documented on purpose; deployment is cloud-only.
- `meun.html` is treated as a backup page and is not part of the active delivery path.
