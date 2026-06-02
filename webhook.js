/**
 * /api/webhook.js  — Stripe webhook endpoint
 *
 * Set up in Stripe Dashboard → Developers → Webhooks:
 *   Endpoint URL:  https://your-domain.com/api/webhook
 *   Events:        payment_intent.succeeded
 *
 * Add STRIPE_WEBHOOK_SECRET to your Vercel environment variables.
 * This gives you a reliable server-side trigger for CJ fulfillment
 * regardless of whether the browser window stayed open after payment.
 */

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
  if (!data.data?.accessToken) throw new Error('CJ auth failed');
  return data.data.accessToken;
}

const CJ_BAG_VID     = '2407040247571602400';
const CJ_MYSTERY_VID = '2406150745061603100'; // Khaki straw hat, M56to58cm

async function placeCJOrder({ accessToken, paymentIntent }) {
  const meta    = paymentIntent.metadata || {};
  const items   = JSON.parse(meta.items || '[]');
  const shipping = paymentIntent.shipping || {};
  const addr    = shipping.address || {};

  const products = [];

  items.forEach(item => {
    // Always add the bag
    products.push({
      vid:      CJ_BAG_VID,
      quantity: item.bundle,
      price:    0,
    });

    // Only add mystery gift if customer selected the myst addon
    if (item.addons && item.addons.myst) {
        products.push({
          vid:      CJ_MYSTERY_VID,
          quantity: 1,
          price:    0,
        });
    }
  });

  if (!products.length) {
    console.warn('No products built for CJ order — skipping PI:', paymentIntent.id);
    return null;
  }

  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'CJ-Access-Token': accessToken,
    },
    body: JSON.stringify({
      orderNumber:          `OMT-${paymentIntent.id}`,
      shippingZip:          addr.postal_code || '',
      shippingCountryCode:  addr.country     || 'US',
      shippingPhone:        shipping.phone   || '',
      shippingCustomerName: shipping.name    || '',
      shippingAddress:      addr.line1       || '',
      shippingCity:         addr.city        || '',
      shippingProvince:     addr.state       || '',
      remark:               'Old Man Threads order — ' + paymentIntent.id,
      products,
    }),
  });

  const data = await res.json();
  console.log('CJ order response:', JSON.stringify(data));
  return data.data?.orderId || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig  = req.headers['stripe-signature'];
  let event;

  try {
    // Vercel / Next.js: you need raw body. Add `export const config = { api: { bodyParser: false } };`
    // if using Next.js App Router. For plain Vercel serverless, req body is already a Buffer.
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    console.log('Payment succeeded:', pi.id, '— placing CJ order...');
    try {
      const token   = await getCJAccessToken();
      const cjOrder = await placeCJOrder({ accessToken: token, paymentIntent: pi });
      console.log('CJ order placed:', cjOrder);
    } catch (err) {
      // Log and alert yourself (e.g. email/Slack), but return 200 so Stripe doesn't retry
      console.error('CJ fulfillment error for', pi.id, ':', err.message);
    }
  }

  return res.status(200).json({ received: true });
}

// Next.js: prevent body parsing so stripe.webhooks.constructEvent gets the raw buffer
export const config = { api: { bodyParser: false } };
