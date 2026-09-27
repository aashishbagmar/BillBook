#!/usr/bin/env node
/* Static page generator: node build.js [https://your-domain.com]
   Writes the HTML pages, sitemap.xml and robots.txt next to this file. */
const fs = require('fs');
const path = require('path');

const BASE = (process.argv[2] || process.env.SITE_URL || 'https://billbook.example').replace(/\/$/, '');
const out = f => path.join(__dirname, f);

const logoSVG = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="3" width="22" height="26" rx="4" fill="#17150F"/><path d="M27 20v5a4 4 0 0 1-4 4h-5z" fill="#E8430F"/><rect x="9.5" y="9" width="10" height="2.4" rx="1.2" fill="#F4EFE6"/><rect x="9.5" y="14" width="13" height="2.4" rx="1.2" fill="#F4EFE6" opacity=".7"/><rect x="9.5" y="19" width="7" height="2.4" rx="1.2" fill="#F4EFE6" opacity=".7"/></svg>`;

const pages = [
  {
    file: 'index.html',
    preset: '',
    title: 'Free Invoice Generator — Create & Download PDF Invoices | Billbook',
    desc: 'Make professional invoices in a minute. Free invoice generator with PDF download, GST & VAT support, UPI QR codes and payment tracking. No signup — your data stays on your device.',
    eyebrow: 'Free invoice generator',
    h1: 'Invoices that get you <em>paid</em>, not ignored.',
    lede: 'Fill in the details, download a clean PDF, send it on WhatsApp or email. Track who has paid. No account, no watermark on the tool — your data never leaves your device.',
    faqs: [
      ['Is Billbook really free?', 'Yes. Creating invoices, downloading PDFs, GST and VAT support, UPI QR codes, logos and templates are free. Pro adds unlimited saved invoices, backup & restore, and removes the small Billbook footer.'],
      ['Do I need to create an account?', 'No. Open the page and start. Your drafts, clients and saved invoices are stored in your own browser, so nothing is uploaded to a server.'],
      ['How do I get the invoice as a PDF?', 'Tap Download PDF. Your browser’s print dialog opens — choose “Save as PDF” as the destination. On Android, choose “Save as PDF” from the printer list.'],
      ['Can I use it for GST invoices in India?', 'Yes. Pick GST as the tax type: it splits CGST + SGST for same-state supply or IGST for other states, shows the GSTIN, and writes the amount in words in the Indian numbering system.'],
      ['Where is my data stored?', 'Only in your browser’s local storage. Clearing site data removes it, so use Pro’s backup if you work across devices.'],
      ['Does it work offline?', 'After your first visit the app is cached and works offline. You can also install it to your home screen like an app.']
    ],
    bodyIntro: ''
  },
  {
    file: 'gst-invoice-generator.html',
    preset: 'gst',
    title: 'GST Invoice Generator India — Free Tax Invoice with CGST/SGST/IGST | Billbook',
    desc: 'Free GST invoice generator for India. Auto-calculates CGST, SGST and IGST, adds GSTIN, amount in words and a UPI QR code. Download a GST tax invoice PDF in a minute — no signup.',
    eyebrow: 'GST invoice generator · India',
    h1: 'GST tax invoices in <em>one minute</em>.',
    lede: 'Enter items and rates — Billbook splits CGST/SGST or IGST, writes the amount in words (lakh & crore), and adds a scan-to-pay UPI QR. Free, no signup.',
    faqs: [
      ['What details must a GST tax invoice contain?', 'Supplier name, address and GSTIN; invoice number and date; recipient name and address (GSTIN if registered); description of goods or services; quantity, rate and taxable value; GST rate and amount (CGST + SGST or IGST); total in figures and words. Billbook’s GST template lays all of this out for you.'],
      ['When do I charge CGST + SGST vs IGST?', 'Charge CGST + SGST when the supplier and the place of supply are in the same state. Charge IGST when the supply crosses state lines. Use the “Place of supply” switch in Billbook and the tax lines update automatically.'],
      ['Which GST rates are supported?', 'Any rate you type. Quick suggestions include 0%, 5%, 12%, 18% and 28%. Each line item can carry its own rate.'],
      ['Can I add a UPI QR code to my invoice?', 'Yes. Enter your UPI ID and a QR code with the exact invoice amount is printed on the PDF, so clients can pay from any UPI app.'],
      ['Is this a replacement for GST filing software?', 'No. Billbook creates the invoice document. You still need to record sales and file returns through the GST portal or your accounting software. Check current rules with your tax professional.'],
      ['Is my business data safe?', 'Your GSTIN, clients and invoices are stored only in your browser. Nothing is sent to our servers.']
    ],
    bodyIntro: `<p>Freelancers, shop owners, agencies and consultants across India use GST invoices every day. Billbook removes the spreadsheet work: type the items, choose GST, and the tax split is done for you.</p>`
  },
  {
    file: 'freelancer-invoice-generator.html',
    preset: 'freelance',
    title: 'Freelance Invoice Generator — Free Invoice Template & PDF | Billbook',
    desc: 'Free invoice generator for freelancers and contractors. Create a professional invoice in a minute, download the PDF, send it by WhatsApp or email and track payments.',
    eyebrow: 'For freelancers & contractors',
    h1: 'Look professional. Get <em>paid</em> on time.',
    lede: 'A clean invoice, a one-tap payment reminder and a list of who still owes you. Everything a freelancer needs, nothing they don’t. Free, no signup.',
    faqs: [
      ['What should a freelance invoice include?', 'Your name and contact details, the client’s details, a unique invoice number, issue and due dates, a clear description of the work with quantities and rates, the total, and how to pay you. Add payment terms so there are no surprises.'],
      ['How do I chase a late payment politely?', 'Open My invoices, filter by Overdue, then use Share → Payment reminder. Billbook writes a friendly WhatsApp message with the invoice number, amount and due date.'],
      ['What payment terms should I use?', 'Net 14 is common for freelancers, Net 7 for small jobs, and 50% upfront for new clients or larger projects. Put the terms in the Notes box so they print on the invoice.'],
      ['Can I invoice in USD, EUR or GBP?', 'Yes — ten currencies are built in, formatted correctly for each. Change the currency in Invoice details.'],
      ['Does Billbook take a fee from my payments?', 'No. Billbook never touches your money. Clients pay you directly by bank transfer, PayPal, UPI or however you set it up in Payment details.']
    ],
    bodyIntro: `<p>Sending a spreadsheet or a Word document makes you look like a hobbyist. A clear, consistent invoice makes clients take payment seriously — and lets you set up a repeatable system in minutes.</p>`
  },
  {
    file: 'vat-invoice-generator.html',
    preset: 'vat',
    title: 'VAT Invoice Generator — Free UK & EU VAT Invoice Template | Billbook',
    desc: 'Create a VAT invoice online in a minute. Free VAT invoice generator with per-line VAT rates, PDF download, logo and payment details. No signup, works in GBP and EUR.',
    eyebrow: 'VAT invoice generator',
    h1: 'VAT invoices without the <em>spreadsheet</em>.',
    lede: 'Set the VAT rate per line, add your VAT number, and download a tidy PDF. Works in GBP, EUR and more. Free, no signup.',
    faqs: [
      ['What must a VAT invoice show?', 'Typically: your name, address and VAT number; invoice number and date; customer details; description, quantity and price of goods or services; the VAT rate and amount; and the total. Requirements vary by country, so check your local tax authority.'],
      ['Can I use different VAT rates on one invoice?', 'Yes. Every line item has its own tax % — for example 20% standard and 5% reduced — and the totals are calculated for you.'],
      ['Where does my VAT number go?', 'Enter it in the Tax ID field of your business details. It prints under your address on the invoice.'],
      ['Can I change “VAT” to “Sales tax”?', 'Yes — set the tax name in Invoice details. It appears in the table and totals.']
    ],
    bodyIntro: `<p>Billbook keeps VAT simple: pick the currency, set a rate per line, and the invoice shows net, VAT and gross clearly.</p>`
  }
];

const features = [
  ['₹', 'GST, VAT & sales tax', 'CGST/SGST/IGST split for India, plus VAT or sales tax with per-line rates. Totals and amount-in-words done for you.'],
  ['QR', 'UPI scan-to-pay', 'Add your UPI ID and every invoice carries a QR code with the exact amount. Clients pay in seconds.'],
  ['✓', 'Track who’s paid', 'Mark invoices sent or paid, see what’s outstanding and overdue, and nudge late payers with a ready-made reminder.'],
  ['⚡', 'Remembers everything', 'Your business details, clients and numbering are saved on your device. The second invoice takes 30 seconds.'],
  ['◐', 'Four invoice formats', 'Classic, Modern, Minimal and Statement — with your logo and brand colour. Prints on A4 without surprises.'],
  ['🔒', 'Private by design', 'No account, no server, no tracking of your invoices. Everything lives in your browser and works offline.']
];

const head = (p, canon) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${p.title}</title>
<meta name="description" content="${p.desc}">
<link rel="canonical" href="${canon}">
<meta name="theme-color" content="#F4EFE6">
<meta property="og:type" content="website"><meta property="og:title" content="${p.title}"><meta property="og:description" content="${p.desc}"><meta property="og:url" content="${canon}"><meta property="og:image" content="${BASE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head>`;

