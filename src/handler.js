const api = require('./api');

const sessions = {};

// ═══════════════════════════════════════════════════════════════
// MAIN MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════
async function handleMessage(sock, msg) {
    const from = msg.key.remoteJid;

    if (from.endsWith('@g.us') || from === 'status@broadcast') {
        return;
    }

    let text = extractMessageText(msg);
    if (!text) return;

    if (!sessions[from]) {
        sessions[from] = createNewSession();
    }

    const session = sessions[from];
    if (msg.pushName) session.customer_name = msg.pushName;
    console.log(`📩 [${session.state}] From: ${from} | Text: "${text}"`);

    // ═══════════════════════════════════════════════════════════════
    // SMART MENU MAPPING (Middleware)
    // ═══════════════════════════════════════════════════════════════
    if (session.menu_options && session.menu_options[text.toLowerCase()]) {
        const mappedAction = session.menu_options[text.toLowerCase()];
        text = mappedAction;
    } else if (session.menu_options && !isNaN(text)) {
        const num = parseInt(text).toString();
        if (session.menu_options[num]) {
            text = session.menu_options[num];
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // GLOBAL COMMANDS
    // ═══════════════════════════════════════════════════════════════
    if (text.toLowerCase() === '!waiter') {
        if (session.waiter_name) {
            await sendText(sock, from, `You are being served by ${session.waiter_name} (Active).`);
        } else {
            await sendText(sock, from, 'You are not assigned to any waiter yet.');
        }
        return;
    }

    if (text.toLowerCase() === '!status' || text.toLowerCase() === 'status') {
        if (session.restaurant_id && session.table_number) {
            return await showTrackStatus(sock, from, session);
        } else {
            await sendText(sock, from, 'Please scan a QR code or search for a restaurant first.');
            return;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ENTRY POINT: QR CODES & TAGS (Unified)
    // ═══════════════════════════════════════════════════════════════
    // Check for START command or Tag format (e.g., SMK-W01)
    const isTag = /^[A-Z0-9]+-[A-Z0-9]+$/i.test(text);
    if (text.startsWith('START|') || text.startsWith('START_') || isTag) {
        return await handleEntry(sock, from, session, text);
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

            case 'FEEDBACK_TYPE':
            case 'FEEDBACK_WAITER_LIST':
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

            case 'CALL_WAITER':
                await handleCallWaiterState(sock, from, session, text);
                break;

            case 'WAITERS_LIST':
                await handleWaitersListState(sock, from, session, text);
                break;

            case 'MENU_SELECTION':
                await handleMenuSelectionState(sock, from, session, text);
                break;

            case 'MENU_IMAGE_ORDER':
                await handleMenuImageOrderState(sock, from, session, text);
                break;

            case 'QUICK_PAYMENT_AMOUNT':
                await handleQuickPaymentAmountState(sock, from, session, text);
                break;

            case 'QUICK_PAYMENT_PHONE':
                await handleQuickPaymentPhoneState(sock, from, session, text);
                break;

            case 'QUICK_PAYMENT_NETWORK':
                await handleQuickPaymentNetworkState(sock, from, session, text);
                break;

            case 'QUICK_PAYMENT_PENDING':
                await handleQuickPaymentPendingState(sock, from, session, text);
                break;

            case 'SELECT_WAITER_TIP':
                await handleSelectWaiterTipState(sock, from, session, text);
                break;

            case 'TIP_AMOUNT':
                await handleTipAmountState(sock, from, session, text);
                break;

            default:
                await sendText(sock, from, 'Sorry, I didn\'t understand. Type "Hi" to start over.');
                session.state = 'START';
                break;
        }
    } catch (error) {
        console.error('Handler error:', error);
        await sendText(sock, from, '❌ Technical error. Please try again.');
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
        feedback_waiter_name: null
    };
}

// ═══════════════════════════════════════════════════════════════
// UNIFIED ENTRY HANDLER (QR & TAGS)
// ═══════════════════════════════════════════════════════════════
async function handleEntry(sock, from, session, text) {
    await sendText(sock, from, '🔄 Verifying...');

    try {
        const result = await api.parseEntry(text);
        console.log('🔍 Parse Entry Result:', JSON.stringify(result, null, 2));

        if (result.type === 'waiter') {
            // Waiter Assignment
            session.restaurant_id = result.data.restaurant_id;
            session.restaurant_name = result.data.restaurant_name;
            session.waiter_id = result.data.waiter_id;
            session.waiter_name = result.data.waiter_name;
            session.header_info = result.data.waiter_name; // Set header for Home Screen

            // If table is not set, we might need to ask for it, or maybe just welcome them
            // The prompt says: "Bot inamwingiza kwenye restaurant na kum-assign huyo waiter."

            await sendText(sock, from, result.message || `Welcome to ${result.data.restaurant_name}! ${result.data.waiter_name} will be your waiter.`);

            // If we don't have a table yet, maybe ask for it or just go home?
            // Assuming we go to Home, but without a table number some features might be limited.
            // However, the user didn't specify asking for a table after waiter scan.
            // Let's go to Home.
            await showHomeScreen(sock, from, session);

        } else if (result.type === 'table') {
            // Table Assignment
            session.restaurant_id = result.data.restaurant_id;
            session.restaurant_name = result.data.restaurant_name;
            session.table_id = result.data.table_id;
            session.table_number = result.data.table_number || result.data.table_name; // Assuming 'number' is the display number
            session.header_info = `Table ${session.table_number}`; // Set header for Home Screen

            // Clear waiter if switching tables? Maybe not.
            // But if it's a fresh scan, maybe we should.
            // The prompt says: "Bot inamwingiza kwenye restaurant hiyo na meza hiyo moja kwa moja."

            await sendText(sock, from, result.message || `Welcome to ${result.data.restaurant_name}! You are at Table ${session.table_number}.`);
            await showHomeScreen(sock, from, session);

        } else {
            await sendText(sock, from, 
                '❌ Invalid QR Code or Tag.\n\n' +
                'No QR code? No problem! Please type the code START-_-_W** to proceed.'
            );
            session.state = 'SEARCH_RESTAURANT';
        }
    } catch (error) {
        console.error('Entry error:', error);
        await sendText(sock, from, '❌ Error verifying entry. Please try again.');
        session.state = 'SEARCH_RESTAURANT';
    }
}

// ═══════════════════════════════════════════════════════════════
// STATE HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleStartState(sock, from, session, text) {
    const greetings = ['hi', 'hello', 'mambo', 'habari', 'niaje', 'sasa', 'hujambo'];
    if (greetings.includes(text.toLowerCase())) {
        await sendText(sock, from,
            '👋 Welcome to TipTap!\n' +
            'Please scan the waiter\'s QR code to proceed.'
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
            await sendText(sock, from, 'Type the restaurant name:');
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
        await sendText(sock, from, 'Type the restaurant name:');
    } else {
        await handleSearchRestaurant(sock, from, session, text);
    }
}

async function handleTableState(sock, from, session, text) {
    if (text.startsWith('table_')) {
        const val = text.replace('table_', '');
        if (val === 'type') {
            session.state = 'TABLE_INPUT';
            await sendText(sock, from, 'Enter table number (e.g., 7):');
        } else {
            session.table_number = val;
            await showHomeScreen(sock, from, session);
        }
    } else if (!isNaN(text) && parseInt(text) > 0) {
        session.table_number = text;
        await showHomeScreen(sock, from, session);
    } else {
        await sendText(sock, from, 'Please enter a valid table number.');
    }
}

async function handleHomeState(sock, from, session, text) {
    const t = text.toLowerCase();

    // New Menu Options Mapping
    if (t === 'view_menu' || t.includes('menu')) {
        await showMenuImage(sock, from, session);
    } else if (t === 'track_order' || t === 'status' || t.includes('track')) {
        await showTrackStatus(sock, from, session);
    } else if (t === 'rate_service' || t.includes('rate')) {
        if (session.waiter_id && session.waiter_name) {
            session.feedback_waiter_id = session.waiter_id;
            session.feedback_waiter_name = session.waiter_name;
            await showFeedbackA(sock, from, session);
        } else {
            await showFeedbackTypeSelection(sock, from, session);
        }
    } else if (t === 'live_bill' || t.includes('bill') || t.includes('lipa')) {
        await showLiveBillOptions(sock, from, session);
    } else if (t === 'give_tips' || t.includes('tip')) {
        if (session.waiter_id && session.waiter_name) {
            // Auto-select assigned waiter
            session.tip_waiter_id = session.waiter_id;
            session.tip_waiter_name = session.waiter_name;
            session.quick_payment_desc = `Tip for ${session.tip_waiter_name}`;
            await showQuickPaymentAmount(sock, from, session);
        } else {
            await showWaiterTipList(sock, from, session);
        }
    } else if (t === 'call_waiter' || t.includes('call')) {
        // Direct call waiter if assigned
        if (session.waiter_id) {
            await initiateCallWaiter(sock, from, session, 'call_waiter', 'Call Waiter');
        } else {
            // Fallback if somehow called without waiter (shouldn't happen due to UI check)
            await showWaitersList(sock, from, session);
        }
    } else if (t === 'exit_bot' || t.includes('exit')) {
        sessions[from] = createNewSession();
        await sendText(sock, from, 'Goodbye! Thank you for visiting us.');
    } else {
        await showHomeScreen(sock, from, session);
    }
}

async function handleCallWaiterState(sock, from, session, text) {
    if (text === 'call_only') {
        await initiateCallWaiter(sock, from, session, 'call_waiter', 'Call Waiter');
    } else if (text === 'request_bill') {
        await initiateCallWaiter(sock, from, session, 'request_bill', 'Request Bill');
    } else if (text === 'list_waiters') {
        await showWaitersList(sock, from, session);
    } else if (text === 'home') {
        await showHomeScreen(sock, from, session);
    } else {
        await showCallWaiterOptions(sock, from, session);
    }
}

async function handleWaitersListState(sock, from, session, text) {
    if (text.startsWith('call_waiter_')) {
        const waiterName = text.replace('call_waiter_', '');
        await initiateCallWaiter(sock, from, session, `call_waiter_${waiterName}`, `Call ${waiterName}`);
    } else if (text === 'home') {
        await showHomeScreen(sock, from, session);
    } else {
        await showWaitersList(sock, from, session);
    }
}

async function initiateCallWaiter(sock, from, session, apiType, displayName) {
    try {
        await api.callWaiter({
            restaurant_id: session.restaurant_id,
            table_number: session.table_number,
            waiter_id: session.waiter_id, // Added waiter_id for direct waiter calls
            request_type: apiType
        });

        await sendText(sock, from, `✅ Request for *${displayName}* sent! Waiter is coming shortly.`);
        await showHomeScreen(sock, from, session);
    } catch (e) {
        console.error('Call waiter error:', e);
        await sendText(sock, from, '❌ Sorry, failed to send request. Please try again later.');
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
                title: `${c.name} (${c.menu_items?.length || 0})`,
                description: `${c.menu_items?.length || 0} items`
            }));

            rows.push({ id: 'home', title: '🏠 Home', description: '' });

            await sendList(sock, from,
                '📂 *Select Category*',
                'View Categories',
                [{ title: 'Categories', rows }]
            );
        } else {
            await sendText(sock, from, 'Sorry, menu is unavailable.');
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
            await sendText(sock, from, '🗑️ Cart cleared.');
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
            await sendText(sock, from, `❌ ${removed.name} removed.`);
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
            await sendText(sock, from, '❌ Order cancelled.');
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
            session.state = 'USSD_NUMBER';
            await sendText(sock, from, '📱 Enter Mobile Money phone number\nExample: 0712345678');
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
                '✅ Thank you!\n\nWaiting for waiter to confirm payment...'
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
            '📱 Enter Mobile Money phone number\n' +
            'Example: 0712345678 or 255712345678'
        );
    } else if (text === 'back_payment') {
        await showPaymentSummary(sock, from, session);
    }
}

