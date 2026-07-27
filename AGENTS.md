# Repository Guidelines

## Project Structure & Current Scope
This repository supports a cloud-only restaurant workflow: frontend on Vercel, database on Supabase, code in GitHub. The main pages currently maintained are:

- `index.html`: public-facing ordering page. It now returns a customer-facing pickup number after successful submission.
- `index.html` is the internal cashier/staff ordering page in the current phase-2 operating model; do not use it as the public marketing surface for company/group meal messaging.
- `box-meals.html`: mobile-first public marketing page exposed on Google Maps; static/promotional only.
- `box-meals.html` is the public-facing marketing page and is the correct place for company/group catering messaging and contact instructions.
- On `box-meals.html`, company/group catering information should appear directly below the formula offers and above the standard individual dishes, not be buried only in the footer.
- The company/group catering block on `box-meals.html` should be visually emphasized so public visitors can identify that business-order contact path quickly.
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
- `FACTURE.html` must use database-backed invoice clients and invoice saves; session-only client storage and hard-coded invoice/ticket placeholders are not acceptable for the active phase-2 admin flow.
- `FACTURE.html` now loads clients from the database, saves clients through `api/invoice-clients.js`, and saves invoices through `api/save-invoice.js`.
- `api/list-orders.js` and `api/mark-printed.js` are now protected by server-side admin session checks.
- `api/admin-session.js` is part of the same admin-session surface and must stay aligned with the same cookie validation rules as the protected admin endpoints.
- Malformed admin session cookies are now treated as unauthenticated input; they must not escalate into `500` responses on `api/admin-session.js`.
- `api/invoice-clients.js` now owns database-backed invoice client listing, saving, and deletion behind the same admin session boundary.
- `api/save-invoice.js` now owns invoice persistence and must return the Supabase-generated invoice number instead of relying on front-end placeholders.
- `api/submit-order.js` now creates orders through the database RPC `create_order_with_items`, so order creation and item creation succeed or fail together.
- `supabase/schema.sql` now includes `daily_counters`, `next_daily_counter`, and `create_order_with_items`; order and invoice numbering no longer rely on `max(...)+1`.
- `supabase/schema.sql` now also includes `create_invoice_with_items`; invoice header and invoice lines must be created transactionally.
- Database-generated invoice numbers must come from the Supabase invoice trigger/function path, not from hard-coded front-end defaults.
- `FACTURE.html` now replaces its draft placeholder with the database-generated invoice number returned after save.
- Before save, `FACTURE.html` must show a date-derived temporary reference based on the current invoice date (for example `0331` for March 31) instead of a generic draft label.
- `index.html` and `box-meals.html` now use true single-language rendering: French view is fully French, Chinese view is fully Chinese.
- Public delivery messaging must not mention Uber Eats; the current intended external channels are PandaGo and the self-operated delivery website only.
- `index.html` presentation styles are now loaded from `index.css`; keep ordering logic and pickup-result behavior in the HTML script unchanged when adjusting styling.
- Admin session validation must treat malformed cookies as unauthenticated requests, not as server errors.
- Admin-facing Chinese copy and asset references in `admin.html` and `mes-commandes.html` have been restored and must stay readable; do not regress them into mojibake/garbled text.
- `index.html` submission success shows the pickup number (`orderNumber`), total, time, and pickup instructions.
- `index.html` is optimized for cashier use on iPad: its three formula choices are listed first, and the shared noodle and drink supplements are each 1 EUR. Cashier orders do not request customer, phone, note, or delivery-address fields.
- `mes-commandes.html` polling now stops when the tab is hidden, pauses after inactivity, and uses incremental refresh based on `updated_at`; `api/list-orders.js` also limits the active-order response size.
- `mes-commandes.html` presentation styles are now loaded from `mes-commandes.css`; keep polling, admin-session checks, audio alerts, and status-update flows unchanged when adjusting styling.
- `api/payment-webhook.js` and `api/webhook-verify.js` are intentionally disabled until phase 3 and must not be treated as an active payment flow.
- `politique-confidentialite.html` is currently the public legal/privacy page, and public pages now expose company/legal identity information based on the current Kbis details.
- Current Kbis-confirmed identity: CUBE, SAS with share capital of 6 000 EUR, RCS/SIREN Paris 928 586 973, SIRET 928 586 973 00010, intra-community VAT number FR83 928586973, registered office at 7 rue Blanche, 75009 Paris; its stated activity is traditional restaurant service, on-site and takeaway sales, and home delivery.
- Cash-register work is in scope for phase 2. Payment-card authorization remains on the physical TPE; the application must only record the payment method and a non-sensitive TPE reference. Payment events, cashier audit logs, and daily closure records must be append-only.