const header = `<header class="site-head"><div class="wrap">
  <a class="logo" href="./">${logoSVG}Billbook</a>
  <nav class="nav" aria-label="Main">
    <a href="gst-invoice-generator.html">GST invoice</a>
    <a href="freelancer-invoice-generator.html">Freelancers</a>
    <a href="vat-invoice-generator.html">VAT invoice</a>
    <a href="./#pricing">Pricing</a>
    <a class="cta" href="#app">Create invoice</a>
  </nav>
</div></header>`;

const footer = `<footer class="foot"><div class="wrap">
  <div><a class="logo" href="./">${logoSVG}Billbook</a><p>Free invoice generator. Made for people who’d rather be doing the actual work.</p></div>
  <nav aria-label="Footer">
    <a href="./">Invoice generator</a><a href="gst-invoice-generator.html">GST invoice generator</a><a href="freelancer-invoice-generator.html">Freelance invoice</a><a href="vat-invoice-generator.html">VAT invoice</a><a href="privacy.html">Privacy</a>
  </nav>
</div></footer>`;

const featuresHTML = `<section class="block alt" id="features"><div class="wrap">
  <div class="sec-head"><h2>Everything an invoice needs. Nothing it doesn’t.</h2><p>Built for the way small businesses, freelancers and shopkeepers actually bill.</p></div>
  <div class="feat">${features.map(f => `<article><div class="ic">${f[0]}</div><h3>${f[1]}</h3><p>${f[2]}</p></article>`).join('')}</div>
</div></section>`;