async function handleUssdNumberState(sock, from, session, text) {
    // Validate phone number
    if (/^(0\d{9}|255\d{9})$/.test(text)) {
        session.ussd_phone = text.startsWith('255') ? '0' + text.slice(3) : text;
        session.ussd_provider = detectNetwork(session.ussd_phone);
        await showPayNow(sock, from, session);
    } else {
        await sendText(sock, from, '❌ Invalid number. Enter like 0712345678 or 255712345678');
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
        await sendText(sock, from, 'Enter Transaction ID (e.g., MPESA123XYZ):');
    } else if (text === 'pay_cash') {
        await showCashPayment(sock, from, session);
    } else if (text === 'home') {
        await showHomeScreen(sock, from, session);
    } else {
        // Assume it's a transaction ID
        session.transaction_id = text;
        await sendText(sock, from, '✅ Transaction ID received.\nWaiting for confirmation...');
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
        case 'rate_service':
            await showFeedbackTypeSelection(sock, from, session);
            break;
        case 'home':
            await showHomeScreen(sock, from, session);
            break;
    }
}

async function handleFeedbackState(sock, from, session, text) {
    if (session.state === 'FEEDBACK_TYPE') {
        if (text === 'rate_restaurant') {
            session.feedback_waiter_id = null;
            session.feedback_waiter_name = null;
            await showFeedbackA(sock, from, session);
        } else if (text === 'rate_waiter') {
            if (session.waiter_id && session.waiter_name) {
                // Auto-select assigned waiter
                session.feedback_waiter_id = session.waiter_id;
                session.feedback_waiter_name = session.waiter_name;
                await showFeedbackA(sock, from, session);
            } else {
                await showWaiterFeedbackList(sock, from, session);
            }
        } else if (text === 'home') {
            await showHomeScreen(sock, from, session);
        }
    } else if (session.state === 'FEEDBACK_WAITER_LIST') {
        if (text.startsWith('rate_waiter_')) {
            const parts = text.replace('rate_waiter_', '').split('|');
            session.feedback_waiter_id = parts[0];
            session.feedback_waiter_name = parts[1];
            await showFeedbackA(sock, from, session);
        } else if (text === 'home') {
            await showHomeScreen(sock, from, session);
        }
    } else if (text.startsWith('rate_')) {
        const rating = text.replace('rate_', '');
        session.rating = parseInt(rating);
        session.state = 'FEEDBACK_COMMENT';

        const target = session.feedback_waiter_name ? `for *${session.feedback_waiter_name}*` : 'for our service';
        await sendText(sock, from,
            `📝 Any comments ${target}?\n\n(Type comment or "skip" to continue)`
        );
    }
}

