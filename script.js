'use strict';

const BUNDLES = {
  1: { qty: 1, price: 49,  was: 98  },
  2: { qty: 2, price: 98,  was: 196 }
};
const ADDON_LIST = [
  { id: 'ship', icon: '\u{1F4E6}', name: 'Shipping Protection', price: 6  },
  { id: 'warr', icon: '\u{1F6E1}\uFE0F', name: '30-Day Warranty', price: 7  },
  { id: 'myst', icon: '\u{1F381}', name: 'Mystery Box',           price: 15 },
  { id: 'supp', icon: '\u2764\uFE0F', name: 'Show Your Support', price: 15 },
];

let selBundle = 2;
let cartItems = [];
let curStep   = 1;

/* ── COUNTDOWN ── */
(function () {
  const KEY = 'omt_sale_end_v2';
  let end = Number(sessionStorage.getItem(KEY));
  if (!end || end < Date.now()) {
    end = Date.now() + ((2 * 86400) + (23 * 3600) + (55 * 60)) * 1000;
    sessionStorage.setItem(KEY, end);
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    let d = Math.max(0, end - Date.now());
    const D = Math.floor(d / 86400000); d %= 86400000;
    const H = Math.floor(d / 3600000);  d %= 3600000;
    const M = Math.floor(d / 60000);    d %= 60000;
    const S = Math.floor(d / 1000);
    document.getElementById('cd-d').textContent = pad(D);
    document.getElementById('cd-h').textContent = pad(H);
    document.getElementById('cd-m').textContent = pad(M);
    document.getElementById('cd-s').textContent = pad(S);
  }
  tick(); setInterval(tick, 1000);
})();

/* ── LIVE DELIVERY DATES — always based on customer's real current date ── */
(function () {
  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function addDays(base, n) { const d = new Date(base); d.setDate(d.getDate() + n); return d; }
  function fmt(d) { return MO[d.getMonth()] + ' ' + d.getDate(); }
  const today  = new Date();
  const ready1 = addDays(today, 1);
  const ready2 = addDays(today, 2);
  const del1   = addDays(today, 7);
  const del2   = addDays(today, 10);
  document.getElementById('tl-today').textContent = fmt(today);
  document.getElementById('tl-ready').textContent = fmt(ready1) + '\u2013' + ready2.getDate();
  document.getElementById('tl-del').textContent   = fmt(del1)   + '\u2013' + del2.getDate();
  document.getElementById('copy-year').textContent = today.getFullYear();
})();

/* ── MEDIA SWITCHER (image or video) ── */
function switchMedia(btn, type, src, label) {
  const img = document.getElementById('main-img');
  const vid = document.getElementById('main-video');
  if (type === 'video') {
    img.style.display = 'none';
    vid.style.display = 'block';
    if (vid.src !== src) { vid.src = src; }
    vid.play();
  } else {
    vid.style.display = 'none';
    img.style.display = 'block';
    img.src = src;
    img.alt = 'Old Man Threads Floral Bag \u2014 ' + label;
  }
  document.querySelectorAll('.thumb').forEach(t =>
    t.setAttribute('aria-selected', t === btn ? 'true' : 'false')
  );
}
/* Legacy shim */
function switchImg(btn, src, label) { switchMedia(btn, 'image', src, label); }

