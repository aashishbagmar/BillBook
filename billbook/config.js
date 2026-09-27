// Billbook runtime config. Edit before deploying.
window.BILLBOOK_CONFIG = {
  // Payment link (Razorpay / Stripe / Lemon Squeezy payment page). Opens from the Pro modal.
  proLink: '',
  // Support / sales email shown in the Pro modal when proLink is empty.
  contactEmail: '',
  // Shown in pricing UI.
  proPriceMonthly: '₹199',
  proPriceYearly: '₹1,499',
  // Max saved invoices on the free plan.
  freeLimit: 10,
  // SHA-256 hex hashes of valid license keys. See README for how to mint keys.
  proHashes: []
};