async function handleFeedbackCommentState(sock, from, session, text) {
    const comment = text.toLowerCase() === 'skip' ? '' : text;

    try {
        await api.submitFeedback({
            restaurant_id: session.restaurant_id,
            customer_phone: from.split('@')[0],
            rating: session.rating,
            comment: comment,
            waiter_id: session.feedback_waiter_id
        });
    } catch (e) {
        console.error('Feedback error:', e);
    }

    await sendText(sock, from, '🙏 Thanks for your feedback!');
    await showHomeScreen(sock, from, session);
}

async function handleTipState(sock, from, session, text) {
    if (text.startsWith('tip_')) {
        const amount = text.replace('tip_', '');
        if (amount !== 'skip') {
            if (!session.active_order_id) {
                await sendText(sock, from, '⚠️ You cannot tip without an active order.');
            } else {
                try {
                    await api.submitTip({
                        restaurant_id: session.restaurant_id,
                        order_id: session.active_order_id,
                        amount: parseInt(amount)
                    });
                    await sendText(sock, from, `💝 Thanks for the tip of Tsh ${amount}!`);
                } catch (e) {
                    console.error('Tip error:', e);
                    await sendText(sock, from, '❌ Error sending tip. Try again.');
                }
            }
        }

        await sendText(sock, from,
            '🎉 Thanks for using TIPTAP!\n\nWelcome again! 👋'
        );
        await showHomeScreen(sock, from, session);
    }
}

// ═══════════════════════════════════════════════════════════════
// SCREEN BUILDERS
// ═══════════════════════════════════════════════════════════════

async function showHomeScreen(sock, from, session) {
    session.state = 'HOME';
    // Clear temporary payment/tip info
    delete session.tip_waiter_id;
    delete session.tip_waiter_name;
    delete session.feedback_waiter_id;
    delete session.feedback_waiter_name;
    session.quick_payment_desc = null;

    const name = session.restaurant_name || 'Restaurant';
    // Determine what to show in brackets (Waiter Name or Table Number)
    // Priority: Explicit header_info > Waiter Name > Table Number
    const info = session.header_info || session.waiter_name || (session.table_number ? `Table ${session.table_number}` : '-');

    const rows = [
        { id: 'view_menu', title: '🍽️ View Our Menu', description: 'View menu and order' },
        { id: 'rate_service', title: session.waiter_name ? `⭐ Rate ${session.waiter_name.toUpperCase()}` : '⭐ Rate Service', description: 'Give feedback' },
        { id: 'live_bill', title: '💳 Pay Bill', description: 'Pay your bill' },
        { id: 'give_tips', title: session.waiter_name ? `💵 Tip ${session.waiter_name.toUpperCase()}` : '💵 Tip', description: 'Tip the waiter' }
    ];

    // Add "Call Waiter" option only if a waiter is assigned
    if (session.waiter_id) {
        rows.push({ id: 'call_waiter', title: '🔔 Call Waiter', description: 'Request assistance' });
    }

    rows.push({ id: 'exit_bot', title: '❌ Exit', description: 'Leave' });

    await sendList(sock, from,
        `👋 Welcome to *${name}* (${info})\nChoose service:`,
        'Service',
        [
            {
                title: '🍽️ MAIN SERVICES',
                rows: rows
            }
        ],
        '🏠✨'
    );
}

async function showTableSelection(sock, from, session) {
    try {
        const result = await api.getRestaurantTables(session.restaurant_id);
        if (result.success && result.data.length > 0) {
            let text = `━━━━━━━━ 🪑 ━━━━━━━━\n`;
            text += `🧾 Choose your table:\n`;

            session.menu_options = {};
            result.data.slice(0, 10).forEach((t, i) => {
                const numEmoji = getNumberEmoji(i + 1);
                text += `${numEmoji} Table ${t.name} 👥 (People ${t.capacity})\n`;
                session.menu_options[(i + 1).toString()] = `table_${t.id}`;
            });

            text += `✅ (Choose number)\n`;
            text += `━━━━━━━━ ✨ ━━━━━━━━`;
            await sendText(sock, from, text);
        } else {
            await sendText(sock, from, 'Please enter your table number (e.g., 7):');
        }
    } catch (e) {
        console.error('Fetch tables error:', e);
        await sendText(sock, from, 'Please enter your table number (e.g., 7):');
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
            const rows = session.menu_cache.map(c => ({
                id: `cat_${c.id}`,
                title: `📂${c.name.replace(/\s/g, '')}`
            }));

            const sections = [
                {
                    title: '🔍SEARCH',
                    rows: [{ id: 'search_food', title: '🔎SearchFood' }]
                },
                {
                    title: '🍴CATEGORIES',
                    rows: rows
                },
                {
                    title: '🏠HOME',
                    rows: [{ id: 'home', title: '🔙BackHome' }]
                }
            ];

            await sendList(sock, from, '🍽️OUR_MENU', 'Menu', sections, '🍽️✨');
        } else {
            await sendText(sock, from, 'Sorry, menu is unavailable right now.');
            await showHomeScreen(sock, from, session);
        }
    } catch (e) {
        console.error('Fetch menu error:', e);
        await sendText(sock, from, 'Error fetching menu. Please try again later.');
    }
}

