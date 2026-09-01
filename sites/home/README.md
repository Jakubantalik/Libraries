# sites/home — libraries.dev

The umbrella site: landing, Pro pricing, account, checkout return, device
activation, terms and privacy. Static HTML — no build step.

Backend: `api.libraries.dev`, a Cloudflare Worker living in the **private**
`libraries-pro` repo (sibling of this one). The pages talk to it through
[`assets/pro-client.js`](assets/pro-client.js); in local dev the client
targets `http://localhost:8787` (`wrangler dev` in `libraries-pro/api`).

Product decisions (differ from transitions.dev):

- **Managed Payments everywhere** — Stripe is merchant of record on every sale.
- **Code-only sign-in** — the email carries a typeable code, never a link.
- **Purchase auto-creates the profile** from the checkout email; signed-in
  users get a letter avatar (first letter of the email) instead of a menu button.
- Plans mirror transitions.dev amounts: $9/mo, $90/yr, team $39 base (5 seats,
  +$9/seat), lifetime $149 / team $499.

Deploy: Cloudflare Pages project bound to `libraries.dev`, no build command,
output directory `sites/home`.

Local dev:

```bash
python3 -m http.server 8000 -d sites/home
```
