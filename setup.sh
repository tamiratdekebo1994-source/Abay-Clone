#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Fetno — Quick Setup Script
# Runs the full stack locally (backend + web dashboard) in minutes
# ─────────────────────────────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print() { echo -e "${GREEN}[Abay]${NC} $1"; }
warn()  { echo -e "${YELLOW}[Warn]${NC} $1"; }
error() { echo -e "${RED}[Error]${NC} $1"; exit 1; }

# ── 1. Check requirements ────────────────────────────────────────────────────
print "Checking requirements..."
command -v node >/dev/null 2>&1 || error "Node.js 18+ is required. Install from https://nodejs.org"
command -v npm  >/dev/null 2>&1 || error "npm is required."

NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
[ "$NODE_VER" -lt 18 ] && error "Node.js 18+ required. Current: $(node -v)"

print "Node $(node -v) — OK"

# ── 2. Install dependencies ──────────────────────────────────────────────────
print "Installing root dependencies..."
npm install

print "Installing backend dependencies..."
cd backend && npm install && cd ..

print "Installing web dependencies..."
cd web && npm install && cd ..

# ── 3. Environment files ─────────────────────────────────────────────────────
if [ ! -f backend/.env ]; then
  print "Creating backend/.env from example..."
  cp backend/.env.example backend/.env
  warn "Edit backend/.env and fill in your API keys before starting."
else
  print "backend/.env already exists — skipping."
fi

# ── 4. Database setup ────────────────────────────────────────────────────────
print "Checking database..."

if command -v psql >/dev/null 2>&1; then
  print "PostgreSQL detected. Running migrations..."
  cd backend
  npx prisma migrate dev --name init 2>/dev/null || npx prisma db push
  print "Seeding database with demo data..."
  node src/utils/seed.js 2>/dev/null || warn "Seed skipped (data may already exist)"
  cd ..
else
  warn "PostgreSQL not found locally."
  if command -v docker >/dev/null 2>&1; then
    print "Starting PostgreSQL via Docker..."
    docker compose up postgres -d
    print "Waiting for database to be ready..."
    sleep 5
    cd backend
    npx prisma migrate dev --name init 2>/dev/null || npx prisma db push
    node src/utils/seed.js 2>/dev/null || warn "Seed skipped"
    cd ..
  else
    warn "Neither PostgreSQL nor Docker found."
    warn "Please install PostgreSQL or Docker, set DATABASE_URL in backend/.env, then run:"
    warn "  cd backend && npx prisma db push && node src/utils/seed.js"
  fi
fi

# ── 5. Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅  Fetno Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Start the backend:"
echo "    cd backend && npm run dev"
echo ""
echo "  Start the web dashboard (new terminal):"
echo "    cd web && npm run dev"
echo ""
echo "  Start the mobile app (new terminal):"
echo "    cd mobile && npx expo start"
echo ""
echo "  Or start everything with Docker:"
echo "    docker compose up --build"
echo ""
echo -e "  ${YELLOW}Demo Credentials:${NC}"
echo "    Admin:  +251911000000 / Admin@1234"
echo "    Store:  +251922000001 / Store@1234"
echo "    Driver: +251933000002 / Driver@1234"
echo ""
echo "  Web Dashboard: http://localhost:3000"
echo "  Backend API:   http://localhost:5000"
echo "  API Docs:      http://localhost:5000/health"
echo ""