async function showItemsList(sock, from, session, categoryId) {
    session.state = 'ITEMS_LIST';
    session.current_category = categoryId;

    const category = (session.menu_cache || []).find(c => c.id == categoryId);

    if (category && category.menu_items && category.menu_items.length > 0) {
        if (!session.menu_items_cache) session.menu_items_cache = [];
        category.menu_items.forEach(item => {
            if (!session.menu_items_cache.find(i => i.id == item.id)) {
                session.menu_items_cache.push(item);
            }
        });

        const rows = category.menu_items.map(i => ({
            id: `item_${i.id}`,
            title: `🍲${i.name.replace(/\s/g, '')} - ${i.price.toLocaleString()}/=`,
            description: `${i.price.toLocaleString()}/=`
        }));

        await sendList(sock, from, `🍽️${category.name.toUpperCase().replace(/\s/g, '')}`, 'Foods', [
            {
                title: '📋LIST',
                rows: rows
            },
            {
                title: '🏠HOME',
                rows: [
                    { id: 'back_menu', title: '🔙BackMenu' },
                    { id: 'go_cart', title: '🛒MyOrder' }
                ]
            }
        ], '✨🍴');
    } else {
        await sendText(sock, from, 'No items here.');
        await showMenuHub(sock, from, session);
    }
}

async function showItemDetail(sock, from, session, itemId) {
    session.state = 'ITEM_DETAIL';
    session.pending_item = itemId;

    const item = (session.menu_items_cache || []).find(i => i.id == itemId);

    if (!item) {
        await sendText(sock, from, 'Item not found.');
        return await showMenuHub(sock, from, session);
    }

    const text =
        `🍲*${item.name.replace(/\s/g, '')}*\n` +
        `💰${item.price?.toLocaleString()}/=\n` +
        `${item.description ? `📝${item.description}\n` : ''}`;

    const buttons = [
        { id: `add_${itemId}`, text: '➕Add' },
        { id: 'back_items', text: '🔙Back' },
        { id: 'go_cart', text: '🛒Order' }
    ];

    if (item.image) {
        await sendImageWithButtons(sock, from, item.image, text, buttons, '🍲✨');
    } else {
        await sendButtons(sock, from, text, buttons, '🍲✨');
    }
}

async function showQuantitySelection(sock, from, session, itemId) {
    await sendList(sock, from,
        '🔢*Quantity?*',
        'Choose',
        [
            {
                title: '⚡CHOOSE',
                rows: [
                    { id: 'qty_1', title: '1' },
                    { id: 'qty_2', title: '2' },
                    { id: 'qty_3', title: '3' },
                    { id: 'qty_4', title: '4' },
                    { id: 'qty_5', title: '5' }
                ]
            },
            {
                title: '🏠HOME',
                rows: [
                    { id: 'qty_more', title: '🔢OtherNumber' }
                ]
            }
        ],
        '🔢✨'
    );
}

async function showQuantityMore(sock, from, session) {
    await sendButtons(sock, from,
        `🔢Quantity: *${session.pending_qty}*`,
        [
            { id: 'qty_plus', text: '➕+1' },
            { id: 'qty_minus', text: '➖-1' },
            { id: 'qty_done', text: '✅Done' }
        ]
    );
}

async function addToCart(sock, from, session, itemId, qty) {
    let item = (session.menu_items_cache || []).find(i => i.id == itemId);
    if (!item) return;

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
        `✅*Added!*\n` +
        `${item.name} x${qty}\n` +
        `Total: ${total.toLocaleString()}/=`,
        [
            { id: 'continue_menu', text: '➕Continue' },
            { id: 'go_cart', text: '🛒GoToCart' },
            { id: 'home', text: '🏠Home' }
        ]
    );
    session.state = 'CART';
}

async function showCart(sock, from, session) {
    session.state = 'CART';

    if (session.cart.length === 0) {
        await sendButtons(sock, from,
            '🛒*Cart is empty*',
            [
                { id: 'go_menu', text: '🍽️Menu' },
                { id: 'home', text: '🏠Home' }
            ]
        );
        return;
    }

    let text = '🛒*Your Cart*\n';
    let total = 0;
    session.cart.forEach((item, i) => {
        const subtotal = item.price * item.qty;
        text += `${i + 1}.${item.name} x${item.qty}=${subtotal.toLocaleString()}/=\n`;
        total += subtotal;
    });
    text += `💰*Total: ${total.toLocaleString()}/=*`;
    session.order_total = total;

    await sendList(sock, from, text, 'Choose', [
        {
            title: '⚡ACTIONS',
            rows: [
                { id: 'confirm_order', title: '✅Confirm' },
                { id: 'continue_menu', title: '➕AddMore' },
                { id: 'edit_cart', title: '✏️Edit' }
            ]
        },
        {
            title: '🏠HOME',
            rows: [
                { id: 'home', title: '🔙BackHome' }
            ]
        }
    ], '🛒✨');
}

async function showCartEdit(sock, from, session) {
    session.state = 'CART_EDIT';
    const rows = session.cart.map((item, i) => ({
        id: `remove_${i}`,
        title: `❌${item.name.replace(/\s/g, '')} (x${item.qty})`,
        description: `x${item.qty}`
    }));
    rows.push({ id: 'back_cart', title: '🔙BackCart' });

    await sendList(sock, from, '✏️*EditCart*', 'View Items', [{ title: 'Items', rows }], '✏️✨');
}

async function showConfirmOrder(sock, from, session) {
    session.state = 'CONFIRM_ORDER';
    let text = `🧾*Confirm Order*\n`;
    text += `📍Table:${session.table_number}\n`;
    session.cart.forEach(item => { text += `•${item.name} x${item.qty}\n`; });
    text += `💰*Total:${session.order_total.toLocaleString()}/=*`;

    await sendButtons(sock, from, text, [
        { id: 'confirm_yes', text: '✅Confirm' },
        { id: 'back_cart', text: '🔙Back' },
        { id: 'cancel_order', text: '❌Cancel' }
    ], '🧾✨');
}

