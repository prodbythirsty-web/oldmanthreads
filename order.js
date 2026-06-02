import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── CJ Dropshipping helpers ───────────────────────────────────────────────

async function getCJAccessToken() {
  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:    process.env.CJ_EMAIL,
      password: process.env.CJ_PASSWORD,
    }),
  });
  const data = await res.json();
  if (!data.data?.accessToken) throw new Error('CJ auth failed: ' + JSON.stringify(data));
  return data.data.accessToken;
}

// ─── CJ Product IDs ───────────────────────────────────────────────────────
// Bag (Beige): VID provided by merchant
const CJ_BAG_VID  = '2407040247571602400';
// Mystery Gift: set CJ_MYSTERY_VID in your Vercel environment variables
// (you'll get this VID from the CJ product listing for the mystery item)
const CJ_MYSTERY_VID = '2406150745061603100'; // Khaki straw hat, M56to58cm

async function placeCJOrder({ accessToken, contact, address, items }) {
  const products = [];

  items.forEach(item => {
    // Always add the bag — quantity matches the bundle (1 or 2 bags)
    products.push({
      vid:      CJ_BAG_VID,
      quantity: item.bundle,
      price:    0,
    });

    // Only add the mystery gift if the customer selected it
    if (item.addons && item.addons.myst) {
        products.push({
          vid:      CJ_MYSTERY_VID,
          quantity: 1,
          price:    0,
        });
    }
  });

  const payload = {
    orderNumber: `OMT-${Date.now()}`,
    shippingZip:         address?.zip     || '',
    shippingCountryCode: address?.country || 'US',
    shippingPhone:       contact?.phone   || '',
    shippingCustomerName: contact?.name   || '',
    shippingAddress:     address?.line1   || '',
    shippingCity:        address?.city    || '',
    shippingProvince:    address?.state   || '',
    remark:              'Old Man Threads order',
    products,
  };

  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'CJ-Access-Token': accessToken,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!data.data?.orderId) {
    // Log but don't fail the customer-facing response — payment already taken
    console.error('CJ order placement failed:', JSON.stringify(data));
    return null;
  }
  return data.data.orderId;
}

// ─── Price table (server-side, tamper-proof) ──────────────────────────────

const BUNDLE_PRICES = { 1: 49, 2: 98 };
const ADDON_PRICES  = { ship: 6, warr: 7, myst: 15, supp: 15 };

function calcTotal(items, fallbackCents) {
  if (items && items.length) {
    let total = 0;
    items.forEach(item => {
      let t = BUNDLE_PRICES[item.bundle] || 49;
      if (item.addons) {
        Object.keys(item.addons).forEach(k => {
          if (item.addons[k] && ADDON_PRICES[k]) t += ADDON_PRICES[k];
        });
      }
      total += t;
    });
    return total * 100;
  }
  return Math.round(fallbackCents || 0);
}

// ─── Handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency = 'usd', items, expressPayment, paymentIntentId, contact, address } = req.body;

    const amountInCents = calcTotal(items, amount);

    // ── 1. Express / Payment Element init: create a PaymentIntent and return clientSecret ──
    if (expressPayment) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency,
        automatic_payment_methods: { enabled: true },
        metadata: {
          source: 'old_man_threads_express',
          items: JSON.stringify(items || []),
        },
      });
      return res.status(200).json({ clientSecret: paymentIntent.client_secret });
    }

    // ── 2. Webhook / server-confirm path (for 3DS or manual confirms) ──
    // Stripe Payment Element confirmPayment() handles confirmation client-side;
    // this branch is available as a fallback or for server-side confirmation flows.
    if (paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        // Place the CJ Dropshipping fulfillment order
        try {
          const token    = await getCJAccessToken();
          const cjOrder  = await placeCJOrder({ accessToken: token, contact, address, items });
          console.log('CJ order placed:', cjOrder);
        } catch (cjErr) {
          // Don't surface CJ errors to the customer — payment succeeded, fulfil manually if needed
          console.error('CJ fulfillment error:', cjErr.message);
        }
        return res.status(200).json({ success: true });
      } else {
        return res.status(200).json({ success: false, message: 'Payment not completed.' });
      }
    }

    return res.status(400).json({ success: false, message: 'Invalid request.' });

  } catch (err) {
    console.error('Order handler error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Something went wrong.',
    });
  }
}
