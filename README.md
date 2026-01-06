# TIPTAP WhatsApp Bot

WhatsApp bot ya TIPTAP - Restaurant ordering system powered by Baileys.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Edit `.env` file:
   ```env
   API_BASE_URL=https://TIPTAP.tendapoa.com/api/bot
   BOT_TOKEN=your_sanctum_token_here
   PORT=3000
   ```

3. **Start the bot:**
   ```bash
   npm start
   ```

4. **Scan QR code** with WhatsApp (Settings > Linked Devices > Link a Device)

## 📁 Project Structure

```
V1/
├── src/
│   ├── index.js      # Main entry point, WhatsApp connection
│   ├── handler.js    # Message handler, state machine
│   └── api.js        # Laravel API client
├── .env              # Environment variables
├── package.json      # Dependencies
└── README.md         # This file
```

## 📱 Bot Flow

### Entry Points
1. **QR Scan**: `START|R=45|T=7` (restaurant_id=45, table=7)
2. **Search**: User types restaurant name

### Screens (Max 3 buttons per screen)
- **Home**: Menu | Cart | Payment
- **Categories**: List categories + paging
- **Items**: List items + paging
- **Item Detail**: Add to cart | Back | Home
- **Quantity**: 1 | 2 | More
- **Cart**: Confirm | Clear | Back
- **Payment**: Cash | Mobile Money | Back
- **USSD**: Pay Now | Change Number | Back
- **Feedback**: Rating 1-5 (2 screens)
- **Tip**: 500 | 1000 | Skip

## 🔗 API Endpoints Required

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/verify-restaurant` | GET | Verify restaurant & table from QR |
| `/search-restaurant` | GET | Search restaurants by name |
| `/restaurant/{id}/full-menu` | GET | Get all categories & items |
| `/item/{id}` | GET | Get item details |
| `/order` | POST | Create order |
| `/order/{id}/status` | GET | Check order & payment status |
| `/payment/ussd` | POST | Initiate USSD payment |
| `/feedback` | POST | Submit rating & comment |
| `/tip` | POST | Submit tip |

## 🔐 Authentication

Bot uses Laravel Sanctum Bearer token. Set `BOT_TOKEN` in `.env`.

## 📝 Session Data

Per user (phone number):
- `restaurant_id`: Current restaurant
- `restaurant_name`: Restaurant name
- `table_number`: Table number
- `cart[]`: Shopping cart
- `active_order_id`: After order confirmed
- `order_total`: Order total amount
- `state`: Current screen
- `menu_cache`: Cached menu for speed

## 🛠️ Development

Run with auto-reload (install nodemon first):
```bash
npm install -g nodemon
nodemon src/index.js
```

## ⚠️ Important Notes

1. **Buttons limit**: Max 3 buttons per screen (WhatsApp limitation)
2. **Multi-restaurant**: Always requires `restaurant_id` in session
3. **Session storage**: In-memory (lost on restart). For production, use Redis.
4. **Phone format**: Accepts 0712345678 or 255712345678