async function createOrder(sock, from, session) {
    try {
        const result = await api.createOrder({
            restaurant_id: session.restaurant_id,
            table_id: session.table_id,
            table_number: session.table_number,
            customer_phone: from.split('@')[0],
            customer_name: session.customer_name,
            items: session.cart,
            waiter_id: session.waiter_id
        });

        if (result.success) {
            session.active_order_id = result.order_id;
            session.order_total = result.total;
            session.cart = [];

            await sendButtons(sock, from,
                `✅*Order Received!*\n` +
                `🧾#${result.order_id}\n` +
                `💰${result.total.toLocaleString()}/=\n` +
                `Waiter is coming...`,
                [
                    { id: 'go_payment', text: '💳PayNow' },
                    { id: 'track_order', text: '📍Track' },
                    { id: 'home', text: '🏠Home' }
                ]
            );
            session.state = 'HOME';
        }
    } catch (error) {
        console.error('Create order error:', error);
        await sendText(sock, from, '❌Error creating order.');
    }
}

async function showPaymentSummary(sock, from, session) {
    session.state = 'PAYMENT_SUMMARY';
    if (!session.active_order_id) {
        await sendText(sock, from, 'No active order to pay.');
        return await showHomeScreen(sock, from, session);
    }

    let text = '🧾*Your Bill*\n';
    text += `📋#${session.active_order_id}\n`;
    text += `💰*Total:${session.order_total?.toLocaleString() || 0}/=*\n`;

    await sendList(sock, from, text, 'Payment', [
        {
            title: '💳PAYMENT',
            rows: [
                { id: 'pay_mobile', title: '📲MobileMoney' },
                { id: 'pay_cash', title: '💵Cash' }
            ]
        },
        {
            title: '🏠HOME',
            rows: [
                { id: 'home', title: '🔙BackHome' }
            ]
        }
    ], '💳✨');
}

async function showCashPayment(sock, from, session) {
    session.state = 'CASH_PAYMENT';
    await sendButtons(sock, from,
        '💵*You chose CASH*\n' +
        'Please pay the waiter.\n' +
        'After paying, press "I HAVE PAID".',
        [
            { id: 'cash_paid', text: '✅I HAVE PAID' },
            { id: 'track_order', text: '📍Track' },
            { id: 'home', text: '🏠Home' }
        ]
    );
}

async function showProviderSelect(sock, from, session) {
    session.state = 'PROVIDER_SELECT';
    const rows = [
        { id: 'provider_mpesa', title: 'M-Pesa' },
        { id: 'provider_tigopesa', title: 'TigoPesa' },
        { id: 'provider_airtelmoney', title: 'AirtelMoney' },
        { id: 'provider_halopesa', title: 'HaloPesa' },
        { id: 'back_payment', title: '🔙Back' }
    ];
    await sendList(sock, from, '📲*MobileMoney*', 'Choose', [{ title: 'Networks', rows }], '📲✨');
}

async function showPayNow(sock, from, session) {
    session.state = 'PAY_NOW';
    await sendButtons(sock, from,
        `📲*Pay Now*\n` +
        `💰${session.order_total?.toLocaleString() || 0}/=\n` +
        `📱${session.ussd_phone}\n` +
        `Press "PAY NOW".`,
        [
            { id: 'paynow', text: '✅PAY NOW' },
            { id: 'change_number', text: '✍️Edit' },
            { id: 'back_provider', text: '⬅️Back' }
        ]
    );
}

async function initiateUssdPayment(sock, from, session) {
    try {
        const result = await api.initiateUssdPayment({
            order_id: session.active_order_id,
            phone: session.ussd_phone,
            amount: session.order_total,
            network: session.ussd_provider
        });
        if (result.success) {
            session.state = 'USSD_PENDING';
            await sendButtons(sock, from,
                '📲 *Request Sent!*\n' +
                'Confirm on your phone.\n\n' +
                '✅ *Bot will confirm automatically* once payment is received.',
                [
                    { id: 'manual_ussd', text: '📟 Manual' },
                    { id: 'home', text: '🏠 Home' }
                ]
            );
            startPaymentPolling(sock, from, session, 'order', session.active_order_id);
        }
    } catch (error) {
        console.error('USSD error:', error);
        await sendButtons(sock, from, '❌USSD Error.', [
            { id: 'paynow', text: '🔁Try Again' },
            { id: 'pay_cash', text: '💵Cash' }
        ]);
    }
}

async function checkPaymentStatus(sock, from, session) {
    try {
        const result = await api.getOrderStatus(session.active_order_id);
        if (result.payment_status === 'paid') {
            await sendButtons(sock, from, '✅ *Payment Confirmed!* Thank you.', [
                { id: 'track_order', text: '📍 Track Order' },
                { id: 'go_feedback', text: '💬 Feedback' },
                { id: 'home', text: '🏠 Home' }
            ]);
            session.state = 'HOME';
        } else {
            const status = result.status || 'Pending';
            const payStatus = result.payment_status || 'Pending';
            await sendButtons(sock, from,
                `⏳ *Status Update*\n\n` +
                `Order: ${status}\n` +
                `Payment: ${payStatus}\n\n` +
                `Bado tunasubiri malipo...`,
                [
                    { id: 'check_status', text: '🔄 Check Again' },
                    { id: 'home', text: '🏠 Home' }
                ]
            );
        }
    } catch (error) { console.error(error); }
}

async function showManualUssd(sock, from, session) {
    session.state = 'MANUAL_USSD';
    await sendButtons(sock, from,
        '📟*Manual USSD*\n' +
        'Dial *150*00#\n' +
        'Pay amount: ' + session.order_total?.toLocaleString() + '/=\n' +
        'When done, press "I HAVE PAID":',
        [
            { id: 'manual_paid', text: '✅I HAVE PAID' },
            { id: 'home', text: '🏠Home' }
        ]
    );
}

async function showPostPaymentOptions(sock, from, session) {
    await sendButtons(sock, from, 'What would you like to do next?', [
        { id: 'track_order', text: '📍 Track Order' },
        { id: 'rate_service', text: '⭐ Rate Service' },
        { id: 'home', text: '🏠 Home' }
    ]);
}

