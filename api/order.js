import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency = 'usd', items, expressPayment } = req.body;

    // Calculate amount server-side so it can't be tampered with
    const BUNDLE_PRICES = { 1: 49, 2: 98 };
    const ADDON_PRICES  = { ship: 6, warr: 7, myst: 15, supp: 15 };

    let total = 0;
    if (items && items.length) {
      items.forEach(item => {
        let t = BUNDLE_PRICES[item.bundle] || 49;
        if (item.addons) {
          Object.keys(item.addons).forEach(k => {
            if (item.addons[k] && ADDON_PRICES[k]) t += ADDON_PRICES[k];
          });
        }
        total += t;
      });
    } else {
      // Fallback: trust client amount (only for express, validated above)
      total = Math.round((amount || 0) / 100);
    }

    const amountInCents = total * 100;

    if (expressPayment) {
      // For express checkout (Apple Pay / Google Pay) — return a clientSecret
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

    } else {
      // For manual card entry — confirm with paymentMethodId
      const { paymentMethodId, contact, address } = req.body;

      if (!paymentMethodId) {
        return res.status(400).json({ success: false, message: 'No payment method provided.' });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency,
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        receipt_email: contact?.email,
        shipping: {
          name:    contact?.name || '',
          address: {
            line1:       address?.line1 || '',
            line2:       address?.line2 || '',
            city:        address?.city  || '',
            state:       address?.state || '',
            postal_code: address?.zip   || '',
            country:     address?.country || 'US',
          },
        },
        metadata: {
          source: 'old_man_threads',
          items: JSON.stringify(items || []),
        },
      });

      if (paymentIntent.status === 'succeeded') {
        return res.status(200).json({ success: true });
      } else if (paymentIntent.status === 'requires_action') {
        return res.status(200).json({
          success: false,
          requiresAction: true,
          clientSecret: paymentIntent.client_secret,
          message: 'Additional authentication required.',
        });
      } else {
        return res.status(200).json({ success: false, message: 'Payment was not completed.' });
      }
    }

  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Something went wrong.',
    });
  }
}
