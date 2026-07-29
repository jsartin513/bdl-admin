# @bdl/* shared packages

Shared libraries for BDL apps (merch, open-gym, concessions, admin).

Because these apps are separate deploy units, each consumer vendors a copy of these packages under `packages/` and depends on them via npm workspaces. Keep the copies in sync when changing shared behavior.

| Package | Purpose |
|---------|---------|
| `@bdl/admin-auth` | Google admin OAuth session cookies + allowlist (SSO cookie domain) |
| `@bdl/stripe-sdk` | Lazy Stripe client, `getStripeMode`, pinned API version |
| `@bdl/stripe-env` | CLI `--stripe-env test\|live` loader (+ optional `--db-env`) |
| `@bdl/app-config` | `getAppBaseUrl`, `showTestModeBanner` |
| `@bdl/board-apps` | Cross-admin nav URLs (`getBoardAppLinks`); UI menus stay app-local |
| `@bdl/inventory-sku` | `inventorySkuKey` / `SIMPLE_PRODUCT_INVENTORY_SIZE` |
| `@bdl/checkout-metadata` | Compact Stripe Checkout Session line metadata |
| `@bdl/money` | `formatUsd`, Eastern calendar date helpers |