/* ── BUNDLE SELECT ── */
function selectBundle(n) {
  selBundle = n;
  [1, 2].forEach(i => {
    const c   = document.getElementById('card-' + i);
    const sel = (i === n);
    c.classList.toggle('selected', sel);
    c.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  const b = BUNDLES[n];
  document.getElementById('hero-price').textContent = '$' + b.price + '.00';
  document.getElementById('hero-was').textContent   = '$' + b.was   + '.00';
  updateStickyPrice();
}

function updateStickyPrice() {
  const b   = BUNDLES[selBundle];
  const ads = getAddonsForBundle(selBundle);
  const extra = ADDON_LIST.reduce((s, a) => s + (ads[a.id] ? a.price : 0), 0);
  document.getElementById('sticky-price').textContent = '$' + (b.price + extra) + '.00';
}

function toggleAddon(e, el, bundleId, addonId) {
  e.stopPropagation();
  const on = !el.classList.contains('checked');
  el.classList.toggle('checked', on);
  el.innerHTML = on ? '\u2713' : '';
  el.setAttribute('aria-checked', on ? 'true' : 'false');
  updateStickyPrice();
}

function getAddonsForBundle(n) {
  const card = document.getElementById('addons-' + n);
  const res  = {};
  ADDON_LIST.forEach(a => {
    const check = card.querySelector('[data-addon="' + a.id + '"] .addon-check');
    res[a.id] = check ? check.classList.contains('checked') : false;
  });
  return res;
}

function cartTotal() {
  return cartItems.reduce((sum, item) => {
    const b   = BUNDLES[item.bundle];
    const ext = ADDON_LIST.reduce((s, a) => s + (item.addons[a.id] ? a.price : 0), 0);
    return sum + b.price + ext;
  }, 0);
}

/* ── CART RESERVE TIMER ── */
let cartReserveInterval = null;
function startCartTimer() {
  const KEY = 'omt_cart_reserve';
  let end = Number(sessionStorage.getItem(KEY));
  if (!end || end < Date.now()) {
    end = Date.now() + 10 * 60 * 1000;
    sessionStorage.setItem(KEY, end);
  }
  const bar = document.getElementById('cart-timer-bar');
  const el  = document.getElementById('cart-reserve-timer');
  if (bar) bar.style.display = '';
  if (cartReserveInterval) clearInterval(cartReserveInterval);
  cartReserveInterval = setInterval(() => {
    const left = Math.max(0, end - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    if (el) el.textContent = m + ':' + String(s).padStart(2,'0');
    if (left <= 0) {
      clearInterval(cartReserveInterval);
      sessionStorage.removeItem(KEY);
    }
  }, 1000);
}

function addonIcon(id) {
  const icons = { ship: '📦', warr: '🛡️', myst: '🎁', supp: '❤️' };
  return icons[id] || '✨';
}

function renderCart() {
  const body  = document.getElementById('drawer-body');
  const foot  = document.getElementById('drawer-footer');
  const count = document.getElementById('cart-item-count');
  const THUMB = 'bag1.jpg';

  // Total item count for header
  const totalQty = cartItems.reduce((s, item) => s + BUNDLES[item.bundle].qty, 0);
  if (count) count.textContent = totalQty;

  if (!cartItems.length) {
    body.innerHTML = '<div class="cart-empty"><div class="empty-icon">\u{1F6D2}</div><p>Your cart is empty.<br>Add a bag to get started!</p></div>';
    foot.style.display = 'none';
    const bar = document.getElementById('cart-timer-bar');
    if (bar) bar.style.display = 'none';
    return;
  }

  foot.style.display = 'block';
  startCartTimer();

  let totalSavings = 0;
  let html = '';

  cartItems.forEach((item, idx) => {
    const b    = BUNDLES[item.bundle];
    const was  = b.was;
    const now  = b.price;
    const saved = was - now;
    totalSavings += saved;

    // Bag row
    html += '<div class="cart-item">'
      + '<div class="cart-item-thumb"><img src="' + THUMB + '" alt="WingCarry Bag"></div>'
      + '<div class="cart-item-info">'
      + '<div class="cart-item-name">WingCarry Bags</div>'
      + '<div class="cart-item-sub">Royal Blue</div>'
      + '<div class="cart-item-bottom">'
      + '<div class="qty-stepper">'
      + '<button class="qty-btn" onclick="changeBundleQty(' + idx + ',-1)" aria-label="Decrease">&#8722;</button>'
      + '<span class="qty-num">' + b.qty + '</span>'
      + '<button class="qty-btn" onclick="changeBundleQty(' + idx + ',1)" aria-label="Increase">+</button>'
      + '</div>'
      + '<div class="cart-item-price-row">'
      + '<span class="cart-item-was">$' + was + '.00</span>'
      + '<span class="cart-item-price" style="color:var(--bark)">$' + now + '.00</span>'
      + '</div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--moss);font-weight:700;margin-top:4px">(You save $' + saved + ')</div>'
      + '</div>'
      + '<button class="cart-item-remove" onclick="removeItem(' + idx + ')" aria-label="Remove">🗑️</button>'
      + '</div>';

    // Addon rows (each active addon shown as its own row)
    ADDON_LIST.forEach(a => {
      if (!item.addons[a.id]) return;
      html += '<div class="cart-addon-row">'
        + '<div class="cart-addon-thumb">' + a.icon + '</div>'
        + '<div class="cart-addon-info">'
        + '<div class="cart-addon-name">' + a.name + '</div>'
        + '<div class="cart-addon-bottom">'
        + '<div class="qty-stepper">'
        + '<button class="qty-btn" onclick="removeAddonFromItem(' + idx + ','' + a.id + '')" aria-label="Remove addon">&#8722;</button>'
        + '<span class="qty-num">1</span>'
        + '<button class="qty-btn" style="opacity:.35;cursor:default" disabled aria-label="Max 1">+</button>'
        + '</div>'
        + '<span class="cart-addon-price">$' + a.price + '.00</span>'
        + '</div>'
        + '</div>'
        + '<button class="cart-item-remove" onclick="removeAddonFromItem(' + idx + ','' + a.id + '')" aria-label="Remove addon">🗑️</button>'
        + '</div>';
    });
  });

  // Savings + subtotal
  const tot = cartTotal();
  if (totalSavings > 0) {
    html += '<div class="cart-savings-row"><span>Savings</span><span>-$' + totalSavings + '.00</span></div>';
  }
  html += '<div class="cart-ship-row"><span>Shipping</span><span style="color:var(--moss);font-weight:700">FREE</span></div>';
  html += '<div class="cart-subtotal-row"><span>Subtotal</span><span>$' + tot + '.00</span></div>';

  body.innerHTML = html;
}

function changeBundleQty(idx, delta) {
  const item = cartItems[idx];
  const newBundle = item.bundle + delta;
  if (newBundle < 1) { removeItem(idx); return; }
  if (newBundle > 2) return; // max bundle size is 2
  item.bundle = newBundle;
  updateBadge(); renderCart();
}

function removeAddonFromItem(idx, addonId) {
  if (cartItems[idx]) {
    cartItems[idx].addons[addonId] = false;
    updateBadge(); renderCart();
  }
}

function removeItem(i) { cartItems.splice(i, 1); updateBadge(); renderCart(); }

function updateBadge() {
  const badge = document.getElementById('cart-badge');
  const n = cartItems.reduce((s, item) => s + BUNDLES[item.bundle].qty, 0);
  badge.textContent = n;
  badge.classList.toggle('show', n > 0);
  // Also update drawer header count if visible
  const countEl = document.getElementById('cart-item-count');
  if (countEl) countEl.textContent = n;
}

function addToCart() {
  const addons = getAddonsForBundle(selBundle);
  cartItems.push({ bundle: selBundle, addons });
  updateBadge(); renderCart(); toast('\u{1F6D2} Added to cart!');
  setTimeout(openCart, 350);
}

function openCart() {
  renderCart();
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function closeAll() { closeCart(); closeCheckout(); }

/* ── CLEAR PAYMENT FIELDS — called whenever leaving step 2 ── */
function clearPaymentFields() {
  ['f-cn','f-cc','f-ex','f-cv'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['fg-cn','fg-cc','fg-ex','fg-cv'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('has-err');
  });
}

function openCheckout() {
  closeCart();
  sessionStorage.setItem('omt_cart', JSON.stringify(cartItems));
  window.location.href = '/checkout.html';
}
function closeCheckout() {
  document.getElementById('checkout-modal').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function showSuccess() {
  document.getElementById('form-wrap').style.display    = 'none';
  document.getElementById('success-wrap').style.display = 'block';
  document.getElementById('checkout-box').scrollTop = 0;
}

function showStep(n) {
  /* Clear payment fields whenever navigating AWAY from step 2 */
  if (curStep === 2 && n !== 2) clearPaymentFields();
  curStep = n;
  [1, 2, 3].forEach(i => {
    document.getElementById('panel-' + i).classList.toggle('active', i === n);
    const tab = document.getElementById('tab-' + i);
    tab.classList.remove('active', 'done');
    if (i === n)    tab.classList.add('active');
    else if (i < n) tab.classList.add('done');
  });
  if (n === 3) renderReview();
  document.getElementById('checkout-box').scrollTop = 0;
}

function checkField(fieldId, groupId, fn) {
  const el  = document.getElementById(fieldId);
  const grp = document.getElementById(groupId);
  const ok  = fn ? fn(el.value.trim()) : el.value.trim().length > 0;
  grp.classList.toggle('has-err', !ok);
  return ok;
}
function validateStep(n) {
  if (n === 1) {
    return !!(
      checkField('f-fn', 'fg-fn') &
      checkField('f-ln', 'fg-ln') &
      checkField('f-em', 'fg-em', v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) &
      checkField('f-ad', 'fg-ad') &
      checkField('f-ct', 'fg-ct') &
      checkField('f-zp', 'fg-zp')
    );
  }
  if (n === 2) {
    return !!(
      checkField('f-cn', 'fg-cn') &
      checkField('f-cc', 'fg-cc', v => v.replace(/\s/g,'').length >= 15) &
      checkField('f-ex', 'fg-ex', v => /^\d{2}\s*\/\s*\d{2}$/.test(v)) &
      checkField('f-cv', 'fg-cv', v => /^\d{3,4}$/.test(v))
    );
  }
  return true;
}
function goStep(n) {
  if (n > curStep && !validateStep(curStep)) return;
  showStep(n);
}

function renderReview() {
  const sum = document.getElementById('review-summary');
  const ael = document.getElementById('review-addons');
  if (!cartItems.length) { sum.innerHTML = '<p style="color:var(--linen-dark)">Your cart is empty.</p>'; return; }

  let rows = '', sub = 0;
  cartItems.forEach(item => {
    const b = BUNDLES[item.bundle];
    rows += '<div class="cos-row"><span class="cn">Floral Garden Bag &times;' + b.qty + '</span><span class="cp">$' + b.price + '.00</span></div>';
    sub  += b.price;
  });
  const masterAddons = cartItems[0].addons;
  let aTotal = 0;
  ADDON_LIST.forEach(a => {
    if (masterAddons[a.id]) {
      rows   += '<div class="cos-row"><span class="cn">' + a.icon + ' ' + a.name + '</span><span class="cp">+$' + a.price + '.00</span></div>';
      aTotal += a.price;
    }
  });
  const tot = sub + aTotal;
  sum.innerHTML = rows
    + '<div class="cos-div"></div>'
    + '<div class="cos-row"><span class="cn">Shipping</span><span class="cp" style="color:var(--moss)">FREE</span></div>'
    + '<div class="cos-div"></div>'
    + '<div class="cos-total"><span>Total</span><span id="rev-total">$' + tot + '.00</span></div>';

  let ah = '';
  ADDON_LIST.forEach(a => {
    const on = masterAddons[a.id];
    ah += '<div class="ca-row' + (on ? ' on' : '') + '" id="ra-' + a.id + '" onclick="toggleRevAddon(\'' + a.id + '\')">'
        + '<div class="ca-left"><div class="ca-check">' + (on ? '\u2713' : '') + '</div><span>' + a.icon + ' ' + a.name + '</span></div>'
        + '<span class="ca-price">+$' + a.price + '.00</span></div>';
  });
  ael.innerHTML = ah;
}

function toggleRevAddon(id) {
  cartItems.forEach(item => { item.addons[id] = !item.addons[id]; });
  const on  = cartItems[0].addons[id];
  const row = document.getElementById('ra-' + id);
  row.classList.toggle('on', on);
  row.querySelector('.ca-check').textContent = on ? '\u2713' : '';
  const el = document.getElementById('rev-total');
  if (el) el.textContent = '$' + cartTotal() + '.00';
}

/* ================================================================
   STRIPE PUBLISHABLE KEY
   This is safe to be in frontend code (it's public).
   The secret key lives securely in Vercel environment variables.
   ================================================================ */
const STRIPE_PK = 'pk_test_51TdPvsK2cuhO8Q3MEv62MRWodCCL2AGOyPqQYJbvbXu8mFtPgjSx2aJ6SnNzuYcpFoL3oYopjtQ9b1vrGfi3GNWV00hOc8VIPF';

async function placeOrder() {
  const btn = document.getElementById('place-btn');
  btn.textContent = '⏳ Placing...';
  btn.disabled = true;

  try {
    // STEP 1: Load Stripe & create payment method
    const stripe = Stripe(STRIPE_PK);
    const cardNumber = document.getElementById('f-cc').value.replace(/\s/g, '');
    const expiry     = document.getElementById('f-ex').value.replace(/\s/g, '').split('/');
    const cvc        = document.getElementById('f-cv').value.trim();
    const name       = document.getElementById('f-cn').value.trim();

    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: 'card',
      card: {
        number:    cardNumber,
        exp_month: parseInt(expiry[0]),
        exp_year:  parseInt('20' + expiry[1].trim()),
        cvc:       cvc,
      },
      billing_details: { name }
    });

    if (error) {
      alert('Card error: ' + error.message);
      btn.textContent = '✓ Place Order';
      btn.disabled = false;
      return;
    }

    // STEP 2: Send to serverless function
    const response = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethodId: paymentMethod.id,
        contact: {
          name:  document.getElementById('f-fn').value.trim() + ' ' + document.getElementById('f-ln').value.trim(),
          email: document.getElementById('f-em').value.trim(),
          phone: document.getElementById('f-ph').value.trim(),
        },
        address: {
          line1:   document.getElementById('f-ad').value.trim(),
          city:    document.getElementById('f-ct').value.trim(),
          zip:     document.getElementById('f-zp').value.trim(),
          state:   document.getElementById('f-st').value.trim(),
          country: document.getElementById('f-co').value,
        },
        items: cartItems
      })
    });

    const data = await response.json();

    if (data.success) {
      showSuccess();
    } else {
      alert('Order failed: ' + (data.message || 'Unknown error'));
      btn.textContent = '✓ Place Order';
      btn.disabled = false;
    }

  } catch (err) {
    alert('Error: ' + err.message);
    btn.textContent = '✓ Place Order';
    btn.disabled = false;
  }
}