## Deployment & Development Workflow
This project is intentionally operated in the cloud. It does not aim to expose a full local server workflow or a complete self-explanatory deployment recipe. Treat Vercel and Supabase as the operational environment.

Useful repo commands:

- `rg --files`: list project files quickly.
- `rg "admin-session|list-orders|mark-printed" api mes-commandes.html`: trace the cashier loop.
- `rg "setLang|pickupLabel|pickupTitle" index.html box-meals.html`: trace public-page language and pickup UX.
- `rg "create_order_with_items|daily_counters|next_daily_counter" supabase api`: trace the transactional order-creation path and numbering logic.
- `rg "payment-webhook|webhook-verify|PAYMENT DISABLED" api`: confirm phase-3 payment code remains disabled.

Update `.env.example` only when required variable names change. Never commit live secrets.
If `supabase/schema.sql` or `supabase/rls.sql` changes, remember that the corresponding SQL must also be applied manually in the Supabase SQL editor.
When implementation assumptions are clarified during work, update `AGENTS.md` in the same change cycle instead of batching documentation updates at the end.

## Coding Style & Naming Conventions
Use 2-space indentation in HTML, CSS, and JavaScript. Keep files UTF-8 encoded. Prefer direct, readable vanilla JavaScript and preserve the existing static-page structure unless a change clearly benefits maintainability.

Use lowercase file names with hyphens for new pages or endpoints, for example `admin-login.js`. Keep business-critical checks on the server side where possible.
When large static pages become hard to maintain, it is acceptable to extract inline `<style>` blocks into dedicated `.css` files as long as behavior and script flow stay unchanged.

## Testing Guidelines
There is no automated suite yet. Validate changes manually against the current phase-2 flow:

- create an internal order
- place a customer order from `index.html` and confirm the pickup number is shown
- confirm it appears in `mes-commandes.html`
- update status from the cashier UI
- confirm an order created in one tab appears in another open cashier board without a manual refresh
- confirm changing an order to `completed` or `cancelled` removes it from other open cashier boards after polling
- verify French and Chinese both render as single-language pages on `index.html` and `box-meals.html`
- verify the legal/privacy information is reachable from the public pages and reflects current company identity information
- verify mobile layout on `index.html`, `box-meals.html`, `FACTURE.html`, and `mes-commandes.html`

## Commit & Pull Request Guidelines
Recent history uses short update-style commit subjects. Prefer concise imperative messages such as `Fix admin session validation` or `Adjust mobile layout for FACTURE`.

PRs should state which page or API changed, what part of the cashier loop was affected, any Supabase or RLS impact, and include screenshots for UI edits.

## Security Notes
Do not expose passwords, session secrets, or Supabase server keys in client code. The current security work is only an initial baseline, so avoid expanding public access before the phase-2 internal loop is stable.

Current production-origin boundary:

- `api/submit-order.js` is intentionally restricted to the single production domain `cube-paris.vercel.app`.
- Do not broaden the public order origin allowlist unless scope explicitly changes.
- If the production host ever changes, update both the deployment config and the allowlist in `api/submit-order.js` together.

Current phase-2 hardening notes:

- The in-memory request limit in `api/submit-order.js` is only a baseline anti-abuse measure for phase 2; do not mistake it for a distributed or durable rate-limiting system.

Security expectations by phase:

- Phase 2: protect admin access, keep service-role secrets server-side, and stabilize the internal order loop.
- Phase 3: add payment-webhook integrity, payment-to-order reconciliation, stronger endpoint authorization, and a review of public ordering abuse risks before enabling external ordering.

Operational reminders:

- Do not re-enable payment webhook routes, `online_paid` checkout work, or webhook signature logic before phase 3 is explicitly in scope.
- Do not replace the transactional RPC order-creation path with separate client-visible inserts into `orders` and `order_items`.

Known intentional boundaries:

- No full local-server setup is documented on purpose; deployment is cloud-only.
- `meun.html` is treated as a backup page and is not part of the active delivery path.
