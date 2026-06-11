/**
 * Feature flags — set INTEGRATED_PAYMENTS_ENABLED=true in .env when M-Pesa / bill / tip flows are ready.
 * Default: hidden (cash-only in order flow).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const integratedPaymentsEnabled = process.env.INTEGRATED_PAYMENTS_ENABLED === 'true';

module.exports = {
    integratedPaymentsEnabled,
};
