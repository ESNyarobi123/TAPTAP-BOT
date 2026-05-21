/**
 * WhatsApp Cloud API (Meta) client.
 *
 * Replaces the Baileys socket. Exposes a single `sendMessage(to, payload)`
 * function whose signature matches the bits of Baileys we relied on, so the
 * existing state machine in handler.js does not need to change.
 *
 * Supported payload shapes:
 *   { text: 'hello' }
 *   { image: { url: 'https://...' }, caption: '...' }
 *
 * The `to` argument may be either a digits-only WA id (e.g. "255712345678")
 * or a legacy Baileys JID ("255712345678@s.whatsapp.net"). Both are coerced
 * to the digits-only form Cloud API expects.
 */

const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

if (!PHONE_ID || !ACCESS_TOKEN) {
    console.warn('⚠️  WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN are not set. Outbound messages will fail.');
}

const graph = axios.create({
    baseURL: `https://graph.facebook.com/${GRAPH_VERSION}`,
    headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

graph.interceptors.response.use(
    (response) => response,
    (error) => {
        const body = error.response?.data;
        console.error('Graph API error:', body || error.message);
        throw error;
    },
);

function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
}

async function sendRaw(payload) {
    const { data } = await graph.post(`/${PHONE_ID}/messages`, payload);
    return data;
}

async function sendText(to, body) {
    if (!body) return null;
    return sendRaw({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body, preview_url: false },
    });
}

async function sendImage(to, link, caption) {
    return sendRaw({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'image',
        image: { link, ...(caption ? { caption } : {}) },
    });
}

/**
 * Baileys-compatible facade. The legacy handler calls `sock.sendMessage(jid, payload)`;
 * we route that into the appropriate Cloud API endpoint based on the payload shape.
 */
async function sendMessage(rawTo, payload) {
    const to = digitsOnly(rawTo);
    if (!to) {
        throw new Error('sendMessage: missing recipient');
    }

    if (payload?.image?.url) {
        return await sendImage(to, payload.image.url, payload.caption);
    }

    if (typeof payload?.text === 'string') {
        return await sendText(to, payload.text);
    }

    throw new Error(`sendMessage: unsupported payload shape (${Object.keys(payload || {}).join(',')})`);
}

/**
 * Acknowledge an inbound message so the customer sees "read" ticks.
 * Optional — failures are logged but do not bubble up.
 */
async function markRead(messageId) {
    if (!messageId) return;
    try {
        await sendRaw({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
        });
    } catch (_) {
        // best-effort, ignore
    }
}

module.exports = {
    sendMessage,
    sendText,
    sendImage,
    markRead,
    digitsOnly,
};