const stepsHTML = `<section class="block"><div class="wrap">
  <div class="sec-head"><h2>From blank page to sent in three steps</h2></div>
  <ol class="steps">
    <li><b>Fill in the basics</b><span>Your details, your client, and the items. Numbers add up live on the invoice.</span></li>
    <li><b>Download the PDF</b><span>One tap opens Save as PDF. Or share a message straight to WhatsApp or email.</span></li>
    <li><b>Track the payment</b><span>Mark it paid when the money lands. Overdue invoices float to the top.</span></li>
  </ol>
</div></section>`;

const pricingHTML = `<section class="block alt" id="pricing"><div class="wrap">
  <div class="sec-head"><h2>Free where it counts. Pro when you grow.</h2><p>The invoice tool is free forever. Pro is for people who bill every week.</p></div>
  <div class="plans">
    <div class="plan"><h3>Free</h3><div class="p">₹0</div><ul><li>Unlimited PDF downloads</li><li>GST, VAT &amp; sales tax</li><li>UPI QR, logo, 3 templates</li><li>Save up to 10 invoices</li><li>Payment tracking &amp; reminders</li></ul><a class="btn block" href="#app">Start free</a></div>
    <div class="plan pro"><h3>Pro</h3><div class="p">₹199 <small>/ month</small></div><ul><li>Everything in Free</li><li>Unlimited saved invoices</li><li>No Billbook footer on PDFs</li><li>Backup &amp; restore between devices</li><li>All future Pro features</li></ul><button class="btn primary block" data-act="pro" type="button">Get Pro</button></div>
  </div>
</div></section>`;

