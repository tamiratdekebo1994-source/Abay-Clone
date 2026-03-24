# 🇪🇹 Abay Driver - አባይ ሾፌር

**Ethiopia's Spark Driver Clone** — A full-stack delivery platform connecting stores and drivers across Ethiopia.

---

## 🚀 Overview

Abay Driver is modeled after Walmart Spark Driver, adapted for the Ethiopian market with:
- **Ethiopian payment methods**: Telebirr, CBE Birr, Awash Bank, Dashen Bank
- **Amharic language support** throughout the UI
- **Ethiopian cities**: Addis Ababa, Bahir Dar, Hawassa, Mekelle, Dire Dawa, and more
- **ETB (Ethiopian Birr)** currency
- **Local vehicle types**: Motorcycle, Bajaj, Car, Van, Truck

---

## 📁 Project Structure

```
Abay-Clone/
├── backend/          # Node.js + Express + Prisma + Socket.io API
├── mobile/           # React Native + Expo (Driver App)
└── web/              # React + Vite + Tailwind (Store & Admin Dashboard)
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express, Prisma ORM, PostgreSQL, Socket.io, JWT |
| **Mobile** | React Native, Expo, Redux Toolkit, React Navigation, Maps |
| **Web** | React, Vite, Tailwind CSS, Redux Toolkit, Recharts, Leaflet |
| **Real-time** | Socket.io (live driver tracking) |

---

## 👥 User Roles

### 🚗 Driver (Mobile App)
- Register with license & vehicle info
- Go online/offline toggle
- View & accept nearby delivery offers (30s timer)
- Real-time navigation to pickup & delivery
- Step-by-step status updates
- Earnings dashboard (today/week/month)

### 🏪 Store (Web Dashboard)
- Create delivery orders with pickup & drop-off
- Select payment method (Telebirr, CBE Birr, etc.)
- Real-time order tracking with live map
- Order history & management
- Store analytics dashboard

### 👑 Admin (Web Dashboard)
- Platform overview dashboard with charts
- Driver management (approve/suspend)
- Store management
- All orders monitoring
- Revenue analytics

---

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Expo CLI (for mobile development)

### 1. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials

npm install
npx prisma migrate dev --name init
npx prisma generate
npm run seed    # Creates demo accounts
npm run dev     # Starts on port 5000
```

### 2. Web Dashboard
```bash
cd web
npm install
npm run dev     # Starts on port 3000
```

### 3. Mobile App
```bash
cd mobile
npm install
# Edit src/utils/constants.js with your backend IP
npx expo start
```

---

## 🔑 Demo Credentials

| Role | Phone | Password |
|------|-------|----------|
| 🏪 Store | +251922000001 | Store@1234 |
| 👑 Admin | +251911000000 | Admin@1234 |
| 🚗 Driver | +251933000002 | Driver@1234 |

---

## 💰 Pricing Model (ETB)

| Component | Amount |
|-----------|--------|
| Base Fee | ETB 50 |
| Per KM | ETB 15 |
| Platform Fee | 15% of subtotal |
| Driver Earnings | 85% of subtotal |
| Minimum Order | ETB 80 |

Surcharges: +10% fragile, +20% refrigeration

---

## 🗺️ Ethiopian Cities Supported

- Addis Ababa (አዲስ አበባ)
- Dire Dawa (ድሬዳዋ)
- Hawassa (ሃዋሳ)
- Bahir Dar (ባህር ዳር)
- Mekelle (መቀሌ)
- Adama (አዳማ)
- Jimma (ጅማ)
- Gondar (ጎንደር)
- Dessie (ደሴ)

---

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` — Register user
- `POST /api/auth/login` — Login
- `POST /api/auth/refresh` — Refresh token
- `GET /api/auth/me` — Get current user

### Driver (requires DRIVER role)
- `POST /api/driver/register` — Register driver profile
- `GET /api/driver/profile` — Get driver profile
- `PATCH /api/driver/location` — Update location
- `POST /api/driver/toggle-online` — Go online/offline
- `GET /api/driver/orders/nearby` — Get nearby orders
- `GET /api/driver/earnings` — Get earnings

### Orders
- `POST /api/orders` — Create order (STORE)
- `GET /api/orders` — Get my orders
- `GET /api/orders/:id` — Get order details
- `POST /api/orders/:id/accept` — Accept order (DRIVER)
- `PATCH /api/orders/:id/status` — Update status (DRIVER)
- `POST /api/orders/:id/cancel` — Cancel order
- `POST /api/orders/:id/review` — Submit review

### Admin (requires ADMIN role)
- `GET /api/admin/dashboard` — Platform stats
- `GET /api/admin/drivers` — All drivers
- `PATCH /api/admin/drivers/:id/status` — Approve/suspend driver
- `GET /api/admin/stores` — All stores
- `GET /api/admin/orders` — All orders

---

## 🔌 WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `new_order_available` | Server → Drivers | New order posted |
| `driver_assigned` | Server → Store | Driver accepted order |
| `order_status_updated` | Server → Store | Status changed |
| `driver_location` | Server → Store | Real-time driver position |
| `update_location` | Driver → Server | Driver sends location |
| `join_order` | Client → Server | Subscribe to order room |

---

## 🔮 Future Roadmap

- [ ] Telebirr & CBE Birr payment API integration
- [ ] Push notifications (Expo Notifications)
- [ ] In-app chat between driver and recipient
- [ ] Surge pricing during peak hours
- [ ] Driver earnings wallet & withdrawal
- [ ] Multi-language: Amharic, Oromo, Tigrinya, Somali
- [ ] Document upload for driver verification
- [ ] AI-powered driver matching optimization

---

*Built with ❤️ for Ethiopia 🇪🇹*