async function showTrackStatus(sock, from, session) {
    session.state = 'TRACK_STATUS';
    try {
        // Use the new active-order API which is more reliable for table-based tracking
        const result = await api.getActiveOrder(session.restaurant_id, session.table_number);

        if (!result.success || !result.order) {
            await sendText(sock, from, '🧐 No active order found for this table.');
            return await showHomeScreen(sock, from, session);
        }

        const order = result.order;
        session.active_order_id = order.id; // Sync session

        const statusIcons = {
            'pending': '⏳ Pending',
            'confirmed': '✅ Confirmed',
            'preparing': '👨‍🍳 Preparing',
            'ready': '🍽️ Ready',
            'served': '✅ Served',
            'paid': '💰 Paid'
        };

        let text = `📍 *Order #${order.id}*\n`;
        text += `Status: ${statusIcons[order.status] || order.status}\n`;
        text += `Payment: ${order.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'}\n`;
        if (order.waiter_name) {
            text += `🙋 Waiter: ${order.waiter_name}\n`;
        }

        text += `\n🛒 *Items:*\n`;
        order.items.forEach(item => {
            text += `• ${item.name} x${item.quantity}\n`;
        });

        text += `\n💰 *Total: Tsh ${order.total?.toLocaleString()}/=*`;

        const buttons = [
            { id: 'refresh', text: '🔄 Refresh' }
        ];

        if (order.payment_status !== 'paid') {
            buttons.push({ id: 'go_payment', text: '💳 Pay Now' });
        }

        if (order.status === 'served' || order.status === 'ready' || order.payment_status === 'paid') {
            buttons.push({ id: 'rate_service', text: '⭐ Rate Service' });
        }

        buttons.push({ id: 'home', text: '🏠 Home' });

        await sendButtons(sock, from, text, buttons, '📡✨');
    } catch (e) {
        console.error('Track status error:', e);
        await sendText(sock, from, '❌ Error fetching order status.');
    }
}

async function showFeedbackTypeSelection(sock, from, session) {
    session.state = 'FEEDBACK_TYPE';
    await sendButtons(sock, from, '⭐ *Feedback*\nWhat would you like to rate?', [
        { id: 'rate_restaurant', text: '🏢 Restaurant Service' },
        { id: 'rate_waiter', text: '🙋 Waiter Service' },
        { id: 'home', text: '🏠 Home' }
    ], '⭐✨');
}

async function showWaiterFeedbackList(sock, from, session) {
    session.state = 'FEEDBACK_WAITER_LIST';
    try {
        const result = await api.getWaiters(session.restaurant_id);
        if (result.success && result.data.length > 0) {
            const rows = result.data.map(w => ({
                id: `rate_waiter_${w.id}|${w.name}`,
                title: `🙋 ${w.name}`,
                description: 'Bonyeza kumfanyia rating'
            }));
            rows.push({ id: 'home', title: '🏠 Home' });

            await sendList(sock, from, '🙋 Chagua Mhudumu wa kumfanyia Rating:', 'Wahudumu', [{ title: 'Wahudumu', rows }], '🙋✨');
        } else {
            await sendText(sock, from, 'Hakuna wahudumu kwa sasa.');
            await showHomeScreen(sock, from, session);
        }
    } catch (e) {
        console.error('Fetch waiters error:', e);
        await showHomeScreen(sock, from, session);
    }
}

async function showFeedbackA(sock, from, session) {
    session.state = 'FEEDBACK';
    const title = session.feedback_waiter_name ? `⭐ *Rating for ${session.feedback_waiter_name}*` : '⭐ *Rating*';
    await sendButtons(sock, from, `${title}\nGive us your feedback:`, [
        { id: 'rate_1', text: '⭐1' },
        { id: 'rate_2', text: '⭐⭐2' },
        { id: 'rate_3', text: '⭐⭐⭐3' },
        { id: 'rate_4', text: '⭐⭐⭐⭐4' },
        { id: 'rate_5', text: '⭐⭐⭐⭐⭐5' }
    ], '⭐✨');
}

async function showCallWaiterOptions(sock, from, session) {
    session.state = 'CALL_WAITER';
    await sendButtons(sock, from, '🙋 *What do you need?*', [
        { id: 'call_only', text: '🙋 Call Waiter' },
        { id: 'request_bill', text: '🧾 Request Bill' },
        { id: 'list_waiters', text: '👥 Waiters List' },
        { id: 'home', text: '🏠 Home' }
    ], '🙋✨');
}

async function showWaitersList(sock, from, session) {
    session.state = 'WAITERS_LIST';
    try {
        const result = await api.getWaiters(session.restaurant_id);
        if (result.success && result.data.length > 0) {
            const rows = result.data.map(w => ({
                id: `call_waiter_${w.name}`,
                title: `🙋 ${w.name}`,
                description: 'Bonyeza kumuita'
            }));

            rows.push({ id: 'home', title: '🏠 Home', description: '' });

            await sendList(sock, from,
                '👥 *Our Waiters*\n\nChoose a waiter to call:',
                'View Waiters',
                [{ title: 'Waiters', rows }],
                '👥✨'
            );
        } else {
            await sendText(sock, from, 'Sorry, no waiters available right now.');
            await showCallWaiterOptions(sock, from, session);
        }
    } catch (e) {
        console.error('Fetch waiters error:', e);
        await showCallWaiterOptions(sock, from, session);
    }
}

async function showTipScreen(sock, from, session) {
    session.state = 'TIP';
    await sendButtons(sock, from, '💝*Tip for Waiter?*\nChoose amount:', [
        { id: 'tip_500', text: '500/=' },
        { id: 'tip_1000', text: '1,000/=' },
        { id: 'tip_skip', text: 'Skip' }
    ], '💝✨');
}

async function handleSearchRestaurant(sock, from, session, query) {
    try {
        const result = await api.searchRestaurant(query);
        if (result.success && result.data?.length > 0) {
            const restaurants = result.data.slice(0, 5);
            session.search_results = restaurants;
            session.menu_options = {};

            let text = `━━━━━━━━ 🔍 ━━━━━━━━\n`;
            text += `✅ Found restaurants: ${result.count}\n`;
            text += `👇 Choose by typing number:\n`;

            restaurants.forEach((r, i) => {
                const numEmoji = getNumberEmoji(i + 1);
                text += `${numEmoji} 🏠 ${r.name}\n📍 ${r.location || 'Tanzania'}\n`;
                session.menu_options[(i + 1).toString()] = `pick_rest_${r.id}`;
            });

            text += `0️⃣ 🔄 Search again\n`;
            session.menu_options['0'] = 'search_again';

            text += `━━━━━━━━ ✨ ━━━━━━━━`;
            await sendText(sock, from, text);
            session.state = 'SEARCH_RESTAURANT';
        } else {
            await sendText(sock, from, 'Sorry, not found. Try again.');
        }
    } catch (e) { await sendText(sock, from, '❌Error searching.'); }
}

