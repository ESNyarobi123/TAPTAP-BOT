/**
 * TipTap WhatsApp bot — entry point (Cloud API edition).
 *
 * The previous implementation opened a Baileys WhatsApp Web socket. That has
 * been replaced with the official Meta Cloud API:
 *   • Inbound  ← Express webhook on /webhook (or /inbound when fronted by
 *     Laravel) handed off to the existing state machine in handler.js.
 *   • Outbound → HTTPS POST to graph.facebook.com via src/whatsapp.js.
 *
 * One Express app now serves three concerns on the same port:
 *   - Meta webhook handshake + message callbacks
 *   - Optional Laravel forwarder route (/inbound)
 *   - The bill-image notify endpoint Laravel calls when an order is served
 */

const express = require('express');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { registerWebhookRoutes } = require('./webhook-server');
const { registerNotifyRoutes } = require('./notify-server');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const BIND = process.env.BIND || '0.0.0.0';

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                  TipTap WhatsApp — Cloud API                  ║');
console.log('║      Powered by Meta Graph API · Sessions in MySQL            ║');
console.log('╚════════════════════════════════════════════════════════════════╝');

const app = express();

app.use(express.json({
    limit: '512kb',
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf8');
    },
}));

app.get('/health', (_req, res) => {
    res.json({
        ok: true,
        service: 'tiptopbot',
        version: '2.0.0',
        time: new Date().toISOString(),
    });
});

registerWebhookRoutes(app);
registerNotifyRoutes(app);

app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
});

app.listen(PORT, BIND, () => {
    console.log(`📡 Listening on http://${BIND}:${PORT}`);
    console.log(`🌐 Laravel API:      ${process.env.API_BASE_URL || '(not set)'}`);
    console.log(`📞 Phone Number ID:  ${process.env.WHATSAPP_PHONE_NUMBER_ID || '(missing!)'}`);
    console.log('');
    console.log('Configure these URLs in Meta Business Manager → WhatsApp → Configuration:');
    console.log(`  • Callback URL:  https://<your-domain>/webhook`);
    console.log(`  • Verify token:  set WHATSAPP_VERIFY_TOKEN to match`);
    console.log('');
});

process.on('SIGINT', () => {
    console.log('👋 Shutting down…');
    process.exit(0);
});
