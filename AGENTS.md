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
- `api/submit-order.js` now creates orders through the database RPC `create_order_with_items`, so order creation and item creation succeed or fail together.
- `supabase/schema.sql` now includes `daily_counters`, `next_daily_counter`, and `create_order_with_items`; order and invoice numbering no longer rely on `max(...)+1`.
- `index.html` and `box-meals.html` now use true single-language rendering: French view is fully French, Chinese view is fully Chinese.
- `index.html` submission success shows the pickup number (`orderNumber`), total, time, and pickup instructions.
- `mes-commandes.html` polling now stops when the tab is hidden, pauses after inactivity, and uses incremental refresh based on `updated_at`; `api/list-orders.js` also limits the active-order response size.
- `api/payment-webhook.js` and `api/webhook-verify.js` are intentionally disabled until phase 3 and must not be treated as an active payment flow.
- `politique-confidentialite.html` is currently the public legal/privacy page, and public pages now expose company/legal identity information based on the current Kbis details.

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

## Coding Style & Naming Conventions
Use 2-space indentation in HTML, CSS, and JavaScript. Keep files UTF-8 encoded. Prefer direct, readable vanilla JavaScript and preserve the existing static-page structure unless a change clearly benefits maintainability.

Use lowercase file names with hyphens for new pages or endpoints, for example `admin-login.js`. Keep business-critical checks on the server side where possible.

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

Security expectations by phase:

- Phase 2: protect admin access, keep service-role secrets server-side, and stabilize the internal order loop.
- Phase 3: add payment-webhook integrity, payment-to-order reconciliation, stronger endpoint authorization, and a review of public ordering abuse risks before enabling external ordering.

Operational reminders:

- Do not re-enable payment webhook routes, `online_paid` checkout work, or webhook signature logic before phase 3 is explicitly in scope.
- Do not replace the transactional RPC order-creation path with separate client-visible inserts into `orders` and `order_items`.

Known intentional boundaries:

- No full local-server setup is documented on purpose; deployment is cloud-only.
- `meun.html` is treated as a backup page and is not part of the active delivery path.
