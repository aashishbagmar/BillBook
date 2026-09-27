# Billbook — free invoice generator (web + installable Android PWA)

Static site, no backend. Data stays in the user's browser.

## Run / deploy
- Local: `npx serve .` (service worker needs http/https, not file://)
- Deploy: drag folder to Netlify / Vercel / Cloudflare Pages / GitHub Pages.
- Set your domain, regenerate pages + sitemap: `node build.js https://yourdomain.com`
- Android: open site in Chrome → menu → Install app. (For Play Store, wrap with Bubblewrap/TWA.)

## Monetise (Pro)
1. Edit `config.js`: set `proLink` (Razorpay/Stripe/Lemon Squeezy payment link), prices.
2. Mint a license key and add its SHA-256 to `proHashes`:
   `node -e "const k='BB-XXXX-YYYY';console.log(require('crypto').createHash('sha256').update(k).digest('hex'))"`
3. Email the key to buyers after payment. (Client-side keys are soft protection — fine for MVP; move to server validation when revenue justifies it.)

## Traffic plan
- SEO pages already built: /, GST, freelancer, VAT invoice generators. Add more with `pages` in `build.js`
  (e.g. receipt maker, quotation maker, rent receipt, proforma invoice).
- Submit sitemap in Google Search Console. Post on Reddit (r/IndiaBusiness, r/freelance, r/smallbusiness), Product Hunt, IndieHackers, LinkedIn.
- Replace `og.png` (1200x630) for link previews.