const faqHTML = p => `<section class="block"><div class="wrap">
  <div class="sec-head"><h2>Questions, answered</h2></div>
  <div class="faq">${p.faqs.map(f => `<details><summary>${f[0]}</summary><p>${f[1]}</p></details>`).join('')}</div>
</div></section>`;

const jsonld = (p, canon) => `<script type="application/ld+json">${JSON.stringify([
  { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Billbook', url: canon, applicationCategory: 'BusinessApplication', operatingSystem: 'Any', description: p.desc, offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' } },
  { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faqs.map(f => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } })) }
])}</script>`;

pages.forEach(p => {
  const canon = p.file === 'index.html' ? BASE + '/' : `${BASE}/${p.file}`;
  const html = `${head(p, canon)}
<body>
${header}
<main>
<section class="hero"><div class="wrap">
  <span class="eyebrow">${p.eyebrow}</span>
  <h1>${p.h1}</h1>
  <p class="lede">${p.lede}</p>
  <ul class="trust"><li>No signup</li><li>PDF in one tap</li><li>GST &amp; VAT ready</li><li>UPI QR code</li><li>Works offline</li></ul>
</div></section>
<div class="wrap"><div id="app" data-preset="${p.preset}"></div></div>
${p.bodyIntro ? `<section class="block" style="padding-bottom:0"><div class="wrap"><div class="prose">${p.bodyIntro}</div></div></section>` : ''}
${stepsHTML}
${featuresHTML}
${pricingHTML}
${faqHTML(p)}
</main>
${footer}
${jsonld(p, canon)}
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js" defer></script>
<script src="config.js"></script>
<script src="app.js" defer></script>
</body>
</html>
`;
  fs.writeFileSync(out(p.file), html);
});

// privacy
const privacy = {
  file: 'privacy.html', title: 'Privacy Policy | Billbook', desc: 'Billbook stores your invoices only in your browser. Read what we collect and what we do not.',
  faqs: []
};
fs.writeFileSync(out('privacy.html'), `${head(privacy, BASE + '/privacy.html')}
<body>${header}<main><div class="wrap"><div class="prose" style="padding:48px 0 64px">
<h1>Privacy</h1>
<p>Billbook is built so your invoices stay yours.</p>
<h2>What stays on your device</h2>
<p>Your business details, clients, drafts and saved invoices are stored in your browser’s local storage. They are not uploaded to our servers, and we cannot see them. Clearing your browser data deletes them — use the Backup feature in Pro if you need a copy.</p>
<h2>What we collect</h2>
<p>We may use privacy-friendly, aggregate analytics (page views, no invoice content) to understand how the site is used. Fonts are loaded from Google Fonts and the QR library from cdnjs, which may receive your IP address as part of normal web requests.</p>
<h2>Payments</h2>
<p>Pro purchases are handled by our payment provider. We do not see or store your card details.</p>
<h2>Not tax or legal advice</h2>
<p>Billbook helps you produce invoice documents. Tax rules differ by country and change over time. Please confirm requirements with a qualified professional.</p>
</div></div></main>${footer}</body></html>`);

// sitemap + robots
const urls = pages.map(p => (p.file === 'index.html' ? BASE + '/' : `${BASE}/${p.file}`)).concat(BASE + '/privacy.html');
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(out('sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(out('robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
console.log('Built', pages.length + 1, 'pages for', BASE);
