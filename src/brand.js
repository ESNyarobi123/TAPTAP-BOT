/**
 * TAP brand visual language for WhatsApp (no custom CSS — unicode + emoji).
 * Colors from samaki_samaki_tap_branded_ui.html (#2121CC primary, #6C63FF accent).
 */

const TAP = {
    divider: '━━━━━━━━━━━━━━━━━━━━',
    primary: '🔵',
    accent: '🟣',
    pay: '💠',
    star: '⭐',
};

function tapFooter(session, T) {
    return `0️⃣ ${T(session, 'home_type_zero')} · _${T(session, 'tap_powered_by')}_`;
}

function buildWelcomeBody(session, T) {
    const name = session.restaurant_name || 'Restaurant';
    const lines = [
        TAP.divider,
        `${TAP.primary} *${T(session, 'home_welcome')} ${name}!*`,
        TAP.divider,
    ];

    if (session.waiter_name) {
        lines.push(`🧑‍🍳 ${T(session, 'tap_waiter_label')}: *${session.waiter_name}*`);
    }

    if (session.table_number) {
        lines.push(`🪑 ${T(session, 'table')}: *${session.table_number}*`);
    }

    lines.push('');
    lines.push(T(session, 'tap_welcome_help'));
    lines.push('');
    lines.push(`💡 _${T(session, 'tap_welcome_sub')}_`);

    return lines.join('\n');
}

function buildStartWelcome(T, session) {
    return (
        `${TAP.divider}\n` +
        `${TAP.primary} *TipTap*\n` +
        `${TAP.divider}\n\n` +
        `${T(session, 'start_welcome')}\n\n` +
        `_${T(session, 'tap_powered_by')}_`
    );
}

function buildServiceSections(session, T) {
    const waiterDesc = session.waiter_name || T(session, 'call_waiter_desc');
    const tipDesc = session.waiter_name
        ? T(session, 'tap_tip_waiter').replace('{name}', session.waiter_name)
        : T(session, 'tip_desc');
    const rateDesc = session.waiter_name
        ? T(session, 'tap_rate_waiter').replace('{name}', session.waiter_name)
        : T(session, 'rate_desc');

    const foodRows = [
        { id: 'view_menu', title: `🍽️ ${T(session, 'menu_view')}`, description: T(session, 'menu_view_desc') },
    ];

    if (session.waiter_id) {
        foodRows.push({
            id: 'call_waiter',
            title: `🔔 ${T(session, 'call_waiter_short')}`,
            description: waiterDesc,
        });
    }

    const feedbackRows = [
        { id: 'rate_service', title: `⭐ ${T(session, 'tap_rate_service')}`, description: rateDesc },
    ];

    if (session.support_phone) {
        feedbackRows.push({
            id: 'customer_support',
            title: `📞 ${T(session, 'customer_support')}`,
            description: T(session, 'customer_support_desc'),
        });
    }

    return [
        { title: T(session, 'tap_section_food'), rows: foodRows },
        {
            title: T(session, 'tap_section_pay'),
            rows: [
                { id: 'live_bill', title: `💳 ${T(session, 'pay_bill')}`, description: T(session, 'tap_pay_methods') },
                { id: 'give_tips', title: `💵 ${T(session, 'tip')}`, description: tipDesc },
            ],
        },
        { title: T(session, 'tap_section_feedback'), rows: feedbackRows },
        {
            title: T(session, 'tap_section_settings'),
            rows: [
                { id: 'change_language', title: `🌐 ${T(session, 'change_language')}`, description: T(session, 'change_language_desc') },
                { id: 'exit_bot', title: `❌ ${T(session, 'tap_exit')}`, description: T(session, 'exit_desc') },
            ],
        },
    ];
}

function buildHomeListBody(session, T) {
    const name = session.restaurant_name || 'Restaurant';
    const info = session.header_info
        || session.waiter_name
        || (session.table_number ? `${T(session, 'table')} ${session.table_number}` : null);

    let body = `👋 ${T(session, 'home_welcome')} *${name}*`;
    if (info) {
        body += `\n🧑‍🍳 ${info}`;
    }
    body += `\n\n${T(session, 'home_choose')}`;

    return body;
}

function buildCallWaiterSent(session, T, displayName) {
    const waiterName = session.waiter_name || displayName;
    return (
        `${TAP.divider}\n` +
        `🔔 *${T(session, 'call_waiter_arriving').replace('{name}', waiterName)}*\n` +
        `_${T(session, 'call_waiter_eta')}_\n` +
        TAP.divider
    );
}

function buildLanguagePrompt(session, T) {
    return `${TAP.accent} *${T(session, 'select_language')}*`;
}

module.exports = {
    TAP,
    tapFooter,
    buildWelcomeBody,
    buildHomeListBody,
    buildStartWelcome,
    buildServiceSections,
    buildCallWaiterSent,
    buildLanguagePrompt,
};
