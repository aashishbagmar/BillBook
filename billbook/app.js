/* Billbook — invoice generator. Vanilla JS, no build step. All data stays in the browser. */
(() => {
  'use strict';

  const CFG = Object.assign(
    { proLink: '', contactEmail: '', freeLimit: 10, proHashes: [], proPriceMonthly: '₹199', proPriceYearly: '₹1,499' },
    window.BILLBOOK_CONFIG || {}
  );

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl2br = s => esc(s).replace(/\n/g, '<br>');
  const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const clone = o => JSON.parse(JSON.stringify(o));

  const LS = {
    get(k, d) { try { const v = localStorage.getItem('bb.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('bb.' + k, JSON.stringify(v)); return true; } catch { toast('Browser storage is full — export a backup.'); return false; } }
  };

  const CURRENCIES = {
    INR: { sym: '₹', loc: 'en-IN', name: 'Indian Rupee', major: 'Rupees', minor: 'Paise' },
    USD: { sym: '$', loc: 'en-US', name: 'US Dollar', major: 'Dollars', minor: 'Cents' },
    EUR: { sym: '€', loc: 'de-DE', name: 'Euro', major: 'Euros', minor: 'Cents' },
    GBP: { sym: '£', loc: 'en-GB', name: 'British Pound', major: 'Pounds', minor: 'Pence' },
    AUD: { sym: 'A$', loc: 'en-AU', name: 'Australian Dollar', major: 'Dollars', minor: 'Cents' },
    CAD: { sym: 'C$', loc: 'en-CA', name: 'Canadian Dollar', major: 'Dollars', minor: 'Cents' },
    AED: { sym: 'AED', loc: 'en-AE', name: 'UAE Dirham', major: 'Dirhams', minor: 'Fils' },
    SGD: { sym: 'S$', loc: 'en-SG', name: 'Singapore Dollar', major: 'Dollars', minor: 'Cents' },
    NGN: { sym: '₦', loc: 'en-NG', name: 'Nigerian Naira', major: 'Naira', minor: 'Kobo' },
    ZAR: { sym: 'R', loc: 'en-ZA', name: 'South African Rand', major: 'Rand', minor: 'Cents' }
  };
  const fmt = (n, cur) => {
    const c = CURRENCIES[cur] || CURRENCIES.USD;
    try { return new Intl.NumberFormat(c.loc, { style: 'currency', currency: cur }).format(n); }
    catch { return c.sym + r2(n).toFixed(2); }
  };
  const fmtDate = (d, cur) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString(cur === 'USD' ? 'en-US' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  /* ---------- amount in words ---------- */
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const below100 = n => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  const below1000 = n => {
    const h = Math.floor(n / 100), r = n % 100;
    return (h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? below100(r) : '');
  };
  const wordsIndian = n => {
    if (n === 0) return 'Zero';
    const parts = [];
    const cr = Math.floor(n / 1e7); n %= 1e7;
    const lk = Math.floor(n / 1e5); n %= 1e5;
    const th = Math.floor(n / 1e3); n %= 1e3;
    if (cr) parts.push((cr >= 100 ? wordsIndian(cr) : below100(cr)) + ' Crore');
    if (lk) parts.push(below100(lk) + ' Lakh');
    if (th) parts.push(below100(th) + ' Thousand');
    if (n) parts.push(below1000(n));
    return parts.join(' ');
  };
  const wordsIntl = n => {
    if (n === 0) return 'Zero';
    const parts = [];
    [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']].forEach(([v, l]) => {
      const q = Math.floor(n / v);
      if (q) { parts.push(below1000(q) + ' ' + l); n %= v; }
    });
    if (n) parts.push(below1000(n));
    return parts.join(' ');
  };
  const amountInWords = (total, cur) => {
    const c = CURRENCIES[cur] || CURRENCIES.USD;
    const cents = Math.round(total * 100);
    const whole = Math.floor(cents / 100), frac = cents % 100;
    const w = cur === 'INR' ? wordsIndian : wordsIntl;
    let out = c.major + ' ' + w(whole);
    if (frac) out += ' and ' + w(frac) + ' ' + c.minor;
    return out + ' Only';
  };

  /* ---------- state ---------- */
  const root = $('#app');
  const PRESET = (root && root.dataset.preset) || '';
  const PRESETS = {
    gst: { currency: 'INR', taxMode: 'gst' },
    freelance: { currency: 'USD', taxMode: 'none' },
    vat: { currency: 'GBP', taxMode: 'single', taxLabel: 'VAT' }
  };

  let settings = Object.assign({
    prefix: 'INV-', next: 1, currency: 'USD', taxMode: 'none', taxLabel: 'Tax', template: 'classic', accent: '#E8430F',
    from: { name: '', email: '', phone: '', address: '', taxId: '' }, payment: '', upi: '', logo: '', notes: 'Thank you for your business.', terms: 'Payment due within the period stated above.'
  }, LS.get('settings', {}));
  let history = LS.get('invoices', []);
  let state = null;
  let isPro = false;

  const blankItem = () => ({ id: uid(), desc: '', qty: 1, rate: '', tax: state ? defaultTax() : '' });
  const defaultTax = () => (state.taxMode === 'gst' ? 18 : state.taxMode === 'single' ? (state.lastTax ?? 0) : 0);

  function newInvoice() {
    const p = PRESETS[PRESET] || {};
    const s = {
      id: uid(),
      number: settings.prefix + String(settings.next).padStart(4, '0'),
      status: 'draft', template: settings.template, accent: settings.accent,
      currency: p.currency || settings.currency, taxMode: p.taxMode || settings.taxMode, taxLabel: p.taxLabel || settings.taxLabel, supply: 'intra',
      from: clone(settings.from), to: { name: '', email: '', phone: '', address: '', taxId: '' },
      date: iso(new Date()), due: iso(addDays(new Date(), 14)),
      items: [], discountType: 'pct', discount: '', shipping: '',
      notes: settings.notes, terms: settings.terms, payment: settings.payment, upi: settings.upi, logo: settings.logo,
      branding: true, created: Date.now(), updated: Date.now()
    };
    state = s;
    s.items = [blankItem()];
    return s;
  }

  const isPristine = s => !s.to.name && s.items.every(i => !i.desc && !i.rate);

  /* ---------- calculation ---------- */
  function calc(s) {
    const items = s.items.map(it => ({ ...it, amount: r2(num(it.qty) * num(it.rate)) }));
    const subtotal = r2(items.reduce((a, b) => a + b.amount, 0));
    const disc = r2(s.discountType === 'pct' ? subtotal * clamp(num(s.discount), 0, 100) / 100 : Math.min(num(s.discount), subtotal));
    const taxable = r2(subtotal - disc);
    let tax = 0; const byRate = {};
    items.forEach(it => {
      const share = subtotal ? it.amount / subtotal : 0;
      it.taxable = it.amount - disc * share;
      const rate = s.taxMode === 'none' ? 0 : num(it.tax);
      it.taxAmt = r2(it.taxable * rate / 100);
      if (rate) byRate[rate] = r2((byRate[rate] || 0) + it.taxAmt);
      tax = r2(tax + it.taxAmt);
    });
    const shipping = r2(num(s.shipping));
    return { items, subtotal, disc, taxable, tax, byRate, shipping, total: r2(taxable + tax + shipping) };
  }

  const effectiveStatus = s => {
    if (s.status === 'paid') return 'paid';
    if (s.due && s.due < iso(new Date()) && s.status !== 'draft') return 'overdue';
    return s.status;
  };

  /* ---------- UPI QR ---------- */
  function upiQR(s, total) {
    if (s.currency !== 'INR' || !s.upi || typeof qrcode !== 'function' || total <= 0) return '';
    try {
      const uri = `upi://pay?pa=${encodeURIComponent(s.upi.trim())}&pn=${encodeURIComponent(s.from.name || '')}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Invoice ' + s.number)}`;
      const q = qrcode(0, 'M'); q.addData(uri); q.make();
      const n = q.getModuleCount(); let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      return `<div class="inv-qr"><svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><path d="${d}"/></svg><span>Scan to pay via UPI</span></div>`;
    } catch { return ''; }
  }

  /* ---------- invoice render ---------- */
  function invoiceHTML(s) {
    const c = calc(s), cur = s.currency, f = n => fmt(n, cur);
    const gst = s.taxMode === 'gst', taxOn = s.taxMode !== 'none';
    const taxName = gst ? 'GST' : (s.taxLabel || 'Tax');
    const from = s.from, to = s.to;
    const st = effectiveStatus(s);
    const taxIdLabel = gst ? 'GSTIN' : (s.taxLabel && s.taxMode === 'single' ? s.taxLabel + ' No.' : 'Tax ID');

    const rows = c.items.map((it, i) => `
      <tr>
        <td class="n">${i + 1}</td>
        <td class="d">${nl2br(it.desc) || '<span class="ph">Item description</span>'}</td>
        <td class="r">${esc(+num(it.qty).toFixed(3))}</td>
        <td class="r">${f(num(it.rate))}</td>
        ${taxOn ? `<td class="r">${num(it.tax) ? esc(num(it.tax)) + '%' : '—'}</td>` : ''}
        <td class="r b">${f(it.amount)}</td>
      </tr>`).join('');

    const rates = Object.keys(c.byRate).map(Number).sort((a, b) => a - b);
    let taxRows = '';
    if (taxOn && rates.length) {
      if (gst) {
        taxRows = rates.map(r => s.supply === 'inter'
          ? `<tr><td>IGST @ ${r}%</td><td>${f(c.byRate[r])}</td></tr>`
          : `<tr><td>CGST @ ${r / 2}%</td><td>${f(r2(c.byRate[r] / 2))}</td></tr><tr><td>SGST @ ${r / 2}%</td><td>${f(r2(c.byRate[r] - r2(c.byRate[r] / 2)))}</td></tr>`
        ).join('');
      } else {
        taxRows = `<tr><td>${esc(taxName)}${rates.length === 1 ? ' (' + rates[0] + '%)' : ''}</td><td>${f(c.tax)}</td></tr>`;
      }
    }

    const qr = upiQR(s, c.total);
    const brand = (!isPro || s.branding) ? `<div class="inv-brand-foot">Made with <b>Billbook</b> · free invoice generator</div>` : '';
    const showWords = c.total > 0;
    const title = gst ? 'TAX INVOICE' : 'INVOICE';

    return `
    <div class="inv tpl-${esc(s.template)}" style="--acc:${esc(s.accent)}">
      ${st === 'paid' ? '<div class="inv-stamp">PAID</div>' : ''}
      <header class="inv-head">
        <div class="inv-from">
          ${s.logo ? `<img class="inv-logo" src="${esc(s.logo)}" alt="">` : ''}
          <div class="inv-fname">${esc(from.name) || '<span class="ph">Your business name</span>'}</div>
          <div class="inv-small">${nl2br(from.address)}</div>
          <div class="inv-small">${[from.email, from.phone].filter(Boolean).map(esc).join(' · ')}</div>
          ${from.taxId ? `<div class="inv-small"><b>${esc(taxIdLabel)}:</b> ${esc(from.taxId)}</div>` : ''}
        </div>
        <div class="inv-meta">
          <h2>${title}</h2>
          <dl>
            <dt>Invoice #</dt><dd>${esc(s.number)}</dd>
            <dt>Date</dt><dd>${esc(fmtDate(s.date, cur))}</dd>
            ${s.due ? `<dt>Due</dt><dd>${esc(fmtDate(s.due, cur))}</dd>` : ''}
          </dl>
        </div>
      </header>

      <section class="inv-parties">
        <div>
          <h4>Bill to</h4>
          <div class="inv-cname">${esc(to.name) || '<span class="ph">Client name</span>'}</div>
          <div class="inv-small">${nl2br(to.address)}</div>
          <div class="inv-small">${[to.email, to.phone].filter(Boolean).map(esc).join(' · ')}</div>
          ${to.taxId ? `<div class="inv-small"><b>${esc(taxIdLabel)}:</b> ${esc(to.taxId)}</div>` : ''}
        </div>
        <div class="inv-due">
          <h4>${st === 'paid' ? 'Amount paid' : 'Amount due'}</h4>
          <div class="inv-due-amt">${f(c.total)}</div>
        </div>
      </section>

      <table class="inv-items">
        <thead><tr><th class="n">#</th><th class="d">Description</th><th class="r">Qty</th><th class="r">Rate</th>${taxOn ? `<th class="r">${esc(taxName)}</th>` : ''}<th class="r">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <section class="inv-foot">
        <div class="inv-left">
          ${showWords ? `<div class="inv-words"><h4>Amount in words</h4>${esc(amountInWords(c.total, cur))}</div>` : ''}
          ${s.payment ? `<div class="inv-block"><h4>Payment details</h4>${nl2br(s.payment)}</div>` : ''}
          ${s.notes ? `<div class="inv-block"><h4>Notes</h4>${nl2br(s.notes)}</div>` : ''}
          ${s.terms ? `<div class="inv-block"><h4>Terms</h4>${nl2br(s.terms)}</div>` : ''}
        </div>
        <div class="inv-right">
          <table class="inv-totals">
            <tr><td>Subtotal</td><td>${f(c.subtotal)}</td></tr>
            ${c.disc ? `<tr><td>Discount${s.discountType === 'pct' ? ' (' + num(s.discount) + '%)' : ''}</td><td>− ${f(c.disc)}</td></tr>` : ''}
            ${taxRows}
            ${c.shipping ? `<tr><td>Shipping / other</td><td>${f(c.shipping)}</td></tr>` : ''}
            <tr class="grand"><td>Total</td><td>${f(c.total)}</td></tr>
          </table>
          ${qr}
        </div>
      </section>
      ${brand}
    </div>`;
  }

  /* ---------- app shell markup ---------- */
  const ICON = {
    pdf: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l3 3v15H5zM8 3v6h7V3M8 21v-7h8v7"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z"/></svg>'
  };

  const RATES = '<datalist id="rates"><option value="0"><option value="5"><option value="10"><option value="12"><option value="18"><option value="20"><option value="28"></datalist>';

  root.innerHTML = `
  <div class="app-tabs" role="tablist">
    <button class="tab is-on" data-tab="create" role="tab">Create invoice</button>
    <button class="tab" data-tab="list" role="tab">My invoices <span class="badge" id="unpaidBadge" hidden></span></button>
    <button class="tab pro-tab" data-act="pro" id="proBtn">${ICON.star} Go Pro</button>
  </div>

  <div id="view-create" class="view">
    <div class="mobile-switch" role="tablist">
      <button class="is-on" data-mv="edit">Edit</button><button data-mv="preview">Preview</button>
    </div>
    <div class="workspace">
      <form class="editor" id="editor" autocomplete="off" onsubmit="return false">

        <section class="card">
          <h3><span class="step">1</span>Your business</h3>
          <div class="logo-row">
            <div class="logo-box" id="logoBox"></div>
            <div>
              <button type="button" class="btn ghost sm" id="logoBtn">Upload logo</button>
              <button type="button" class="btn link sm" id="logoRm" hidden>Remove</button>
              <input type="file" id="logoFile" accept="image/*" hidden>
              <p class="hint">PNG or JPG. Stays on your device.</p>
            </div>
          </div>
          <div class="grid2">
            <label class="f full"><span>Business / your name</span><input data-k="from.name" placeholder="Acme Studio"></label>
            <label class="f"><span>Email</span><input data-k="from.email" type="email" inputmode="email" placeholder="hello@acme.com"></label>
            <label class="f"><span>Phone</span><input data-k="from.phone" type="tel" placeholder="+91 98765 43210"></label>
            <label class="f full"><span>Address</span><textarea data-k="from.address" rows="2" placeholder="Street, city, state, PIN"></textarea></label>
            <label class="f full"><span data-taxid-label>Tax ID</span><input data-k="from.taxId" placeholder="Optional"></label>
          </div>
        </section>

        <section class="card">
          <h3><span class="step">2</span>Bill to</h3>
          <div class="grid2">
            <label class="f full"><span>Client name</span><input data-k="to.name" list="clientList" placeholder="Client or company"><datalist id="clientList"></datalist></label>
            <label class="f"><span>Email</span><input data-k="to.email" type="email" inputmode="email"></label>
            <label class="f"><span>Phone</span><input data-k="to.phone" type="tel"></label>
            <label class="f full"><span>Address</span><textarea data-k="to.address" rows="2"></textarea></label>
            <label class="f full"><span data-taxid-label>Tax ID</span><input data-k="to.taxId" placeholder="Optional"></label>
          </div>
        </section>

        <section class="card">
          <h3><span class="step">3</span>Invoice details</h3>
          <div class="grid2">
            <label class="f"><span>Invoice number</span><input data-k="number"></label>
            <label class="f"><span>Status</span>
              <select data-k="status"><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option></select></label>
            <label class="f"><span>Invoice date</span><input type="date" data-k="date"></label>
            <label class="f"><span>Due date</span><input type="date" data-k="due"></label>
            <label class="f"><span>Currency</span><select data-k="currency">${Object.entries(CURRENCIES).map(([k, v]) => `<option value="${k}">${k} · ${v.name}</option>`).join('')}</select></label>
            <label class="f"><span>Tax</span>
              <select data-k="taxMode"><option value="none">No tax</option><option value="single">VAT / Sales tax</option><option value="gst">GST (India)</option></select></label>
            <label class="f" data-show="single"><span>Tax name</span><input data-k="taxLabel" placeholder="VAT"></label>
            <label class="f" data-show="gst"><span>Place of supply</span>
              <select data-k="supply"><option value="intra">Same state (CGST + SGST)</option><option value="inter">Other state (IGST)</option></select></label>
          </div>
        </section>

        <section class="card">
          <h3><span class="step">4</span>Items</h3>
          <div id="items"></div>
          <button type="button" class="btn ghost" id="addItem">${ICON.plus} Add item</button>
          <div class="grid2 adj">
            <label class="f"><span>Discount</span>
              <span class="combo"><input data-k="discount" type="number" inputmode="decimal" min="0" step="any" placeholder="0">
              <select data-k="discountType"><option value="pct">%</option><option value="flat">Flat</option></select></span></label>
            <label class="f"><span>Shipping / other charges</span><input data-k="shipping" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>
          </div>
          <div class="sum" id="sumBox"></div>
        </section>

        <section class="card">
          <h3><span class="step">5</span>Payment &amp; notes</h3>
          <div class="grid2">
            <label class="f full"><span>Payment details</span><textarea data-k="payment" rows="3" placeholder="Bank name, account no., IFSC / SWIFT, PayPal…"></textarea></label>
            <label class="f full" data-show="inr"><span>UPI ID <em>(adds a scan-to-pay QR)</em></span><input data-k="upi" placeholder="name@bank" autocapitalize="off"></label>
            <label class="f full"><span>Notes</span><textarea data-k="notes" rows="2"></textarea></label>
            <label class="f full"><span>Terms</span><textarea data-k="terms" rows="2"></textarea></label>
          </div>
        </section>

        <section class="card">
          <h3><span class="step">6</span>Invoice format</h3>
          <p class="hint format-hint">Change the structure of the invoice. Your colour is chosen separately below.</p>
          <div class="tpls" id="tpls">
            <button type="button" data-tpl="classic"><i class="t-classic"></i><span>Classic</span><small>Balanced</small></button>
            <button type="button" data-tpl="modern"><i class="t-modern"></i><span>Modern</span><small>Bold header</small></button>
            <button type="button" data-tpl="minimal"><i class="t-minimal"></i><span>Minimal</span><small>Quiet &amp; clean</small></button>
            <button type="button" data-tpl="statement"><i class="t-statement"></i><span>Statement</span><small>Editorial split</small></button>
          </div>
          <p class="format-hint accent-label">Accent colour</p>
          <div class="swatches" id="swatches">
            ${['#E8430F', '#1F6B4A', '#1D4ED8', '#B4235A', '#0F172A', '#B8860B'].map(c => `<button type="button" data-acc="${c}" style="--c:${c}" aria-label="Accent ${c}"></button>`).join('')}
            <label class="custom" title="Custom colour"><input type="color" id="accCustom" value="#E8430F"></label>
          </div>
          <label class="check"><input type="checkbox" id="brandOff"> <span>Remove “Made with Billbook” footer <b class="pill">Pro</b></span></label>
        </section>
      </form>

      <aside class="preview-col">
        <div class="actions" id="actions">
          <button class="btn primary" data-act="pdf">${ICON.pdf} Download PDF</button>
          <button class="btn" data-act="save">${ICON.save} Save</button>
          <div class="menu-wrap">
            <button class="btn" data-act="share">${ICON.share} Share</button>
            <div class="menu" id="shareMenu" hidden>
              <button data-share="wa">WhatsApp</button>
              <button data-share="mail">Email</button>
              <button data-share="copy">Copy message</button>
              <button data-share="remind">Payment reminder (WhatsApp)</button>
            </div>
          </div>
          <button class="btn ghost" data-act="new">New</button>
        </div>
        <div class="paper-wrap" id="paperWrap"><div class="paper" id="paper"></div></div>
        <p class="hint center">PDF opens your browser’s print dialog — choose <b>Save as PDF</b>.</p>
      </aside>
    </div>
    ${RATES}
  </div>

  <div id="view-list" class="view" hidden>
    <div class="stats" id="stats"></div>
    <div class="list-bar">
      <input type="search" id="q" placeholder="Search client or invoice #">
      <div class="chips" id="chips">
        <button class="is-on" data-f="all">All</button><button data-f="unpaid">Unpaid</button><button data-f="overdue">Overdue</button><button data-f="paid">Paid</button>
      </div>
      <div class="list-tools">
        <button class="btn ghost sm" data-act="csv">Export CSV</button>
        <button class="btn ghost sm" data-act="backup">Backup <b class="pill">Pro</b></button>
        <button class="btn ghost sm" data-act="restore">Restore <b class="pill">Pro</b></button>
        <input type="file" id="restoreFile" accept="application/json" hidden>
      </div>
    </div>
    <div id="list"></div>
  </div>

  <div class="mobile-bar" id="mobileBar">
    <button class="btn" data-act="save">${ICON.save} Save</button>
    <button class="btn primary" data-act="pdf">${ICON.pdf} PDF</button>
  </div>

  <div class="modal" id="proModal" hidden>
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="proTitle">
      <button class="modal-x" data-act="closePro" aria-label="Close">${ICON.x}</button>
      <p class="eyebrow">Billbook Pro</p>
      <h3 id="proTitle">Invoice like a business, not a side project.</h3>
      <ul class="ticks">
        <li>Unlimited saved invoices <span>(free: ${CFG.freeLimit})</span></li>
        <li>Remove the Billbook footer from every PDF</li>
        <li>Backup &amp; restore all invoices — move between phone and laptop</li>
        <li>Every future Pro feature, one price</li>
      </ul>
      <div class="price"><b>${esc(CFG.proPriceMonthly)}</b>/month <span>or ${esc(CFG.proPriceYearly)}/year</span></div>
      <a class="btn primary block" id="proBuy" target="_blank" rel="noopener">Get Pro</a>
      <div class="keyrow">
        <input id="proKey" placeholder="Already paid? Paste license key" autocapitalize="off" spellcheck="false">
        <button class="btn" id="proApply">Activate</button>
      </div>
      <p class="hint" id="proMsg"></p>
    </div>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  `;

  /* ---------- binding ---------- */
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

  function fillForm() {
    $$('[data-k]').forEach(el => { const v = getPath(state, el.dataset.k); el.value = v ?? ''; });
    renderItems();
    syncUI();
    $('#accCustom').value = /^#[0-9a-f]{6}$/i.test(state.accent) ? state.accent : '#E8430F';
    $('#brandOff').checked = !state.branding && isPro;
    refreshClients();
  }

  function syncUI() {
    const gst = state.taxMode === 'gst', single = state.taxMode === 'single';
    $$('[data-show]').forEach(el => {
      const k = el.dataset.show;
      el.hidden = !((k === 'gst' && gst) || (k === 'single' && single) || (k === 'inr' && state.currency === 'INR'));
    });
    $$('[data-taxid-label]').forEach(el => { el.textContent = gst ? 'GSTIN' : 'Tax ID'; });
    $$('#items .c-tax').forEach(el => { el.hidden = state.taxMode === 'none'; });
    $('#items').classList.toggle('notax', state.taxMode === 'none');
    $$('#tpls button').forEach(b => b.classList.toggle('is-on', b.dataset.tpl === state.template));
    $$('#swatches button').forEach(b => b.classList.toggle('is-on', b.dataset.acc.toLowerCase() === state.accent.toLowerCase()));
    const has = !!state.logo;
    $('#logoBox').innerHTML = has ? `<img src="${esc(state.logo)}" alt="Logo">` : '<span>Logo</span>';
    $('#logoRm').hidden = !has;
  }

  function renderItems() {
    $('#items').innerHTML = state.items.map(it => `
      <div class="row" data-id="${it.id}">
        <div class="c-desc"><label>Description</label><textarea rows="1" data-f="desc" placeholder="e.g. Website design — homepage">${esc(it.desc)}</textarea></div>
        <div class="c-qty"><label>Qty</label><input type="number" inputmode="decimal" min="0" step="any" data-f="qty" value="${esc(it.qty)}"></div>
        <div class="c-rate"><label>Rate</label><input type="number" inputmode="decimal" min="0" step="any" data-f="rate" value="${esc(it.rate)}" placeholder="0.00"></div>
        <div class="c-tax" ${state.taxMode === 'none' ? 'hidden' : ''}><label>${state.taxMode === 'gst' ? 'GST %' : 'Tax %'}</label><input type="number" inputmode="decimal" min="0" step="any" list="rates" data-f="tax" value="${esc(it.tax)}"></div>
        <div class="c-amt"><label>Amount</label><output data-amt>—</output></div>
        <button type="button" class="icon-btn c-del" data-del title="Remove item" aria-label="Remove item">${ICON.x}</button>
      </div>`).join('');
    $$('#items textarea').forEach(autoGrow);
  }
  const autoGrow = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };

  let persistT;
  function update() {
    renderPreview();
    clearTimeout(persistT);
    persistT = setTimeout(persist, 350);
  }

  function persist() {
    LS.set('draft', state);
    Object.assign(settings, {
      currency: state.currency, taxMode: state.taxMode, taxLabel: state.taxLabel, template: state.template, accent: state.accent,
      from: clone(state.from), payment: state.payment, upi: state.upi, logo: state.logo, notes: state.notes, terms: state.terms
    });
    LS.set('settings', settings);
  }

  function renderPreview() {
    const c = calc(state);
    $('#paper').innerHTML = invoiceHTML(state);
    const rows = $$('#items .row');
    c.items.forEach((it, i) => { const o = rows[i] && $('[data-amt]', rows[i]); if (o) o.textContent = it.amount ? fmt(it.amount, state.currency) : '—'; });
    $('#sumBox').innerHTML = `<span>Total</span><b>${fmt(c.total, state.currency)}</b>`;
    fitPaper();
  }

  function fitPaper() {
    const wrap = $('#paperWrap'), paper = $('#paper');
    if (!wrap || wrap.offsetParent === null) return;
    const w = wrap.clientWidth, pw = 794;
    const s = Math.min(1, w / pw);
    paper.style.transform = `scale(${s})`;
    wrap.style.height = Math.ceil(paper.offsetHeight * s) + 'px';
  }
  window.addEventListener('resize', fitPaper);
  if (window.ResizeObserver) new ResizeObserver(fitPaper).observe($('#paperWrap'));

  /* ---------- events: editor ---------- */
  $('#editor').addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.k) {
      setPath(state, el.dataset.k, el.value);
      if (el.dataset.k === 'taxMode' || el.dataset.k === 'currency') onModeChange(el.dataset.k);
      if (el.dataset.k === 'taxLabel') { const t = $$('#items .c-tax label'); t.forEach(l => (l.textContent = 'Tax %')); }
      update();
    } else if (el.dataset.f) {
      const id = el.closest('.row').dataset.id;
      const it = state.items.find(i => i.id === id);
      it[el.dataset.f] = el.value;
      if (el.dataset.f === 'tax') state.lastTax = el.value;
      if (el.tagName === 'TEXTAREA') autoGrow(el);
      update();
    }
  });

  function onModeChange(k) {
    if (k === 'taxMode') {
      if (state.taxMode === 'gst') state.items.forEach(i => { if (i.tax === '' || i.tax == null || num(i.tax) === 0) i.tax = 18; });
      if (state.taxMode === 'none') state.items.forEach(i => (i.tax = ''));
      if (state.taxMode === 'gst' && state.currency !== 'INR') { state.currency = 'INR'; $('[data-k=currency]').value = 'INR'; }
      renderItems();
    }
    if (k === 'currency' && state.currency !== 'INR' && state.taxMode === 'gst') {
      state.taxMode = 'single'; state.taxLabel = state.taxLabel && state.taxLabel !== 'GST' ? state.taxLabel : 'VAT';
      $('[data-k=taxMode]').value = 'single'; $('[data-k=taxLabel]').value = state.taxLabel;
      renderItems();
    }
    syncUI();
  }

  $('#editor').addEventListener('change', e => {
    if (e.target.dataset.k === 'to.name') {
      const hit = clientsMap()[e.target.value.trim().toLowerCase()];
      if (hit && !state.to.email && !state.to.address) {
        state.to = { ...state.to, ...hit, name: e.target.value.trim() };
        $$('[data-k^="to."]').forEach(el => (el.value = getPath(state, el.dataset.k) ?? ''));
        update();
      }
    }
  });

  $('#addItem').addEventListener('click', () => {
    state.items.push(blankItem());
    renderItems(); syncUI(); update();
    const last = $$('#items .row').pop(); if (last) $('textarea', last).focus();
  });
  $('#items').addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const id = b.closest('.row').dataset.id;
    if (state.items.length === 1) { state.items = [blankItem()]; } else state.items = state.items.filter(i => i.id !== id);
    renderItems(); syncUI(); update();
  });

  $('#tpls').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (!b) return; state.template = b.dataset.tpl; syncUI(); update(); });
  $('#swatches').addEventListener('click', e => { const b = e.target.closest('[data-acc]'); if (!b) return; state.accent = b.dataset.acc; $('#accCustom').value = state.accent; syncUI(); update(); });
  $('#accCustom').addEventListener('input', e => { state.accent = e.target.value; syncUI(); update(); });
  $('#brandOff').addEventListener('change', e => {
    if (!isPro) { e.target.checked = false; openPro(); return; }
    state.branding = !e.target.checked; update();
  });

  $('#logoBtn').addEventListener('click', () => $('#logoFile').click());
  $('#logoRm').addEventListener('click', () => { state.logo = ''; syncUI(); update(); });
  $('#logoFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 400, k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      state.logo = cv.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
      URL.revokeObjectURL(url); syncUI(); update();
    };
    img.onerror = () => toast('Could not read that image.');
    img.src = url; e.target.value = '';
  });

  /* ---------- clients ---------- */
  function clientsMap() {
    const m = {};
    history.slice().sort((a, b) => a.updated - b.updated).forEach(h => { if (h.to && h.to.name) m[h.to.name.trim().toLowerCase()] = h.to; });
    return m;
  }
  function refreshClients() {
    $('#clientList').innerHTML = Object.values(clientsMap()).map(c => `<option value="${esc(c.name)}">`).join('');
  }

  /* ---------- save / history ---------- */
  const proCheckLimit = () => isPro || history.length < CFG.freeLimit;

  function saveInvoice(silent) {
    const exists = history.findIndex(h => h.id === state.id);
    if (exists < 0 && !proCheckLimit()) { openPro(`Free plan holds ${CFG.freeLimit} saved invoices.`); return false; }
    const c = calc(state);
    const rec = { ...clone(state), total: c.total, updated: Date.now() };
    if (exists >= 0) history[exists] = rec; else history.push(rec);
    const m = /^(.*?)(\d+)$/.exec(state.number || '');
    if (m) { settings.prefix = m[1]; settings.next = Math.max(settings.next, parseInt(m[2], 10) + 1); }
    LS.set('invoices', history); persist(); refreshClients(); renderBadge();
    if (!silent) toast('Saved to My invoices');
    return true;
  }

  function startNew() {
    newInvoice(); fillForm(); update(); switchTab('create'); window.scrollTo({ top: root.offsetTop - 10, behavior: 'smooth' });
  }

  function loadInvoice(id) {
    const h = history.find(x => x.id === id); if (!h) return;
    state = clone(h); delete state.total;
    fillForm(); update(); switchTab('create');
    window.scrollTo({ top: root.offsetTop - 10, behavior: 'smooth' });
  }

  function duplicate(id) {
    const h = history.find(x => x.id === id); if (!h) return;
    if (!proCheckLimit()) { openPro(`Free plan holds ${CFG.freeLimit} saved invoices.`); return; }
    state = clone(h); delete state.total;
    state.id = uid(); state.status = 'draft'; state.date = iso(new Date()); state.due = iso(addDays(new Date(), 14));
    state.number = settings.prefix + String(settings.next).padStart(4, '0');
    fillForm(); update(); switchTab('create'); toast('Duplicated — edit and save');
  }

  function remove(id) {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    history = history.filter(h => h.id !== id); LS.set('invoices', history); renderList(); renderBadge(); refreshClients();
  }

  /* ---------- list view ---------- */
  let filter = 'all', query = '';
  function renderBadge() {
    const n = history.filter(h => ['sent', 'overdue'].includes(effectiveStatus(h))).length;
    const b = $('#unpaidBadge'); b.hidden = !n; b.textContent = n;
  }

  function renderList() {
    const sumBy = {};
    history.forEach(h => { if (effectiveStatus(h) === 'paid') return; if (h.status === 'draft') return; sumBy[h.currency] = (sumBy[h.currency] || 0) + (h.total || 0); });
    const paidBy = {}; const mo = iso(new Date()).slice(0, 7);
    history.forEach(h => { if (h.status === 'paid' && (h.date || '').startsWith(mo)) paidBy[h.currency] = (paidBy[h.currency] || 0) + (h.total || 0); });
    const line = o => { const e = Object.entries(o); return e.length ? e.slice(0, 2).map(([k, v]) => fmt(v, k)).join(' · ') : '—'; };
    const overdue = history.filter(h => effectiveStatus(h) === 'overdue').length;
    $('#stats').innerHTML = `
      <div class="stat"><span>Outstanding</span><b>${line(sumBy)}</b></div>
      <div class="stat"><span>Paid this month</span><b>${line(paidBy)}</b></div>
      <div class="stat ${overdue ? 'warn' : ''}"><span>Overdue</span><b>${overdue}</b></div>
      <div class="stat"><span>Total invoices</span><b>${history.length}${isPro ? '' : ` <small>/ ${CFG.freeLimit}</small>`}</b></div>`;

    let rows = history.slice().sort((a, b) => b.updated - a.updated);
    if (filter !== 'all') rows = rows.filter(h => { const s = effectiveStatus(h); return filter === 'unpaid' ? (s === 'sent' || s === 'overdue' || s === 'draft') : s === filter; });
    if (query) rows = rows.filter(h => ((h.to.name || '') + ' ' + h.number).toLowerCase().includes(query));

    if (!history.length) {
      $('#list').innerHTML = `<div class="empty"><div class="empty-art" aria-hidden="true"></div><h3>No invoices yet</h3><p>Create your first one — it takes about a minute, and it’ll show up here.</p><button class="btn primary" data-act="new">${ICON.plus} Create invoice</button></div>`;
      return;
    }
    if (!rows.length) { $('#list').innerHTML = '<div class="empty"><p>No invoices match.</p></div>'; return; }
    $('#list').innerHTML = rows.map(h => {
      const st = effectiveStatus(h);
      return `<article class="li" data-id="${h.id}">
        <div class="li-main"><b>${esc(h.to.name || 'No client')}</b><span>${esc(h.number)} · ${esc(fmtDate(h.date, h.currency))}${h.due ? ' · due ' + esc(fmtDate(h.due, h.currency)) : ''}</span></div>
        <div class="li-amt">${fmt(h.total || 0, h.currency)}</div>
        <select class="st st-${st}" data-status aria-label="Status">
          ${['draft', 'sent', 'paid'].map(s => `<option value="${s}" ${h.status === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}${s === h.status && st === 'overdue' ? ' (overdue)' : ''}</option>`).join('')}
        </select>
        <div class="li-act"><button class="btn ghost sm" data-li="edit">Open</button><button class="btn ghost sm" data-li="dup">Duplicate</button><button class="icon-btn" data-li="del" aria-label="Delete">${ICON.x}</button></div>
      </article>`;
    }).join('');
  }

  $('#list').addEventListener('click', e => {
    const li = e.target.closest('.li'); const b = e.target.closest('[data-li]');
    if (!li || !b) return;
    ({ edit: loadInvoice, dup: duplicate, del: remove })[b.dataset.li](li.dataset.id);
  });
  $('#list').addEventListener('change', e => {
    if (!e.target.matches('[data-status]')) return;
    const id = e.target.closest('.li').dataset.id; const h = history.find(x => x.id === id); h.status = e.target.value; h.updated = Date.now();
    LS.set('invoices', history); renderList(); renderBadge();
  });
  $('#q').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderList(); });
  $('#chips').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; $$('#chips button').forEach(x => x.classList.toggle('is-on', x === b)); renderList(); });

  /* ---------- tabs ---------- */
  function switchTab(t) {
    $$('.app-tabs .tab[data-tab]').forEach(b => b.classList.toggle('is-on', b.dataset.tab === t));
    $('#view-create').hidden = t !== 'create'; $('#view-list').hidden = t !== 'list';
    $('#mobileBar').hidden = t !== 'create';
    if (t === 'list') renderList(); else requestAnimationFrame(fitPaper);
  }

  function setMobileView(v) {
    root.classList.toggle('mv-preview', v === 'preview');
    $$('.mobile-switch button').forEach(b => b.classList.toggle('is-on', b.dataset.mv === v));
    requestAnimationFrame(fitPaper);
  }

  /* ---------- share ---------- */
  function shareText(reminder) {
    const c = calc(state), f = n => fmt(n, state.currency);
    const who = state.to.name ? `Hi ${state.to.name.split(' ')[0]}` : 'Hi';
    const me = state.from.name ? `\n\n— ${state.from.name}` : '';
    const pay = state.upi && state.currency === 'INR' ? `\nUPI: ${state.upi}` : '';
    if (reminder) return `${who}, a gentle reminder that invoice ${state.number} for ${f(c.total)} ${state.due ? `was due on ${fmtDate(state.due, state.currency)}` : 'is pending'}. Could you please arrange the payment?${pay}\n\nThank you!${me}`;
    return `${who}, please find invoice ${state.number} for ${f(c.total)}${state.due ? `, due on ${fmtDate(state.due, state.currency)}` : ''}. I've attached the PDF.${pay}\n\nThank you!${me}`;
  }
  function doShare(kind) {
    $('#shareMenu').hidden = true;
    const text = shareText(kind === 'remind');
    if (kind === 'wa' || kind === 'remind') {
      const ph = (state.to.phone || '').replace(/[^\d]/g, '');
      window.open(`https://wa.me/${ph}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      if (state.status === 'draft') { state.status = 'sent'; $('[data-k=status]').value = 'sent'; update(); }
      toast('Download the PDF and attach it in the chat.');
    } else if (kind === 'mail') {
      location.href = `mailto:${encodeURIComponent(state.to.email || '')}?subject=${encodeURIComponent('Invoice ' + state.number + (state.from.name ? ' from ' + state.from.name : ''))}&body=${encodeURIComponent(text)}`;
      toast('Download the PDF and attach it to the email.');
    } else {
      navigator.clipboard.writeText(text).then(() => toast('Message copied'), () => toast('Copy failed'));
    }
  }

  function downloadPDF() {
    if (!state.from.name && !state.to.name && isPristine(state)) toast('Tip: fill in a few details first.');
    setMobileView('preview');
    const prev = document.title;
    document.title = `${state.number}${state.to.name ? ' - ' + state.to.name : ''}`.replace(/[\\/:*?"<>|]/g, '');
    const restore = () => { document.title = prev; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    saveInvoice(true);
    setTimeout(() => window.print(), 120);
  }

  /* ---------- csv / backup ---------- */
  function download(name, mime, data) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCSV() {
    if (!history.length) return toast('Nothing to export yet.');
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const head = ['Invoice', 'Client', 'Date', 'Due', 'Status', 'Currency', 'Total'];
    const rows = history.map(h => [h.number, h.to.name, h.date, h.due, effectiveStatus(h), h.currency, (h.total || 0).toFixed(2)].map(q).join(','));
    download('billbook-invoices.csv', 'text/csv', [head.map(q).join(','), ...rows].join('\n'));
  }

  /* ---------- pro ---------- */
  async function sha256(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  async function verifyKey(key) {
    try { return CFG.proHashes.includes(await sha256(key.trim())); } catch { return false; }
  }
  function applyProUI() {
    $('#proBtn').hidden = isPro;
    $('#brandOff').checked = isPro && !state.branding;
  }
  function openPro(msg) {
    $('#proMsg').textContent = msg || '';
    const buy = $('#proBuy');
    if (CFG.proLink) { buy.href = CFG.proLink; buy.textContent = 'Get Pro'; }
    else if (CFG.contactEmail) { buy.href = 'mailto:' + CFG.contactEmail + '?subject=Billbook%20Pro'; buy.textContent = 'Email us for Pro'; }
    else { buy.removeAttribute('href'); buy.textContent = 'Pro launching soon'; }
    $('#proModal').hidden = false;
  }
  $('#proApply').addEventListener('click', async () => {
    const key = $('#proKey').value.trim();
    if (await verifyKey(key)) { LS.set('pro', key); isPro = true; applyProUI(); $('#proModal').hidden = true; toast('Pro activated. Thank you!'); renderList(); update(); }
    else $('#proMsg').textContent = 'That key is not valid.';
  });
  $('#proModal').addEventListener('click', e => { if (e.target.id === 'proModal') e.target.hidden = true; });

  /* ---------- delegated actions ---------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (!a || (!root.contains(a) && a.dataset.act !== "pro")) { if (!e.target.closest('.menu-wrap')) $('#shareMenu').hidden = true; return; }
    const act = a.dataset.act;
    if (act === 'pdf') downloadPDF();
    else if (act === 'save') saveInvoice();
    else if (act === 'new') { if (isPristine(state) || confirm('Start a new invoice? Unsaved changes will be lost.')) startNew(); }
    else if (act === 'share') { const m = $('#shareMenu'); m.hidden = !m.hidden; }
    else if (act === 'pro') openPro();
    else if (act === 'closePro') $('#proModal').hidden = true;
    else if (act === 'csv') exportCSV();
    else if (act === 'backup') { if (!isPro) return openPro('Backup is a Pro feature.'); download('billbook-backup.json', 'application/json', JSON.stringify({ v: 1, settings, history })); }
    else if (act === 'restore') { if (!isPro) return openPro('Restore is a Pro feature.'); $('#restoreFile').click(); }
  });
  $('#shareMenu').addEventListener('click', e => { const b = e.target.closest('[data-share]'); if (b) doShare(b.dataset.share); });
  $('#restoreFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => {
      const d = JSON.parse(t);
      if (!Array.isArray(d.history)) throw 0;
      if (!confirm(`Restore ${d.history.length} invoices? This replaces what is stored on this device.`)) return;
      history = d.history; settings = Object.assign(settings, d.settings || {});
      LS.set('invoices', history); LS.set('settings', settings); renderList(); renderBadge(); refreshClients(); toast('Backup restored');
    }).catch(() => toast('That file is not a Billbook backup.')); e.target.value = '';
  });
  $$('.app-tabs .tab[data-tab]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $$('.mobile-switch button').forEach(b => b.addEventListener('click', () => setMobileView(b.dataset.mv)));
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveInvoice(); }
    if (e.key === 'Escape') { $('#proModal').hidden = true; $('#shareMenu').hidden = true; }
  });

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- boot ---------- */
  const draft = LS.get('draft', null);
  if (draft && !(isPristine(draft) && PRESET)) { state = draft; if (!state.items || !state.items.length) state.items = [blankItem()]; }
  else newInvoice();
  fillForm(); renderPreview(); renderBadge(); $('#mobileBar').hidden = false;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitPaper);

  const stored = LS.get('pro', '');
  if (stored) verifyKey(stored).then(ok => { isPro = ok; applyProUI(); renderPreview(); renderList(); });
  applyProUI();

  // Offline + install support
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
