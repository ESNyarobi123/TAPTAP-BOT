/**
 * Persistent session storage backed by Laravel's `/api/bot/session` endpoint.
 *
 * The previous Baileys bot stored conversation state in a process-local
 * `sessions[from]` map; restarting the bot wiped every customer's cart and
 * current screen. We now hydrate from MySQL at the start of each message and
 * write back when the handler is done.
 *
 * To avoid touching every line in handler.js that does `sessions[from].xxx`
 * synchronously, we keep an in-memory cache and treat the API as a
 * write-through layer.
 */

const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const cache = new Map();

const api = axios.create({
    baseURL: process.env.API_BASE_URL,
    headers: {
        Authorization: `Bearer ${process.env.BOT_TOKEN}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

function defaultSession() {
    return {
        state: 'START',
        lang: 'en',
        cart: [],
        restaurant_id: null,
        restaurant_name: null,
        support_phone: null,
        table_number: null,
        table_id: null,
        waiter_id: null,
        waiter_name: null,
        customer_name: null,
        active_order_id: null,
        order_total: 0,
        menu_cache: null,
        current_category: null,
        ussd_phone: null,
        ussd_provider: null,
        rating: null,
        pending_item: null,
        pending_qty: 1,
        quick_payment_id: null,
        quick_payment_amount: null,
        quick_payment_desc: null,
        quick_payment_network: null,
        tip_waiter_id: null,
        tip_waiter_name: null,
        feedback_waiter_id: null,
        feedback_waiter_name: null,
        bill_image_sent_for_order: null,
        pending_order_lines: null,
    };
}

/**
 * Load session for a WhatsApp id. Falls back to in-memory cache on API failure
 * so a temporary backend hiccup does not kill an active conversation.
 */
async function load(waId) {
    if (cache.has(waId)) {
        return cache.get(waId);
    }

    try {
        const { data } = await api.get('/session', { params: { wa_id: waId } });
        const remote = data?.data || {};
        const session = {
            ...defaultSession(),
            ...(remote.data || {}),
            state: remote.state || 'START',
            lang: remote.lang || 'en',
        };
        cache.set(waId, session);
        return session;
    } catch (error) {
        console.error('Session load failed, using fresh defaults:', error.response?.data || error.message);
        const session = defaultSession();
        cache.set(waId, session);
        return session;
    }
}

async function save(waId, session) {
    if (!session) return;
    cache.set(waId, session);

    const { state, lang, ...rest } = session;
    try {
        await api.put('/session', {
            wa_id: waId,
            state: state || 'START',
            lang: lang || 'en',
            data: rest,
        });
    } catch (error) {
        console.error('Session save failed:', error.response?.data || error.message);
    }
}

async function clear(waId) {
    cache.delete(waId);
    try {
        await api.delete('/session', { params: { wa_id: waId } });
    } catch (error) {
        console.error('Session clear failed:', error.response?.data || error.message);
    }
}

module.exports = { load, save, clear, defaultSession };
