# 🇪🇹 Abay Driver — አባይ ሾፌር

**Ethiopia's Spark Driver Clone** — A full-stack, production-ready last-mile delivery platform connecting stores, drivers, and admins across Ethiopia.

[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![React Native](https://img.shields.io/badge/Expo-50-purple)](https://expo.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-gray)](LICENSE)

---

## Overview

Abay Driver is a three-sided marketplace:

| Persona | Platform | Description |
|---------|----------|-------------|
| **Driver** | React Native (Expo) | Accept deliveries, GPS tracking, in-app chat, wallet, push notifications |
| **Store** | React (Vite) | Create orders with live fare estimate, real-time driver tracking |
| **Admin** | React (Vite) | Driver approvals, analytics charts, surge pricing control |

### What's built

- 📱 **Mobile Driver App** — OTP login (Africa's Talking), live order feed (30s countdown), GPS tracking, in-app chat, wallet, push notifications, order history, post-delivery review, bilingual (EN + አማርኛ)
- 🏪 **Store Dashboard** — Order creation with **live fare estimate + surge indicator**, payment gateway (TeleBirr/CBE), real-time order tracking map, order history, browser push notifications
- 🛡️ **Admin Panel** — Driver document viewer, time-series analytics charts (7/14/30d), surge pricing control per city, driver approval/suspension, withdrawal processing
- 💰 **Wallet System** — Earnings after each delivery, withdrawal requests (TeleBirr, CBE Birr, Awash, Dashen, Cash), admin processing flow
- 🔥 **Surge Pricing Engine** — Automatic peak-hour + demand/supply multipliers + manual override per city (capped 2.5×)
- 🔔 **Notifications** — Push (Expo), in-app notification list (mark read), browser Notification API for store alerts
- 💬 **In-app Chat** — Real-time driver ↔ store messaging via Socket.io
- 💳 **Payments** — TeleBirr H5 and CBE Birr gateway stubs with webhook callbacks (replace stub with SDK in production)

---

## Project Structure

```
Abay-Clone/
├── backend/                     # Node.js + Express + Prisma + Socket.io
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js          # OTP login, JWT refresh
│   │   │   ├── driver.js        # Profile, location, toggle-online, nearby orders
│   │   │   ├── order.js         # CRUD + fare estimate + accept/status/review
│   │   │   ├── store.js         # Store profile + dashboard
│   │   │   ├── admin.js         # Dashboard + analytics + drivers + surge
│   │   │   ├── wallet.js        # Earnings, withdrawals
│   │   │   ├── notifications.js # List + mark-read
│   │   │   ├── payments.js      # TeleBirr + CBE Birr + callbacks
│   │   │   ├── chat.js          # Order messages
│   │   │   └── upload.js        # Document + photo uploads
│   │   ├── controllers/         # Business logic
│   │   ├── services/
│   │   │   ├── surgeService.js  # Automatic + manual surge pricing
│   │   │   ├── socketService.js # Socket.io rooms + events
│   │   │   └── pushNotificationService.js
│   │   ├── middleware/          # authenticate, authorize, errorHandler
│   │   └── utils/
│   │       ├── pricing.js       # Haversine distance + fee calculator
│   │       └── seed.js          # Demo data
│   └── prisma/schema.prisma     # Full DB schema
│
├── web/                         # React 18 + Vite + TailwindCSS
│   └── src/
│       ├── pages/
│       │   ├── store/
│       │   │   ├── CreateOrder.jsx    # Live fare estimate + surge badge
│       │   │   ├── OrderTracking.jsx  # Real-time map
│       │   │   ├── StoreOrders.jsx
│       │   │   ├── StoreDashboard.jsx
│       │   │   └── StoreProfile.jsx
│       │   └── admin/
│       │       ├── AdminDashboard.jsx # Area + Pie + Bar charts (real data)
│       │       ├── AdminDrivers.jsx   # Document viewer modal
│       │       ├── AdminOrders.jsx
│       │       ├── AdminStores.jsx
│       │       ├── AdminSurge.jsx     # Per-city surge control
│       │       └── AdminWithdrawals.jsx
│       ├── services/api.js      # Axios + auto token refresh
│       └── components/
│           └── Layout.jsx       # Real-time order alert banner + socket
│
├── mobile/                      # React Native + Expo SDK 50
│   └── src/
│       ├── screens/
│       │   ├── HomeScreen.js          # Online toggle + live order feed
│       │   ├── ActiveDeliveryScreen.js # Navigation + status updates
│       │   ├── ChatScreen.js
│       │   ├── EarningsScreen.js
│       │   ├── WalletScreen.js        # Balance + withdrawal
│       │   ├── NotificationsScreen.js # Unread badge, mark-all-read
│       │   ├── OrdersScreen.js        # History with filter tabs
│       │   ├── ReviewScreen.js        # 5-star + quick tags
│       │   ├── HelpSupportScreen.js   # FAQ + contact info
│       │   ├── ProfileScreen.js
│       │   └── auth/                  # OTP login flow
│       └── navigation/AppNavigator.js
│
├── docker-compose.yml           # postgres + redis + backend + web (nginx)
├── backend/Dockerfile
├── web/Dockerfile               # Multi-stage Vite build → nginx
└── setup.sh                     # One-command local setup
```

---

## Quick Start

### One command (recommended)

```bash
chmod +x setup.sh && ./setup.sh
```

### Docker

```bash
cp backend/.env.example backend/.env  # set DATABASE_URL + API keys
docker compose up --build
# Web:  http://localhost:3000
# API:  http://localhost:5000
```

### Manual

```bash
# Backend
cd backend && cp .env.example .env   # fill in values
npm install
npx prisma migrate dev --name init
node src/utils/seed.js               # demo accounts
npm run dev                          # :5000

# Web
cd web && npm install && npm run dev  # :3000

# Mobile
cd mobile && npm install && npx expo start
```

---

## Environment Variables

### `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/abaydriver` |
| `JWT_ACCESS_SECRET` | ✅ | ≥32 char random string |
| `JWT_REFRESH_SECRET` | ✅ | ≥32 char random string |
| `AT_API_KEY` | ✅ | Africa's Talking key (SMS OTP) |
| `AT_USERNAME` | ✅ | Africa's Talking username |
| `GOOGLE_MAPS_API_KEY` | ✅ | Maps + Distance Matrix |
| `TELEBIRR_APP_ID` | — | TeleBirr merchant app ID |
| `TELEBIRR_APP_KEY` | — | TeleBirr app key |
| `TELEBIRR_SHORT_CODE` | — | e.g. `1000` |
| `CBE_MERCHANT_ID` | — | CBE Birr merchant ID |
| `CBE_SECRET_KEY` | — | CBE Birr secret |
| `BASE_FEE_ETB` | — | Base delivery fee (default: 50) |
| `PER_KM_FEE_ETB` | — | Per-km fee (default: 15) |
| `PLATFORM_FEE_PERCENT` | — | Platform cut % (default: 15) |

---

## API Reference

Base URL: `http://localhost:5000/api`
Auth header: `Authorization: Bearer <accessToken>`

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/otp/request` | — | Send OTP via SMS |
| POST | `/auth/otp/verify-login` | — | OTP login |
| POST | `/auth/otp/verify-register` | — | OTP register |
| GET | `/auth/me` | ✓ | Current user |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/auth/logout` | ✓ | Invalidate token |

### Orders
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/orders/estimate` | STORE | **Live fare + surge** (no DB write) |
| POST | `/orders` | STORE | Create order |
| GET | `/orders` | ✓ | My orders |
| POST | `/orders/:id/accept` | DRIVER | Accept |
| PATCH | `/orders/:id/status` | DRIVER | Update status |
| POST | `/orders/:id/review` | ✓ | 1–5 star review |

### Payments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/telebirr/initiate` | STORE | TeleBirr checkout URL |
| POST | `/payments/telebirr/callback` | — | Webhook (gateway → server) |
| POST | `/payments/cbe/initiate` | STORE | CBE payment URL |
| POST | `/payments/cbe/callback` | — | Webhook |
| GET | `/payments/status/:ref` | ✓ | Payment status |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/dashboard` | ADMIN | KPI cards |
| GET | `/admin/analytics?days=7` | ADMIN | Time-series (orders, revenue, new drivers) |
| GET | `/admin/surge` | ADMIN | All cities surge state |
| POST | `/admin/surge` | ADMIN | Set manual override `{ city, multiplier }` |
| PATCH | `/admin/drivers/:id/status` | ADMIN | Approve / suspend |

### Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications` | ✓ | Paginated list + unread count |
| PATCH | `/notifications/read-all` | ✓ | Bulk mark read |
| PATCH | `/notifications/:id/read` | ✓ | Single mark read |

---

## Surge Pricing

Three factors, highest wins, capped at **2.5×**:

| Factor | Trigger | Multiplier |
|--------|---------|-----------|
| Morning rush (EAT) | 7–9 AM | 1.3× |
| Lunch (EAT) | 12–2 PM | 1.2× |
| Evening rush (EAT) | 5–8 PM | 1.4× |
| Demand ratio ≥ 1.5 | orders/drivers | 1.2–1.8× |
| Admin override | manual | up to 2.5× |

---

## WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `new_order_available` | Server → Drivers | `{ orderId, pickup, delivery, fee, distanceKm }` |
| `driver_assigned` | Server → Store | `{ orderId, driver }` |
| `order_status_updated` | Server → Store | `{ orderId, status }` |
| `driver_location` | Server → Store | `{ orderId, lat, lng }` |
| `payment_confirmed` | Server → Store | `{ orderId, amount, provider }` |
| `update_location` | Driver → Server | `{ lat, lng }` |
| `join_order` | Client → Server | `{ orderId }` |

---

## Demo Credentials

After running `node backend/src/utils/seed.js`:

| Role | Phone | Password |
|------|-------|----------|
| 👑 Admin | +251911000000 | Admin@1234 |
| 🏪 Store | +251922000001 | Store@1234 |
| 🚗 Driver | +251933000002 | Driver@1234 |

> **Production warning:** These are insecure demo passwords. Change them immediately after seeding a production database — especially the admin account.

---

## Pricing Model (ETB)

| Component | Value |
|-----------|-------|
| Base fee | ETB 50 |
| Per km | ETB 15 |
| Minimum order | ETB 80 |
| Platform fee | 15% of subtotal |
| Driver earnings | 85% of subtotal |
| Fragile surcharge | +10% |
| Refrigeration surcharge | +20% |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | Node.js 20, Express 4, Prisma ORM |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Real-time | Socket.io 4 |
| Auth | JWT (15m access + 30d refresh), OTP via Africa's Talking |
| Push | Expo Push Notification Service |
| Web | React 18, Vite 5, TailwindCSS, Recharts, React Router 6 |
| Mobile | React Native, Expo SDK 50, Redux Toolkit, expo-secure-store |
| Maps | React Native Maps, Google Maps API |
| Payments | TeleBirr H5, CBE Birr Merchant API |
| SMS | Africa's Talking |
| DevOps | Docker, Docker Compose, nginx |

---

*Built with ❤️ for Ethiopia 🇪🇹*
