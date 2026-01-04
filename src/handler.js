const api = require('./api');

const sessions = {};

// ═══════════════════════════════════════════════════════════════
// MAIN MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════
async function handleMessage(sock, msg) {
    const from = msg.key.remoteJid;

    // Ignore group messages and status broadcasts
    if (from.endsWith('@g.us') || from === 'status@broadcast') {
        return;
    }

    // Parse message text from various message types
    let text = extractMessageText(msg);
    if (!text) return;

    // Initialize session
    if (!sessions[from]) {
        sessions[from] = createNewSession();
    }

    const session = sessions[from];
    console.log(`[${session.state}] From: ${from} | Text: "${text}"`);

    // ═══════════════════════════════════════════════════════════════
    // SMART MENU MAPPING (Middleware)
    // ═══════════════════════════════════════════════════════════════
    // If user sends a number/letter, check if it maps to a menu option
    if (session.menu_options && session.menu_options[text.toLowerCase()]) {
        const mappedAction = session.menu_options[text.toLowerCase()];
        console.log(`Mapped "${text}" to action: "${mappedAction}"`);
        text = mappedAction; // Override text with the action ID
    } else if (session.menu_options && !isNaN(text)) {
        // Handle numeric selection even if exact string match fails (e.g. "1" vs "1.")
        const num = parseInt(text).toString();
        if (session.menu_options[num]) {
            text = session.menu_options[num];
            console.log(`Mapped "${text}" (numeric) to action: "${text}"`);
        }
    }

    // Clear options after use (optional, but good for safety)
    // session.menu_options = null; 

    // ═══════════════════════════════════════════════════════════════
    // QR SCAN ENTRY: START|R=45|T=7
    // ═══════════════════════════════════════════════════════════════
    if (text.startsWith('START|')) {
        return await handleQRScan(sock, from, session, text);
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE MACHINE
    // ═══════════════════════════════════════════════════════════════
    try {
        switch (session.state) {
            case 'START':
                await handleStartState(sock, from, session, text);
                break;

            case 'SEARCH_RESTAURANT':
                await handleSearchState(sock, from, session, text);
                break;

            case 'PICK_TABLE':
            case 'TABLE_INPUT':
                await handleTableState(sock, from, session, text);
                break;

            case 'HOME':
                await handleHomeState(sock, from, session, text);
                break;

            case 'MENU_HUB':
                await handleMenuHubState(sock, from, session, text);
                break;

            case 'CATEGORIES':
                await handleCategoriesState(sock, from, session, text);
                break;

            case 'ITEMS_LIST':
                await handleItemsListState(sock, from, session, text);
                break;

            case 'ITEM_DETAIL':
                await handleItemDetailState(sock, from, session, text);
                break;

            case 'QUANTITY':
            case 'QUANTITY_MORE':
                await handleQuantityState(sock, from, session, text);
                break;

            case 'CART':
                await handleCartState(sock, from, session, text);
                break;

            case 'CART_EDIT':
                await handleCartEditState(sock, from, session, text);
                break;

            case 'CONFIRM_ORDER':
                await handleConfirmOrderState(sock, from, session, text);
                break;

            case 'PAYMENT_SUMMARY':
                await handlePaymentSummaryState(sock, from, session, text);
                break;

            case 'CASH_PAYMENT':
                await handleCashPaymentState(sock, from, session, text);
                break;

            case 'PROVIDER_SELECT':
                await handleProviderSelectState(sock, from, session, text);
                break;

            case 'USSD_NUMBER':
                await handleUssdNumberState(sock, from, session, text);
                break;

            case 'PAY_NOW':
                await handlePayNowState(sock, from, session, text);
                break;

            case 'USSD_PENDING':
                await handleUssdPendingState(sock, from, session, text);
                break;

            case 'MANUAL_USSD':
                await handleManualUssdState(sock, from, session, text);
                break;

            case 'TRACK_STATUS':
                await handleTrackStatusState(sock, from, session, text);
                break;

            case 'FEEDBACK':
            case 'FEEDBACK_B':
                await handleFeedbackState(sock, from, session, text);
                break;

            case 'FEEDBACK_COMMENT':
                await handleFeedbackCommentState(sock, from, session, text);
                break;

            case 'TIP':
                await handleTipState(sock, from, session, text);
                break;

            default:
                await sendText(sock, from, 'Samahani, sijakuelewa. Andika "Hi" kuanza upya.');
                session.state = 'START';
                break;
        }
    } catch (error) {
        console.error('Handler error:', error);
        await sendText(sock, from, '❌ Kuna tatizo la kiufundi. Jaribu tena.');
    }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE EXTRACTION
// ═══════════════════════════════════════════════════════════════
function extractMessageText(msg) {
    const m = msg.message;
    if (!m) return null;

    // Regular text
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;

    // Button response
    if (m.buttonsResponseMessage?.selectedButtonId) {
        return m.buttonsResponseMessage.selectedButtonId;
    }

    // List response
    if (m.listResponseMessage?.singleSelectReply?.selectedRowId) {
        return m.listResponseMessage.singleSelectReply.selectedRowId;
    }

    // Template button response
    if (m.templateButtonReplyMessage?.selectedId) {
        return m.templateButtonReplyMessage.selectedId;
    }

    // Interactive response (new format)
    if (m.interactiveResponseMessage) {
        const body = m.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson;
        if (body) {
            try {
                const parsed = JSON.parse(body);
                return parsed.id || parsed.flow_token;
            } catch (e) { }
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function createNewSession() {
    return {
        state: 'START',
        cart: [],
        restaurant_id: null,
        restaurant_name: null,
        table_number: null,
        active_order_id: null,
        order_total: 0,
        menu_cache: null,
        current_category: null,
        ussd_phone: null,
        ussd_provider: null,
        rating: null,
        pending_item: null,
        pending_qty: 1
    };
}

// ═══════════════════════════════════════════════════════════════
// QR SCAN HANDLER
// ═══════════════════════════════════════════════════════════════
async function handleQRScan(sock, from, session, text) {
    const parts = text.split('|');
    const rPart = parts.find(p => p.startsWith('R='));
    const tPart = parts.find(p => p.startsWith('T='));

    if (rPart) session.restaurant_id = rPart.split('=')[1];
    if (tPart) session.table_number = tPart.split('=')[1];

    if (session.restaurant_id) {
        try {
            const result = await api.verifyRestaurant(session.restaurant_id, session.table_number);
            if (result.success) {
                session.restaurant_name = result.data.name;
                return await showHomeScreen(sock, from, session);
            }
        } catch (error) {
            console.error('Verify restaurant error:', error);
        }
    }
    await sendText(sock, from, 'Tatizo la kusoma QR. Andika jina la restaurant kuendelea.');
    session.state = 'SEARCH_RESTAURANT';
}

// ═══════════════════════════════════════════════════════════════
// STATE HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleStartState(sock, from, session, text) {
    const greetings = ['hi', 'hello', 'mambo', 'habari', 'niaje', 'sasa', 'hujambo'];
    if (greetings.includes(text.toLowerCase())) {
        await sendText(sock, from,
            '🍽️ *Karibu TAPTAP!*\n\n' +
            'Mfumo wa kuagiza chakula kupitia WhatsApp.\n\n' +
            'Andika jina la restaurant unayotaka au scan QR code iliyopo mezani.'
        );
        session.state = 'SEARCH_RESTAURANT';
    } else {
        await handleSearchRestaurant(sock, from, session, text);
    }
}

async function handleSearchState(sock, from, session, text) {
    // Handle numbered selection
    const selection = parseInt(text);
    if (!isNaN(selection) && session.search_results) {
        if (selection === 0) {
            await sendText(sock, from, 'Andika jina la restaurant:');
            return;
        }

        const restaurant = session.search_results[selection - 1];
        if (restaurant) {
            session.restaurant_id = restaurant.id;
            session.restaurant_name = restaurant.name;

            if (!session.table_number) {
                await showTableSelection(sock, from, session);
                session.state = 'PICK_TABLE';
            } else {
                await showHomeScreen(sock, from, session);
            }
            return;
        }
    }

    if (text.startsWith('pick_rest_')) {
        session.restaurant_id = text.replace('pick_rest_', '');
        try {
            const result = await api.verifyRestaurant(session.restaurant_id, null);
            if (result.success) session.restaurant_name = result.data.name;
        } catch (e) { }

        if (!session.table_number) {
            await showTableSelection(sock, from, session);
            session.state = 'PICK_TABLE';
        } else {
            await showHomeScreen(sock, from, session);
        }
    } else if (text === 'search_again') {
        await sendText(sock, from, 'Andika jina la restaurant:');
    } else {
        await handleSearchRestaurant(sock, from, session, text);
    }
}

async function handleTableState(sock, from, session, text) {
    if (text.startsWith('table_')) {
        const val = text.replace('table_', '');
        if (val === 'type') {
            session.state = 'TABLE_INPUT';
            await sendText(sock, from, 'Andika namba ya meza (mfano: 7):');
        } else {
            session.table_number = val;
            await showHomeScreen(sock, from, session);
        }
    } else if (!isNaN(text) && parseInt(text) > 0) {
        session.table_number = text;
        await showHomeScreen(sock, from, session);
    } else {
        await sendText(sock, from, 'Tafadhali andika namba sahihi ya meza.');
    }
}

async function handleHomeState(sock, from, session, text) {
    const t = text.toLowerCase();
    if (t === 'go_menu' || t.includes('menu') || t.includes('chakula')) {
        await showMenuHub(sock, from, session);
    } else if (t === 'go_cart' || t.includes('cart') || t.includes('oda')) {
        await showCart(sock, from, session);
    } else if (t === 'go_payment' || t.includes('lipa') || t.includes('malipo')) {
        await showPaymentSummary(sock, from, session);
    } else if (t === 'track_order' || t.includes('track')) {
        await showTrackStatus(sock, from, session);
    } else if (t === 'go_feedback' || t.includes('feedback')) {
        await showFeedbackA(sock, from, session);
    } else {
        await showHomeScreen(sock, from, session);
    }
}

async function handleMenuHubState(sock, from, session, text) {
    const t = text.toLowerCase();
    if (text.startsWith('cat_')) {
        const categoryId = text.replace('cat_', '');
        session.current_category = categoryId;
        await showItemsList(sock, from, session, categoryId);
    } else if (t.includes('chakula') || t.includes('vinywaji') || t.includes('drink') || t.includes('zaidi')) {
        await showMenuHub(sock, from, session);
    } else if (t === 'home' || t.includes('home') || t.includes('nyuma')) {
        await showHomeScreen(sock, from, session);
    } else {
        await showMenuHub(sock, from, session);
    }
}

async function showCategoriesList(sock, from, session, type) {
    session.state = 'CATEGORIES';

    try {
        if (!session.menu_cache) {
            const result = await api.getFullMenu(session.restaurant_id);
            if (result.success) {
                session.menu_cache = result.data;
            }
        }

        if (session.menu_cache && session.menu_cache.length > 0) {
            const rows = session.menu_cache.map(c => ({
                id: `cat_${c.id}`,
                title: c.name,
                description: `${c.menu_items?.length || 0} items`
            }));

            rows.push({ id: 'home', title: '🏠 Home', description: '' });

            await sendList(sock, from,
                '📂 *Chagua Category*',
                'Ona Categories',
                [{ title: 'Categories', rows }]
            );
        } else {
            await sendText(sock, from, 'Samahani, menu haipatikani.');
            await showHomeScreen(sock, from, session);
        }
    } catch (e) {
        console.error('Fetch categories error:', e);
        await showHomeScreen(sock, from, session);
    }
}

async function handleCategoriesState(sock, from, session, text) {
    if (text.startsWith('cat_')) {
        const categoryId = text.replace('cat_', '');
        session.current_category = categoryId;
        await showItemsList(sock, from, session, categoryId);
    } else if (text === 'back_menu') {
        await showMenuHub(sock, from, session);
    } else if (text === 'home') {
        await showHomeScreen(sock, from, session);
    }
}

async function handleItemsListState(sock, from, session, text) {
    if (text.startsWith('item_')) {
        const itemId = text.replace('item_', '');
        await showItemDetail(sock, from, session, itemId);
    } else if (text === 'back_categories') {
        await showCategoriesList(sock, from, session, session.current_category_type);
    } else if (text === 'home') {
        await showHomeScreen(sock, from, session);
    }
}

async function handleItemDetailState(sock, from, session, text) {
    if (text.startsWith('add_')) {
        const itemId = text.replace('add_', '');
        session.pending_item = itemId;
        session.pending_qty = 1;
        await showQuantitySelection(sock, from, session, itemId);
        session.state = 'QUANTITY';
    } else if (text === 'back_items') {
        await showItemsList(sock, from, session, session.current_category);
    } else if (text === 'go_cart') {
        await showCart(sock, from, session);
    } else if (text === 'home') {
        await showHomeScreen(sock, from, session);
    }
}

async function handleQuantityState(sock, from, session, text) {
    if (text.startsWith('qty_')) {
        const parts = text.split('_');
        if (parts[1] === 'plus') {
            session.pending_qty++;
            await showQuantityMore(sock, from, session);
        } else if (parts[1] === 'minus') {
            session.pending_qty = Math.max(1, session.pending_qty - 1);
            await showQuantityMore(sock, from, session);
        } else if (parts[1] === 'done') {
            await addToCart(sock, from, session, session.pending_item, session.pending_qty);
        } else {
            const qty = parseInt(parts[1]);
            if (qty <= 3) {
                await addToCart(sock, from, session, session.pending_item, qty);
            } else {
                session.pending_qty = 3;
                session.state = 'QUANTITY_MORE';
                await showQuantityMore(sock, from, session);
            }
        }
    } else if (text === 'qty_more') {
        session.pending_qty = 3;
        session.state = 'QUANTITY_MORE';
        await showQuantityMore(sock, from, session);
    }
}

async function handleCartState(sock, from, session, text) {
    switch (text) {
        case 'confirm_order':
            await showConfirmOrder(sock, from, session);
            break;
        case 'edit_cart':
            await showCartEdit(sock, from, session);
            break;
        case 'clear_cart':
            session.cart = [];
            await sendText(sock, from, '🗑️ Cart imefutwa.');
            await showHomeScreen(sock, from, session);
            break;
        case 'home':
            await showHomeScreen(sock, from, session);
            break;
        case 'continue_menu':
            await showMenuHub(sock, from, session);
            break;
    }
}

async function handleCartEditState(sock, from, session, text) {
    if (text.startsWith('remove_')) {
        const idx = parseInt(text.replace('remove_', ''));
        if (session.cart[idx]) {
            const removed = session.cart.splice(idx, 1)[0];
            await sendText(sock, from, `❌ ${removed.name} imeondolewa.`);
        }
        await showCart(sock, from, session);
    } else if (text === 'back_cart') {
        await showCart(sock, from, session);
    }
}

async function handleConfirmOrderState(sock, from, session, text) {
    switch (text) {
        case 'confirm_yes':
            await createOrder(sock, from, session);
            break;
        case 'back_cart':
            await showCart(sock, from, session);
            break;
        case 'cancel_order':
            session.cart = [];
            await sendText(sock, from, '❌ Oda imeghairiwa.');
            await showHomeScreen(sock, from, session);
            break;
    }
}

async function handlePaymentSummaryState(sock, from, session, text) {
    switch (text) {
        case 'pay_cash':
            await showCashPayment(sock, from, session);
            break;
        case 'pay_mobile':
            await showProviderSelect(sock, from, session);
            break;
        case 'home':
            await showHomeScreen(sock, from, session);
            break;
    }
}

async function handleCashPaymentState(sock, from, session, text) {
    switch (text) {
        case 'cash_paid':
            await sendText(sock, from,
                '✅ Asante!\n\nTunasubiri waiter athibitishe malipo...'
            );
            await showPostPaymentOptions(sock, from, session);
            break;
        case 'track_order':
            await showTrackStatus(sock, from, session);
            break;
        case 'home':
            await showHomeScreen(sock, from, session);
            break;
    }
}

async function handleProviderSelectState(sock, from, session, text) {
    if (text.startsWith('provider_')) {
        session.ussd_provider = text.replace('provider_', '');
        session.state = 'USSD_NUMBER';
        await sendText(sock, from,
            '📱 Andika namba ya simu ya Mobile Money\n' +
            'Mfano: 0712345678 au 255712345678'
        );
    } else if (text === 'back_payment') {
        await showPaymentSummary(sock, from, session);
    }
}

async function handleUssdNumberState(sock, from, session, text) {
    // Validate phone number
    if (/^(0\d{9}|255\d{9})$/.test(text)) {
        session.ussd_phone = text.startsWith('0') ? '255' + text.slice(1) : text;
        await showPayNow(sock, from, session);
    } else {
        await sendText(sock, from, '❌ Namba si sahihi. Andika kama 0712345678 au 255712345678');
    }
}

async function handlePayNowState(sock, from, session, text) {
    switch (text) {
        case 'paynow':
            await initiateUssdPayment(sock, from, session);
            break;
        case 'change_number':
            session.state = 'USSD_NUMBER';
            await sendText(sock, from, 'Andika namba mpya ya simu:');
            break;
        case 'back_provider':
            await showProviderSelect(sock, from, session);
            break;
    }
}

async function handleUssdPendingState(sock, from, session, text) {
    switch (text) {
        case 'check_status':
            await checkPaymentStatus(sock, from, session);
            break;
        case 'cancel_payment':
            await showPaymentSummary(sock, from, session);
            break;
        case 'manual_ussd':
            await showManualUssd(sock, from, session);
            break;
        case 'home':
            await showHomeScreen(sock, from, session);
            break;
    }
}

async function handleManualUssdState(sock, from, session, text) {
    if (text === 'manual_paid') {
        session.state = 'USSD_PENDING';
        await sendText(sock, from, 'Andika Transaction ID (mfano: MPESA123XYZ):');
    } else if (text === 'pay_cash') {
        await showCashPayment(sock, from, session);
    } else if (text === 'home') {
        await showHomeScreen(sock, from, session);
    } else {
        // Assume it's a transaction ID
        session.transaction_id = text;
        await sendText(sock, from, '✅ Tumepokea Transaction ID.\nTunasubiri uthibitisho...');
        await showPostPaymentOptions(sock, from, session);
    }
}

async function handleTrackStatusState(sock, from, session, text) {
    switch (text) {
        case 'refresh':
            await showTrackStatus(sock, from, session);
            break;
        case 'go_payment':
            await showPaymentSummary(sock, from, session);
            break;
        case 'home':
            await showHomeScreen(sock, from, session);
            break;
    }
}

async function handleFeedbackState(sock, from, session, text) {
    if (text.startsWith('rate_')) {
        const rating = text.replace('rate_', '');
        if (rating === 'next') {
            await showFeedbackB(sock, from, session);
        } else {
            session.rating = parseInt(rating);
            session.state = 'FEEDBACK_COMMENT';
            await sendText(sock, from,
                '📝 Una maoni yoyote?\n\n(Andika maoni au "skip" kuendelea)'
            );
        }
    }
}

async function handleFeedbackCommentState(sock, from, session, text) {
    const comment = text.toLowerCase() === 'skip' ? '' : text;

    try {
        await api.submitFeedback({
            restaurant_id: session.restaurant_id,
            customer_phone: from.split('@')[0],
            rating: session.rating,
            comment: comment
        });
    } catch (e) {
        console.error('Feedback error:', e);
    }

    await sendText(sock, from, '🙏 Asante kwa maoni yako!');
    await showTipScreen(sock, from, session);
}

async function handleTipState(sock, from, session, text) {
    if (text.startsWith('tip_')) {
        const amount = text.replace('tip_', '');
        if (amount !== 'skip') {
            try {
                await api.submitTip({
                    order_id: session.active_order_id,
                    amount: parseInt(amount)
                });
                await sendText(sock, from, `💝 Asante kwa tip ya Tsh ${amount}!`);
            } catch (e) {
                console.error('Tip error:', e);
            }
        }

        await sendText(sock, from,
            '🎉 Asante kwa kutumia TAPTAP!\n\nKaribu tena! 👋'
        );
        await showHomeScreen(sock, from, session);
    }
}

// ═══════════════════════════════════════════════════════════════
// SCREEN BUILDERS
// ═══════════════════════════════════════════════════════════════

async function showHomeScreen(sock, from, session) {
    session.state = 'HOME';
    const name = session.restaurant_name || 'Restaurant';
    const table = session.table_number || '-';
    const cartCount = session.cart.length;

    await sendButtons(sock, from,
        `🍽️ *Karibu ${name}!*\n` +
        `📍 Meza: ${table}\n\n` +
        `Chagua unachotaka kufanya:`,
        [
            { id: 'go_menu', text: '🍽️ Menu' },
            { id: 'go_cart', text: `🛒 Cart (${cartCount})` },
            { id: 'go_payment', text: '💳 Lipa' },
            { id: 'track_order', text: '📍 Track Order' },
            { id: 'go_feedback', text: '📝 Maoni' }
        ]
    );
}

async function showTableSelection(sock, from, session) {
    try {
        // Try to get tables using the bot-specific endpoint first
        const result = await api.getRestaurantTables(session.restaurant_id);
        if (result.success && result.data.length > 0) {
            const buttons = result.data.map(t => ({
                id: `table_${t.id}`,
                text: `Meza ${t.name} (Watu ${t.capacity})`
            })).slice(0, 3); // Max 3 buttons

            await sendButtons(sock, from, 'Chagua Meza yako:', buttons);
        } else {
            await sendText(sock, from, 'Tafadhali andika namba ya meza uliyokaa (mfano: 7):');
        }
    } catch (e) {
        console.error('Fetch tables error:', e);
        await sendText(sock, from, 'Tafadhali andika namba ya meza uliyokaa (mfano: 7):');
    }
}

async function showMenuHub(sock, from, session) {
    session.state = 'MENU_HUB';

    try {
        // Use the bot-specific full-menu endpoint instead of manager categories
        if (!session.menu_cache) {
            const result = await api.getFullMenu(session.restaurant_id);
            if (result.success) {
                session.menu_cache = result.data;
            }
        }

        if (session.menu_cache && session.menu_cache.length > 0) {
            const buttons = session.menu_cache.map(c => ({
                id: `cat_${c.id}`,
                text: c.name
            })).slice(0, 2); // Max 3 buttons total (2 cats + 1 home)

            buttons.push({ id: 'home', text: '🏠 Home' });
            await sendButtons(sock, from, '🍽️ *Menu*\n\nChagua kundi la chakula:', buttons);
        } else {
            await sendText(sock, from, 'Samahani, menu haipatikani kwa sasa.');
            await showHomeScreen(sock, from, session);
        }
    } catch (e) {
        console.error('Fetch menu error:', e);
        await sendText(sock, from, 'Tatizo la kupata menu. Jaribu tena baadae.');
    }
}

async function showItemsList(sock, from, session, categoryId) {
    session.state = 'ITEMS_LIST';
    session.current_category = categoryId;

    // Find category in cache
    const category = (session.menu_cache || []).find(c => c.id == categoryId);

    if (category && category.menu_items && category.menu_items.length > 0) {
        // Flatten items for showItemDetail to find them easily
        if (!session.menu_items_cache) session.menu_items_cache = [];
        category.menu_items.forEach(item => {
            if (!session.menu_items_cache.find(i => i.id == item.id)) {
                session.menu_items_cache.push(item);
            }
        });

        const buttons = category.menu_items.map(i => ({
            id: `item_${i.id}`,
            text: `${i.name} - Tsh ${i.price.toLocaleString()}`
        })).slice(0, 2); // Max 3 buttons

        buttons.push({ id: 'back_menu', text: '🔙 Rudi' });

        await sendButtons(sock, from, `🍽️ *${category.name}*\n\nChagua chakula:`, buttons);
    } else {
        await sendText(sock, from, 'Hakuna vyakula kwenye kundi hili.');
        await showMenuHub(sock, from, session);
    }
}

async function showItemDetail(sock, from, session, itemId) {
    session.state = 'ITEM_DETAIL';
    session.pending_item = itemId;

    // Find item from cache
    const item = (session.menu_items_cache || []).find(i => i.id == itemId);

    if (!item) {
        await sendText(sock, from, 'Sijapata chakula hiki.');
        return await showMenuHub(sock, from, session);
    }

    const text =
        `*${item.name}* 🔥\n\n` +
        `💰 Bei: Tsh ${item.price?.toLocaleString() || 0}\n` +
        `${item.description ? `📝 ${item.description}\n` : ''}` +
        `⏱️ Muda: Dakika 10-15`;

    const buttons = [
        { id: `add_${itemId}`, text: '➕ Ongeza' },
        { id: 'back_items', text: '� Rudi' },
        { id: 'go_cart', text: '🛒 Cart' }
    ];

    if (item.image) {
        await sendImageWithButtons(sock, from, item.image, text, buttons);
    } else {
        await sendButtons(sock, from, text, buttons);
    }
}

async function showQuantitySelection(sock, from, session, itemId) {
    await sendButtons(sock, from,
        '�🔢 *Chagua idadi:*',
        [
            { id: 'qty_1', text: '1️⃣' },
            { id: 'qty_2', text: '2️⃣' },
            { id: 'qty_more', text: '➕ Zaidi' }
        ]
    );
}

async function showQuantityMore(sock, from, session) {
    await sendButtons(sock, from,
        `🔢 Idadi: *${session.pending_qty}*`,
        [
            { id: 'qty_plus', text: '➕ +1' },
            { id: 'qty_minus', text: '➖ -1' },
            { id: 'qty_done', text: '✅ Sawa' }
        ]
    );
}

async function addToCart(sock, from, session, itemId, qty) {
    // Find item
    let item = null;
    const cache = session.menu_items_cache || [];
    item = cache.find(i => i.id == itemId);

    if (!item) return;

    // Add or update cart
    const existing = session.cart.find(c => c.menu_id == itemId);
    if (existing) {
        existing.qty += qty;
    } else {
        session.cart.push({
            menu_id: itemId,
            name: item.name,
            price: item.price,
            qty: qty
        });
    }

    const total = session.cart.reduce((sum, i) => sum + (i.price * i.qty), 0);

    await sendButtons(sock, from,
        `✅ *Imeongezwa!*\n\n` +
        `${item.name} x${qty}\n` +
        `Jumla ya sasa: Tsh ${total.toLocaleString()}`,
        [
            { id: 'continue_menu', text: '➕ Endelea Menu' },
            { id: 'go_cart', text: '🛒 Nenda Cart' },
            { id: 'home', text: '🏠 Home' }
        ]
    );
    session.state = 'CART';
}

async function showCart(sock, from, session) {
    session.state = 'CART';

    if (session.cart.length === 0) {
        await sendButtons(sock, from,
            '🛒 *Cart yako ni tupu*\n\nNenda menu kuagiza chakula.',
            [
                { id: 'go_menu', text: '🍽️ Menu' },
                { id: 'home', text: '🏠 Home' }
            ]
        );
        return;
    }

    let text = '🛒 *Cart yako*\n\n';
    let total = 0;
    session.cart.forEach((item, i) => {
        const subtotal = item.price * item.qty;
        text += `${i + 1}. ${item.name} x${item.qty} = Tsh ${subtotal.toLocaleString()}\n`;
        total += subtotal;
    });
    text += `\n💰 *Jumla: Tsh ${total.toLocaleString()}*`;
    session.order_total = total;

    await sendButtons(sock, from, text, [
        { id: 'confirm_order', text: '✅ Thibitisha' },
        { id: 'edit_cart', text: '✏️ Badili' },
        { id: 'home', text: '🏠 Home' }
    ]);
}

async function showCartEdit(sock, from, session) {
    session.state = 'CART_EDIT';

    const rows = session.cart.map((item, i) => ({
        id: `remove_${i}`,
        title: `❌ ${item.name}`,
        description: `x${item.qty} - Tsh ${(item.price * item.qty).toLocaleString()}`
    }));

    rows.push({ id: 'back_cart', title: '🔙 Rudi Cart', description: '' });

    await sendList(sock, from,
        '✏️ *Badili Cart*\n\nChagua item kuiondoa:',
        'Ona Items',
        [{ title: 'Cart Items', rows }]
    );
}

async function showConfirmOrder(sock, from, session) {
    session.state = 'CONFIRM_ORDER';

    let text = '🧾 *Thibitisha Oda*\n\n';
    text += `📍 Meza: ${session.table_number}\n\n`;

    session.cart.forEach((item, i) => {
        text += `${item.name} x${item.qty}\n`;
    });

    text += `\n💰 *Jumla: Tsh ${session.order_total.toLocaleString()}*`;

    await sendButtons(sock, from, text, [
        { id: 'confirm_yes', text: '✅ Thibitisha' },
        { id: 'back_cart', text: '🔙 Rudi Cart' },
        { id: 'cancel_order', text: '❌ Ghairi' }
    ]);
}

async function createOrder(sock, from, session) {
    try {
        const result = await api.createOrder({
            restaurant_id: session.restaurant_id,
            table_number: session.table_number,
            customer_phone: from.split('@')[0],
            items: session.cart
        });

        if (result.success) {
            session.active_order_id = result.order_id;
            session.order_total = result.total;
            session.cart = [];

            await sendButtons(sock, from,
                `✅ *Oda Imepokelewa!*\n\n` +
                `🧾 Order #${result.order_id}\n` +
                `💰 Jumla: Tsh ${result.total.toLocaleString()}\n\n` +
                `Waiter anakuja hivi punde...`,
                [
                    { id: 'go_payment', text: '💳 Lipa Sasa' },
                    { id: 'track_order', text: '📍 Track' },
                    { id: 'home', text: '🏠 Home' }
                ]
            );
            session.state = 'HOME';
        }
    } catch (error) {
        console.error('Create order error:', error);
        await sendText(sock, from, '❌ Tatizo la kutuma oda. Jaribu tena.');
    }
}

async function showPaymentSummary(sock, from, session) {
    session.state = 'PAYMENT_SUMMARY';

    if (!session.active_order_id) {
        await sendText(sock, from, 'Huna oda ya kulipa. Agiza kwanza.');
        return await showHomeScreen(sock, from, session);
    }

    // Build bill text
    let text = '🧾 *Bili yako*\n\n';
    text += `📋 Order #${session.active_order_id}\n`;
    text += `📍 Meza: ${session.table_number}\n\n`;
    text += `💰 *Jumla: Tsh ${session.order_total?.toLocaleString() || 0}*\n\n`;
    text += 'Chagua njia ya malipo:';

    await sendButtons(sock, from, text, [
        { id: 'pay_cash', text: '💵 Cash' },
        { id: 'pay_mobile', text: '📲 Mobile Money' },
        { id: 'home', text: '🏠 Home' }
    ]);
}

async function showCashPayment(sock, from, session) {
    session.state = 'CASH_PAYMENT';

    await sendButtons(sock, from,
        '💵 *Umechagua CASH*\n\n' +
        'Tafadhali mpe waiter pesa mezani.\n' +
        'Ukishalipa, bonyeza "NIMELIPA".',
        [
            { id: 'cash_paid', text: '✅ NIMELIPA' },
            { id: 'track_order', text: '📍 Track' },
            { id: 'home', text: '🏠 Home' }
        ]
    );
}

async function showProviderSelect(sock, from, session) {
    session.state = 'PROVIDER_SELECT';

    const rows = [
        { id: 'provider_mpesa', title: 'M-Pesa', description: 'Vodacom M-Pesa' },
        { id: 'provider_tigopesa', title: 'Tigo Pesa', description: 'Tigo Mobile Money' },
        { id: 'provider_airtelmoney', title: 'Airtel Money', description: 'Airtel Mobile Money' },
        { id: 'provider_halopesa', title: 'HaloPesa', description: 'Halotel HaloPesa' },
        { id: 'back_payment', title: '🔙 Rudi', description: 'Rudi nyuma' }
    ];

    await sendList(sock, from,
        '📲 *Mobile Money*\n\nChagua mtandao wako:',
        'Chagua Mtandao',
        [{ title: 'Mitandao', rows }]
    );
}

async function showPayNow(sock, from, session) {
    session.state = 'PAY_NOW';

    await sendButtons(sock, from,
        `📲 *Lipa Sasa*\n\n` +
        `💰 Jumla: Tsh ${session.order_total?.toLocaleString() || 0}\n` +
        `📱 Namba: ${session.ussd_phone}\n\n` +
        `Bonyeza "PAY NOW" kutuma ombi.`,
        [
            { id: 'paynow', text: '✅ PAY NOW' },
            { id: 'change_number', text: '✍️ Badilisha' },
            { id: 'back_provider', text: '⬅️ Rudi' }
        ]
    );
}

async function initiateUssdPayment(sock, from, session) {
    try {
        const result = await api.initiateUssdPayment({
            order_id: session.active_order_id,
            phone: session.ussd_phone,
            amount: session.order_total,
            provider: session.ussd_provider
        });

        if (result.success) {
            session.state = 'USSD_PENDING';
            await sendButtons(sock, from,
                '📲 *Ombi Limetumwa!*\n\n' +
                `Fungua USSD/Prompt kwenye simu ${session.ussd_phone} u-confirm malipo.\n\n` +
                'Ukimaliza, bonyeza "CHECK STATUS".',
                [
                    { id: 'check_status', text: '🔄 CHECK STATUS' },
                    { id: 'manual_ussd', text: '📟 Manual' },
                    { id: 'home', text: '🏠 Home' }
                ]
            );
        }
    } catch (error) {
        console.error('USSD error:', error);
        await sendButtons(sock, from,
            '❌ *Tatizo la kutuma USSD*\n\n' +
            'Jaribu tena au tumia njia nyingine.',
            [
                { id: 'paynow', text: '🔁 Jaribu Tena' },
                { id: 'manual_ussd', text: '📟 Manual USSD' },
                { id: 'pay_cash', text: '💵 Cash' }
            ]
        );
        session.state = 'PAY_NOW';
    }
}

async function checkPaymentStatus(sock, from, session) {
    try {
        const result = await api.getOrderStatus(session.active_order_id);

        if (result.payment_status === 'paid') {
            await sendButtons(sock, from,
                '✅ *Malipo Yamethibitishwa!*\n\n' +
                'Asante kwa kulipa. 🙏',
                [
                    { id: 'go_feedback', text: '💬 Feedback' },
                    { id: 'home', text: '🏠 Home' }
                ]
            );
            session.state = 'HOME';
        } else if (result.payment_status === 'failed') {
            await sendButtons(sock, from,
                '❌ *Malipo Yameshindwa*\n\n' +
                'Jaribu tena au chagua njia nyingine.',
                [
                    { id: 'paynow', text: '🔁 Jaribu Tena' },
                    { id: 'pay_cash', text: '💵 Cash' },
                    { id: 'home', text: '🏠 Home' }
                ]
            );
            session.state = 'PAY_NOW';
        } else {
            await sendButtons(sock, from,
                '⏳ *Bado Tunasubiri*\n\n' +
                'Kama huja-confirm kwenye simu, kagua USSD/Prompt.',
                [
                    { id: 'check_status', text: '🔄 Check Tena' },
                    { id: 'manual_ussd', text: '📟 Manual' },
                    { id: 'home', text: '🏠 Home' }
                ]
            );
        }
    } catch (error) {
        console.error('Check payment error:', error);
    }
}

async function showManualUssd(sock, from, session) {
    session.state = 'MANUAL_USSD';

    await sendButtons(sock, from,
        '📟 *Manual USSD*\n\n' +
        'Fuata hatua hizi kulipa:\n' +
        '1) Piga *150*00# (mfano)\n' +
        '2) Chagua "Lipa bili"\n' +
        '3) Ingiza Namba: 123456\n' +
        '4) Kiasi: ' + session.order_total?.toLocaleString() + '\n' +
        '5) Thibitisha\n\n' +
        'Ukimaliza, bonyeza "NIMELIPA":',
        [
            { id: 'manual_paid', text: '✅ NIMELIPA' },
            { id: 'pay_cash', text: '💵 Cash' },
            { id: 'home', text: '🏠 Home' }
        ]
    );
}

async function showPostPaymentOptions(sock, from, session) {
    session.state = 'HOME';
    await sendButtons(sock, from,
        '✅ Tumeona request yako.\n\nNini kingine?',
        [
            { id: 'go_feedback', text: '💬 Feedback' },
            { id: 'track_order', text: '📍 Track' },
            { id: 'home', text: '🏠 Home' }
        ]
    );
}

async function showTrackStatus(sock, from, session) {
    session.state = 'TRACK_STATUS';

    if (!session.active_order_id) {
        await sendText(sock, from, 'Huna oda yoyote.');
        return await showHomeScreen(sock, from, session);
    }

    try {
        const result = await api.getOrderStatus(session.active_order_id);

        const statusIcons = {
            'pending': '⏳ Inasubiri',
            'confirmed': '✅ Imethibitishwa',
            'preparing': '👨‍🍳 Inapikwa',
            'ready': '🍽️ Tayari',
            'served': '✅ Imehudumiwa',
            'paid': '💰 Imelipwa'
        };

        await sendButtons(sock, from,
            `📍 *Oda #${session.active_order_id}*\n\n` +
            `Status: ${statusIcons[result.status] || result.status}\n` +
            `Malipo: ${result.payment_status}\n` +
            `Jumla: Tsh ${result.total?.toLocaleString() || session.order_total}`,
            [
                { id: 'refresh', text: '🔄 Refresh' },
                { id: 'go_payment', text: '💳 Lipa' },
                { id: 'home', text: '🏠 Home' }
            ]
        );
    } catch (error) {
        console.error('Track status error:', error);
        await sendText(sock, from, '❌ Tatizo la kupata status.');
    }
}

async function showFeedbackA(sock, from, session) {
    session.state = 'FEEDBACK';

    await sendButtons(sock, from,
        '⭐ *Rating*\n\nTafadhali toa rating ya huduma yetu:',
        [
            { id: 'rate_1', text: '⭐ 1' },
            { id: 'rate_2', text: '⭐⭐ 2' },
            { id: 'rate_next', text: '➡️ Zaidi' }
        ]
    );
}

async function showFeedbackB(sock, from, session) {
    session.state = 'FEEDBACK_B';

    await sendButtons(sock, from,
        '⭐ *Rating*\n\nChagua rating:',
        [
            { id: 'rate_3', text: '⭐⭐⭐ 3' },
            { id: 'rate_4', text: '⭐⭐⭐⭐ 4' },
            { id: 'rate_5', text: '⭐⭐⭐⭐⭐ 5' }
        ]
    );
}

async function showTipScreen(sock, from, session) {
    session.state = 'TIP';

    await sendButtons(sock, from,
        '💝 *Tip*\n\nUngependa kutoa tip kwa waiter?',
        [
            { id: 'tip_500', text: 'Tsh 500' },
            { id: 'tip_1000', text: 'Tsh 1,000' },
            { id: 'tip_skip', text: 'Skip' }
        ]
    );
}

async function handleSearchRestaurant(sock, from, session, query) {
    try {
        console.log(`Searching for: "${query}"`);
        const result = await api.searchRestaurant(query);
        console.log('API Result:', JSON.stringify(result));

        if (result.success && result.data?.length > 0) {
            const restaurants = result.data.slice(0, 5); // Max 5 options

            // Store results in session for numbered selection
            session.search_results = restaurants;

            // Build text message with numbered options
            let text = `🔍 *Nimeona restaurants ${result.count}*\n\nChagua kwa kuandika namba:\n\n`;
            restaurants.forEach((r, i) => {
                text += `${i + 1}. 🏠 ${r.name}\n   📍 ${r.location || 'Tanzania'}\n\n`;
            });
            text += `0. 🔎 Tafuta tena`;

            await sendText(sock, from, text);
            session.state = 'SEARCH_RESTAURANT';
        } else {
            await sendText(sock, from, 'Samahani, sijaipata restaurant hiyo. Jaribu jina lingine.');
        }
    } catch (error) {
        console.error('Search error:', error.message);
        await sendText(sock, from, '❌ Tatizo la kutafuta. Jaribu tena.');
    }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE SENDERS
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// MESSAGE SENDERS (TEXT MENU SYSTEM)
// ═══════════════════════════════════════════════════════════════

async function sendText(sock, from, text) {
    await sock.sendMessage(from, { text });
}

/**
 * Sends a text-based menu with numbered options.
 * Automatically maps options to session.menu_options for easy handling.
 */
async function sendButtons(sock, from, text, buttons) {
    const session = sessions[from];
    session.menu_options = {}; // Reset options

    let menuText = text + '\n\n';

    buttons.forEach((b, i) => {
        const key = (i + 1).toString();
        // Add emoji based on text content if not present
        let label = b.text;

        // Store mapping
        session.menu_options[key] = b.id;

        // Format line: 1️⃣ Option
        const emojiKey = getNumberEmoji(i + 1);
        menuText += `${emojiKey} ${label}\n`;
    });

    // Add generic instructions
    menuText += '\n_(Chagua namba)_';

    await sock.sendMessage(from, { text: menuText });
}

/**
 * Sends a list as a text menu.
 */
async function sendList(sock, from, text, buttonText, sections) {
    const session = sessions[from];
    session.menu_options = {}; // Reset options

    let menuText = text + '\n\n';
    let counter = 1;

    sections.forEach(section => {
        if (section.title) menuText += `*${section.title.toUpperCase()}*\n`;

        section.rows.forEach(row => {
            const key = counter.toString();
            session.menu_options[key] = row.id;

            menuText += `${key}. ${row.title}`;
            if (row.description) menuText += ` - ${row.description}`;
            menuText += '\n';
            counter++;
        });
        menuText += '\n';
    });

    menuText += '_(Andika namba kuchagua)_';

    await sock.sendMessage(from, { text: menuText });
}

async function sendImageWithButtons(sock, from, imageUrl, caption, buttons) {
    // Send image first
    try {
        await sock.sendMessage(from, {
            image: { url: imageUrl },
            caption: caption
        });
    } catch (e) {
        await sendText(sock, from, caption);
    }

    // Then send the menu options as text
    await sendButtons(sock, from, 'Chagua:', buttons);
}

function getNumberEmoji(num) {
    const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[num] || `${num}.`;
}

module.exports = { handleMessage };