function resetCart() { cartItems = []; updateBadge(); renderCart(); }

/* ── SCROLL REVEAL ── */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ── STICKY ATC ── */
const sBar    = document.getElementById('sticky-atc');
const mainAtc = document.getElementById('main-atc');
new IntersectionObserver(entries => {
  sBar.classList.toggle('visible', !entries[0].isIntersecting);
}, { threshold: 0 }).observe(mainAtc);

/* ── CARD INPUT FORMATTING ── */
document.getElementById('f-cc').addEventListener('input', function () {
  let v = this.value.replace(/\D/g, '').substring(0, 16);
  this.value = v.match(/.{1,4}/g)?.join(' ') ?? v;
});
document.getElementById('f-ex').addEventListener('input', function () {
  let v = this.value.replace(/\D/g, '').substring(0, 4);
  if (v.length > 2) v = v.substring(0, 2) + ' / ' + v.substring(2);
  this.value = v;
});
document.getElementById('f-cv').addEventListener('input', function () {
  this.value = this.value.replace(/\D/g, '').substring(0, 4);
});

/* ── NEWSLETTER ── */
function handleNewsletter() {
  const inp = document.getElementById('nl-email');
  const v   = inp.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    inp.style.borderColor = 'var(--petal)';
    setTimeout(() => inp.style.borderColor = '', 1800);
    return;
  }
  inp.value = '';
  toast('\u2713 You\'re on the list! \u{1F338}');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.innerHTML = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

renderCart();
updateStickyPrice();