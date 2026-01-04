const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const api = axios.create({
    baseURL: process.env.API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.BOT_TOKEN}`
    },
    timeout: 30000
});

// Add response interceptor for error handling
api.interceptors.response.use(
    response => response,
    error => {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
    }
);

module.exports = {
    /**
     * 1. QR Scan / Entry (Verify Restaurant)
     * GET /api/bot/verify-restaurant?restaurant_id=1&table_number=5
     * Response: { success, data: { id, name, location, table_number } }
     */
    verifyRestaurant: async (restaurantId, tableNumber) => {
        const response = await api.get('/verify-restaurant', {
            params: { restaurant_id: restaurantId, table_number: tableNumber }
        });
        return response.data;
    },

    /**
     * 2. Search Restaurant (Backup Entry)
     * GET /api/bot/search-restaurant?query=Samaki
     * Response: { success, count, data: [{ id, name, location }] }
     */
    searchRestaurant: async (query) => {
        const response = await api.get('/search-restaurant', {
            params: { query }
        });
        return response.data;
    },

    /**
     * 3. Get Full Menu (Categories + Items)
     * GET /api/bot/restaurant/{id}/full-menu
     * Response: { success, data: [{ id, name, menu_items: [{ id, name, price, is_available }] }] }
     */
    getFullMenu: async (restaurantId) => {
        const response = await api.get(`/restaurant/${restaurantId}/full-menu`);
        return response.data;
    },

    /**
     * 4. Get Item Detail
     * GET /api/bot/item/{id}
     * Response: { success, data: { id, name, price, description, image } }
     */
    getItemDetail: async (itemId) => {
        const response = await api.get(`/item/${itemId}`);
        return response.data;
    },

    /**
     * 5. Create Order (Tuma Oda)
     * POST /api/bot/order
     * Body: { restaurant_id, table_number, customer_phone, items: [{ menu_item_id, quantity }] }
     * Response: { success, order_id, total, message }
     */
    createOrder: async (orderData) => {
        const totalAmount = orderData.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const response = await api.post('/order', {
            restaurant_id: orderData.restaurant_id,
            table_number: orderData.table_number,
            customer_phone: orderData.customer_phone,
            total: totalAmount,
            items: orderData.items.map(item => ({
                menu_item_id: item.menu_id,
                quantity: item.qty,
                price: parseFloat(item.price),
                total: parseFloat(item.price) * item.qty,
                subtotal: parseFloat(item.price) * item.qty
            }))
        });
        return response.data;
    },

    /**
     * Get Tables for a specific restaurant (Bot API)
     * GET /api/bot/restaurant/{id}/tables
     */
    getRestaurantTables: async (restaurantId) => {
        try {
            // Try variation 1: /restaurant/{id}/tables
            const res1 = await api.get(`/restaurant/${restaurantId}/tables`);
            if (res1.data && res1.data.success) return res1.data;

            // Try variation 2: /tables?restaurant_id={id}
            const res2 = await api.get('/tables', { params: { restaurant_id: restaurantId } });
            return res2.data;
        } catch (e) {
            console.log('Bot tables API failed, falling back to manager API...');
            return module.exports.getManagerTables();
        }
    },

    /**
     * 6. Polling Status (Check Order & Payment)
     * GET /api/bot/order/{id}/status
     * Response: { success, status, payment_status, total, items }
     */
    getOrderStatus: async (orderId) => {
        const response = await api.get(`/order/${orderId}/status`);
        return response.data;
    },

    /**
     * 7. Initiate USSD Payment
     * POST /api/bot/payment/ussd
     * Body: { order_id, phone_number, amount }
     * Response: { success, payment_id, message }
     */
    initiateUssdPayment: async (paymentData) => {
        console.log('🚀 [USSD] Requesting push for Order:', paymentData.order_id);
        console.log('📱 [USSD] Data:', {
            phone: paymentData.phone,
            amount: paymentData.amount,
            provider: paymentData.provider
        });

        const response = await api.post('/payment/ussd', {
            order_id: paymentData.order_id,
            phone_number: paymentData.phone,
            amount: paymentData.amount,
            provider: paymentData.provider
        });

        console.log('✅ [USSD] API Response:', JSON.stringify(response.data, null, 2));
        return response.data;
    },

    /**
     * 8. Submit Feedback
     * POST /api/bot/feedback
     * Body: { restaurant_id, customer_phone, rating, comment }
     * Response: { success, message }
     */
    submitFeedback: async (feedbackData) => {
        const response = await api.post('/feedback', feedbackData);
        return response.data;
    },

    /**
     * 9. Submit Tip
     * POST /api/bot/tip
     * Body: { order_id, amount }
     * Response: { success, message }
     */
    submitTip: async (tipData) => {
        const response = await api.post('/tip', tipData);
        return response.data;
    },

    // ═══════════════════════════════════════════════════════════════
    // MANAGER APIs (Dynamic Data Fetching)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Get Tables from Manager API
     * GET /api/v1/manager/tables
     */
    getManagerTables: async () => {
        const baseUrl = process.env.API_BASE_URL.replace('/bot', '');
        const response = await axios.get(`${baseUrl}/v1/manager/tables`, {
            headers: {
                'Authorization': `Bearer ${process.env.BOT_TOKEN}`,
                'Accept': 'application/json'
            }
        });
        return response.data;
    },

    /**
     * Get Categories from Manager API
     * GET /api/v1/manager/categories
     */
    getManagerCategories: async () => {
        const baseUrl = process.env.API_BASE_URL.replace('/bot', '');
        const response = await axios.get(`${baseUrl}/v1/manager/categories`, {
            headers: {
                'Authorization': `Bearer ${process.env.BOT_TOKEN}`,
                'Accept': 'application/json'
            }
        });
        return response.data;
    },

    /**
     * Get Menu Items from Manager API
     * GET /api/v1/manager/menu
     */
    getManagerMenu: async () => {
        const baseUrl = process.env.API_BASE_URL.replace('/bot', '');
        const response = await axios.get(`${baseUrl}/v1/manager/menu`, {
            headers: {
                'Authorization': `Bearer ${process.env.BOT_TOKEN}`,
                'Accept': 'application/json'
            }
        });
        return response.data;
    }
};
