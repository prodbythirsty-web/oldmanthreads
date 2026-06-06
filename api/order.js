import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
    const { amount, currency = 'usd', items, shipping } = req.body;

    const amountInCents = calcTotal(items, amount);

    if (!amountInCents || amountInCents < 50) {
      return res.status(400).json({ success: false, message: 'Invalid order amount.' });
    }

    // Build PaymentIntent params
    const piParams = {
      amount: amountInCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        source: 'old_man_threads',
        items: JSON.stringify(items || []),
      },
    };

    // Attach shipping to PaymentIntent if provided so webhook can read it
    if (shipping && shipping.name && shipping.address) {
      piParams.shipping = {
        name:    shipping.name,
        phone:   shipping.phone || '',
        address: {
          line1:       shipping.address.line1       || '',
          line2:       shipping.address.line2       || '',
          city:        shipping.address.city        || '',
          state:       shipping.address.state       || '',
          postal_code: shipping.address.postal_code || '',
          country:     shipping.address.country     || 'US',
        },
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(piParams);

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });

  } catch (err) {
    console.error('Order handler error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Something went wrong.',
    });
  }
}