async function showMenuSelection(sock, from, session) {
    session.state = 'MENU_SELECTION';
    await sendButtons(sock, from, 'Which menu would you like to see?', [
        { id: 'menu_image', text: '🖼️ Menu Image' },
        { id: 'menu_list', text: '📋 List Menu' },
        { id: 'home', text: '🏠 Home' }
    ], '🍽️✨');
}

async function handleMenuSelectionState(sock, from, session, text) {
    if (text === 'menu_image') {
        await showMenuImage(sock, from, session);
    } else if (text === 'menu_list') {
        await showMenuHub(sock, from, session);
    } else if (text === 'home') {
        await showHomeScreen(sock, from, session);
    } else {
        await showMenuSelection(sock, from, session);
    }
}

async function showMenuImage(sock, from, session) {
    session.state = 'MENU_IMAGE_ORDER';
    await sendText(sock, from, '🔄 Downloading menu image...');

    const result = await api.getMenuImage(session.restaurant_id);
    if (result.success && result.data.menu_image_url) {
        await sendImageWithButtons(sock, from, result.data.menu_image_url,
            '👆 Here is our menu!',
            [{ id: 'home', text: '🏠 Home' }],
            '🖼️✨'
        );
    } else {
        await sendText(sock, from, '❌ Sorry, menu image not available.');
        await showMenuSelection(sock, from, session);
    }
}

async function handleMenuImageOrderState(sock, from, session, text) {
    if (text === 'home') {
        await showHomeScreen(sock, from, session);
        return;
    }

    await sendText(sock, from, '🔄 Processing your order...');

    try {
        const result = await api.createOrderText({
            restaurant_id: session.restaurant_id,
            table_id: session.table_id,
            table_number: session.table_number,
            waiter_id: session.waiter_id,
            customer_name: session.customer_name,
            customer_phone: from.split('@')[0],
            order_text: text
        });

        if (result.success) {
            if (result.order) {
                session.active_order_id = result.order.id;
                session.order_total = result.order.total;
                session.cart = []; // Clear cart if any

                let msg = `✅ *Order Received!*\n`;
                msg += `🧾 Order #${result.order.id}\n`;
                msg += `🛒 *Items found:*\n`;

                if (result.order.items && result.order.items.length > 0) {
                    result.order.items.forEach(item => {
                        msg += `• ${item.name} x${item.quantity} = ${item.total?.toLocaleString()}/=\n`;
                    });
                }

                msg += `\n💰 *Total: ${result.order.total?.toLocaleString()}/=*`;
                msg += `\n\nWaiter is coming to confirm...`;

                await sendButtons(sock, from, msg, [
                    { id: 'go_payment', text: '💳 Pay Now' },
                    { id: 'track_order', text: '📍 Track Status' },
                    { id: 'home', text: '🏠 Home' }
                ], '🧾✨');
            } else {
                // Handle success but no order object (e.g. just a message)
                await sendText(sock, from, result.message || '✅ Order received! Waiter is coming.');
                await showHomeScreen(sock, from, session);
            }

            session.state = 'HOME';
        } else {
            await sendText(sock, from, `❌ ${result.message || 'We could not understand your order.'}\n\nPlease try to type clearly (e.g., "Chips 2, Soda 1") or use the List Menu.`);
            await sendButtons(sock, from, 'Choose:', [
                { id: 'menu_list', text: '📋 Use List Menu' },
                { id: 'home', text: '🏠 Home' }
            ]);
        }
    } catch (e) {
        console.error('Text order error:', e);
        await sendText(sock, from, '❌ Technical error. Please try again or use List Menu.');
    }
}

async function showLiveBillOptions(sock, from, session) {
    // Clear tip info when paying bill
    delete session.tip_waiter_id;
    delete session.tip_waiter_name;
    session.quick_payment_desc = 'Bill Payment';

    // If no table number, we can't fetch an active order, so go straight to quick payment
    if (!session.table_number) {
        await showQuickPaymentAmount(sock, from, session);
        return;
    }

    try {
        const activeOrder = await api.getActiveOrder(session.restaurant_id, session.table_number);
        if (activeOrder.success && activeOrder.order && activeOrder.order.payment_status !== 'paid') {
            session.active_order_id = activeOrder.order.id;
            session.order_total = activeOrder.order.total;
            await showPaymentSummary(sock, from, session);
        } else {
            await showQuickPaymentAmount(sock, from, session);
        }
    } catch (e) {
        await showQuickPaymentAmount(sock, from, session);
    }
}



async function showQuickPaymentPhone(sock, from, session) {
    session.state = 'QUICK_PAYMENT_PHONE';
    const msg = session.tip_waiter_id
        ? '📱 Enter phone number to tip (e.g., 0712345678):'
        : '📱 Enter phone number to pay (e.g., 0712345678):';
    await sendText(sock, from, msg);
}

async function handleQuickPaymentPhoneState(sock, from, session, text) {
    if (/^(0\d{9}|255\d{9})$/.test(text)) {
        session.ussd_phone = text.startsWith('255') ? '0' + text.slice(3) : text;
        await initiateQuickPayment(sock, from, session);
    } else {
        await sendText(sock, from, '❌ Invalid number. Try again.');
    }
}

async function showQuickPaymentAmount(sock, from, session) {
    session.state = 'QUICK_PAYMENT_AMOUNT';
    const msg = session.tip_waiter_id && session.tip_waiter_name
        ? `💰 Tip ${session.tip_waiter_name.toUpperCase()} (Tsh):`
        : '💰 Enter amount to pay (Tsh):';
    await sendText(sock, from, msg);
}

async function handleQuickPaymentAmountState(sock, from, session, text) {
    const amount = parseInt(text.replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0) {
        session.quick_payment_amount = amount;
        await showQuickPaymentPhone(sock, from, session);
    } else {
        await sendText(sock, from, '❌ Invalid amount. Enter numbers only.');
    }
}

