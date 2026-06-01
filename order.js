// ============================================================
// Old Man Threads — Order Serverless Function
// Vercel API Route: /api/order
// Handles: Stripe payment + CJ Dropshipping order creation
// ============================================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ── PRODUCT VIDs ─────────────────────────────────────────────
// Replace BAG_VID once CJ sourcing request is approved
// Replace MYSTERY_VID once you have the hat VID
const BAG_VID    = process.env.BAG_VID    || 'REPLACE_WITH_BAG_VID';
const MYSTERY_VID = process.env.MYSTERY_VID || 'REPLACE_WITH_MYSTERY_HAT_VID';

// ── BUNDLE PRICES (in cents for Stripe) ──────────────────────
const BUNDLE_PRICES = {
  1: 4900,   // $49.00
  2: 9800,   // $98.00
};

const ADDON_PRICES = {
  ship: 600,   // $6.00
  warr: 700,   // $7.00
  myst: 1500,  // $15.00
  supp: 1500,  // $15.00
};

// ── GET CJ ACCESS TOKEN ───────────────────────────────────────
async function getCJToken() {
  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.CJ_API_KEY })
  });
  const data = await res.json();
  if (!data.result) throw new Error('CJ auth failed: ' + data.message);
  return data.data.accessToken;
}

// ── PLACE CJ ORDER ────────────────────────────────────────────
async function placeCJOrder(token, orderData) {
  const { contact, address, items } = orderData;

  // Build product list
  const products = [];

  items.forEach(item => {
    const qty = item.bundle === 2 ? 2 : 1;
    products.push({ vid: BAG_VID, quantity: qty });

    // Add mystery hat if checked
    if (item.addons && item.addons.myst) {
      products.push({ vid: MYSTERY_VID, quantity: 1 });
    }
  });

  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': token
    },
    body: JSON.stringify({
      orderNumber:          'OMT-' + Date.now(),
      shippingCustomerName: contact.name,
      shippingPhone:        contact.phone || '0000000000',
      shippingAddress:      address.line1,
      shippingCity:         address.city,
      shippingZip:          address.zip,
      shippingProvince:     address.state,
      shippingCountry:      address.country,
      shippingCountryCode:  address.country,
      email:                contact.email,
      products
    })
  });

  const data = await res.json();
  return data;
}

// ── CALCULATE ORDER TOTAL (in cents) ─────────────────────────
function calculateTotal(items) {
  return items.reduce((total, item) => {
    let itemTotal = BUNDLE_PRICES[item.bundle] || 4900;
    if (item.addons) {
      Object.entries(item.addons).forEach(([key, checked]) => {
        if (checked && ADDON_PRICES[key]) itemTotal += ADDON_PRICES[key];
      });
    }
    return total + itemTotal;
  }, 0);
}

// ── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // CORS headers — allow your Vercel domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { paymentMethodId, contact, address, items } = req.body;

    // Validate required fields
    if (!paymentMethodId || !contact || !address || !items) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // ── STEP 1: Calculate total ───────────────────────────────
    const totalCents = calculateTotal(items);

    // ── STEP 2: Charge card via Stripe ───────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount:               totalCents,
      currency:             'usd',
      payment_method:       paymentMethodId,
      confirm:              true,
      automatic_payment_methods: {
        enabled:          true,
        allow_redirects:  'never'
      },
      description:          'Old Man Threads — Floral Garden Bag',
      receipt_email:        contact.email,
      metadata: {
        customer_name:  contact.name,
        customer_email: contact.email,
        order_items:    JSON.stringify(items)
      }
    });

    if (paymentIntent.status !== 'succeeded') {
      return res.status(402).json({ success: false, message: 'Payment failed' });
    }

    // ── STEP 3: Place CJ order ────────────────────────────────
    const cjToken = await getCJToken();
    const cjOrder = await placeCJOrder(cjToken, { contact, address, items });

    if (!cjOrder.result) {
      // Payment succeeded but CJ failed — log it for manual follow-up
      console.error('CJ ORDER FAILED — Payment collected but order not placed:', {
        stripePaymentId: paymentIntent.id,
        amount: totalCents,
        contact,
        address,
        items,
        cjError: cjOrder.message
      });

      // Still return success to customer — you'll fulfill manually
      return res.status(200).json({
        success: true,
        manual: true,
        message: 'Payment received. Order will be processed shortly.',
        stripePaymentId: paymentIntent.id
      });
    }

    // ── STEP 4: All good ─────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: 'Order placed successfully',
      stripePaymentId: paymentIntent.id,
      cjOrderId: cjOrder.data?.orderId || null
    });

  } catch (err) {
    console.error('Order error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
}