async function initiateQuickPayment(sock, from, session) {
    await sendText(sock, from, '🔄 Sending payment request...');
    try {
        const payload = {
            restaurant_id: session.restaurant_id,
            phone_number: session.ussd_phone,
            amount: session.quick_payment_amount,
            description: session.quick_payment_desc || 'Bill Payment',
            network: detectNetwork(session.ussd_phone)
        };
        if (session.tip_waiter_id) payload.waiter_id = session.tip_waiter_id;
        const result = await api.initiateQuickPayment(payload);

        if (result.success) {
            session.quick_payment_id = result.payment_id;
            session.state = 'QUICK_PAYMENT_PENDING';
            await sendButtons(sock, from,
                `✅ Request sent to ${session.ussd_phone}!\n\n` +
                `Amount: ${session.quick_payment_amount}/=\n\n` +
                `Please confirm on your phone.\n` +
                `✅ *Bot will confirm automatically* once payment is received.`,
                [
                    { id: 'home', text: '🏠 Home' }
                ],
                '💳✨'
            );
            startPaymentPolling(sock, from, session, 'quick', result.payment_id);
        } else {
            await sendText(sock, from, '❌ Oops! There is a technical issue. Please try again later.');
            await showHomeScreen(sock, from, session);
        }
    } catch (e) {
        console.error('Quick Payment Error:', e);
        await sendText(sock, from, '❌ Oops! There is a technical issue. Please try again later.');
        await showHomeScreen(sock, from, session);
    }
}

async function handleQuickPaymentPendingState(sock, from, session, text) {
    if (text === 'check_status') {
        const result = await api.checkQuickPaymentStatus(session.quick_payment_id);
        if (result.success && result.status === 'paid') {
            await sendText(sock, from, '✅ Malipo yamethibitishwa! Asante.');
            await showHomeScreen(sock, from, session);
        } else {
            await sendText(sock, from, `⏳ Status: ${result.status || 'Pending'}. Bado tunasubiri...`);
            await sendButtons(sock, from, 'Chagua:', [
                { id: 'check_status', text: '🔄 Check Tena' },
                { id: 'home', text: '🏠 Home' }
            ]);
        }
    } else if (text === 'home') {
        await showHomeScreen(sock, from, session);
    }
}

async function showWaiterTipList(sock, from, session) {
    session.state = 'SELECT_WAITER_TIP';
    try {
        const result = await api.getWaiters(session.restaurant_id);
        if (result.success && result.data.length > 0) {
            const rows = result.data.map(w => ({
                id: `tip_waiter_${w.id}|${w.name}`,
                title: `👤 ${w.name}`,
                description: 'Mpe Tip'
            }));
            rows.push({ id: 'home', title: '🏠 Home' });

            await sendList(sock, from, '💝 Chagua Mhudumu wa kumpa Tip:', 'Wahudumu', [{ title: 'Wahudumu', rows }], '💝✨');
        } else {
            await sendText(sock, from, 'Hakuna wahudumu kwa sasa.');
            await showHomeScreen(sock, from, session);
        }
    } catch (e) {
        console.error('Fetch waiters error:', e);
        await showHomeScreen(sock, from, session);
    }
}

async function handleSelectWaiterTipState(sock, from, session, text) {
    if (text.startsWith('tip_waiter_')) {
        const parts = text.replace('tip_waiter_', '').split('|');
        session.tip_waiter_id = parts[0];
        session.tip_waiter_name = parts[1];
        session.quick_payment_desc = `Tip for ${session.tip_waiter_name}`;
        await showQuickPaymentAmount(sock, from, session);
    } else if (text === 'home') {
        await showHomeScreen(sock, from, session);
    }
}



// ═══════════════════════════════════════════════════════════════
// MESSAGE SENDERS
// ═══════════════════════════════════════════════════════════════

async function sendText(sock, from, text) {
    await sock.sendMessage(from, { text });
}

async function sendButtons(sock, from, text, buttons, headerEmoji = '✨') {
    const session = sessions[from];
    session.menu_options = {};
    let menuText = `━━━━━━━━ ${headerEmoji} ━━━━━━━━\n`;
    menuText += text + '\n\n';
    buttons.forEach((b, i) => {
        const key = (i + 1).toString();
        session.menu_options[key] = b.id;
        const numEmoji = getNumberEmoji(i + 1);
        menuText += `${numEmoji}${b.text}\n`;
    });
    menuText += '━━━━━━━━━━━━━━━━\n';
    menuText += '✅ReplyNumberToChoose';
    await sock.sendMessage(from, { text: menuText });
}

async function sendList(sock, from, text, buttonText, sections, headerEmoji = '✨') {
    const session = sessions[from];
    session.menu_options = {};
    let menuText = `━━━━━━━━${headerEmoji}━━━━━━━━\n`;
    menuText += text + '\n';
    let counter = 1;
    sections.forEach(section => {
        if (section.title) menuText += `${section.title}\n`;
        section.rows.forEach(row => {
            const key = counter.toString();
            session.menu_options[key] = row.id;
            const numEmoji = getNumberEmoji(counter);
            menuText += `${numEmoji}${row.title}`;
            // if (row.description) menuText += `(${row.description})`;
            menuText += '\n';
            counter++;
        });
    });
    menuText += '━━━━━━━━━━━━━━━━\n';
    menuText += '✅ReplyNumberToChoose';
    await sock.sendMessage(from, { text: menuText });
}

async function sendImageWithButtons(sock, from, imageUrl, caption, buttons, headerEmoji = '✨') {
    try {
        await sock.sendMessage(from, { image: { url: imageUrl }, caption: caption });
    } catch (e) {
        await sendText(sock, from, caption);
    }
    await sendButtons(sock, from, 'Choose:', buttons, headerEmoji);
}

function getNumberEmoji(num) {
    const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[num] || `*${num}.*`;
}

function detectNetwork(phone) {
    if (phone.startsWith('255')) phone = '0' + phone.slice(3);
    const prefix = phone.substring(0, 3);
    if (['074', '075', '076'].includes(prefix)) return 'vodacom';
    if (['065', '067', '071', '077'].includes(prefix)) return 'tigo';
    if (['068', '069', '078', '079'].includes(prefix)) return 'airtel';
    if (['062'].includes(prefix)) return 'halotel';
    return 'vodacom';
}

async function startPaymentPolling(sock, from, session, type, id) {
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes (10s * 30)

    const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(interval);
            return;
        }

        try {
            let result;
            if (type === 'order') {
                result = await api.getOrderStatus(id);
                if (result.payment_status === 'paid') {
                    await sendText(sock, from, '✅ *Payment Confirmed!* Thank you for your payment.');
                    await showHomeScreen(sock, from, session);
                    clearInterval(interval);
                }
            } else {
                result = await api.checkQuickPaymentStatus(id);
                if (result.success && result.status === 'paid') {
                    await sendText(sock, from, '✅ *Payment Confirmed!* Thank you for your payment.');
                    await showHomeScreen(sock, from, session);
                    clearInterval(interval);
                }
            }
        } catch (e) {
            console.error('Polling error:', e);
        }
    }, 10000); // Check every 10 seconds
}

module.exports = { handleMessage, extractMessageText };
