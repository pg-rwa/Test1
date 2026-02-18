#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────
# Dubai Real Estate Chatbot — One-command deploy script
#
# Usage (on your DigitalOcean droplet):
#   curl -fsSL <raw-script-url> | bash
#   — OR —
#   git clone <repo-url> && cd Test1/chatbot && bash deploy.sh
# ─────────────────────────────────────────────────────────

REPO_BRANCH="claude/create-claude-md-rMyyp"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3000

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Dubai Real Estate Chatbot — Deploy"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Step 1: Check prerequisites ──
log "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  warn "Node.js not found. Installing via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

NODE_VERSION=$(node -v)
log "Node.js: $NODE_VERSION"

if ! command -v npm &>/dev/null; then
  fail "npm not found. Please install Node.js 18+ first."
fi
log "npm: $(npm -v)"

# ── Step 2: Install dependencies ──
log "Installing dependencies..."
cd "$APP_DIR"
npm install --production=false 2>&1 | tail -3
log "Dependencies installed."

# ── Step 3: Check .env.local ──
if [ ! -f .env.local ]; then
  fail ".env.local not found! Create it with at minimum:\n  ANTHROPIC_API_KEY=sk-ant-..."
fi

if ! grep -q "ANTHROPIC_API_KEY" .env.local; then
  fail "ANTHROPIC_API_KEY not found in .env.local"
fi
log ".env.local found with API key."

# ── Step 4: Seed database (if empty) ──
log "Checking database..."
mkdir -p data

DB_PATH="./data/dubai_realestate.db"
NEEDS_SEED=false

if [ ! -f "$DB_PATH" ]; then
  NEEDS_SEED=true
else
  ROW_COUNT=$(node -e "
    const Database = require('better-sqlite3');
    try {
      const db = new Database('$DB_PATH', {readonly: true});
      const r = db.prepare('SELECT COUNT(*) as c FROM transactions').get();
      console.log(r.c);
      db.close();
    } catch(e) { console.log('0'); }
  " 2>/dev/null)

  if [ "$ROW_COUNT" = "0" ] || [ -z "$ROW_COUNT" ]; then
    NEEDS_SEED=true
  fi
fi

if [ "$NEEDS_SEED" = true ]; then
  log "Seeding database with sample data..."
  node scripts/seed_sample_data.js
  log "Database seeded."
else
  log "Database already has $ROW_COUNT transactions — skipping seed."
fi

# ── Step 5: Build production bundle ──
log "Building production bundle (this may take a minute)..."
npx next build 2>&1 | tail -10
log "Build complete."

# ── Step 6: Stop any existing server on port $PORT ──
if lsof -i :$PORT &>/dev/null 2>&1; then
  warn "Port $PORT is in use. Stopping existing process..."
  fuser -k $PORT/tcp 2>/dev/null || true
  sleep 2
fi

# ── Step 7: Start the server ──
log "Starting server on port $PORT..."

# Kill any existing keep-alive wrapper
pkill -f "start-server.sh" 2>/dev/null || true
sleep 1

# Start with keep-alive wrapper, fully detached
nohup bash start-server.sh > /tmp/chatbot-server.log 2>&1 &
disown

# Wait for server to be ready
for i in $(seq 1 15); do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" 2>/dev/null | grep -q "200"; then
    break
  fi
  sleep 1
done

# ── Step 8: Verify ──
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
  log "Server is running!"
else
  fail "Server failed to start. Check logs: tail -f /tmp/chatbot-server.log"
fi

# Get the server's external IP
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "localhost")

echo ""
echo "═══════════════════════════════════════════════════"
echo -e "  ${GREEN}Deploy complete!${NC}"
echo ""
echo "  Chatbot:    http://${EXTERNAL_IP}:${PORT}"
echo "  Diagnostic: http://${EXTERNAL_IP}:${PORT}/diagnostic.html"
echo ""
echo "  Logs:       tail -f /tmp/chatbot-server.log"
echo "  Stop:       pkill -f start-server.sh"
echo "═══════════════════════════════════════════════════"
echo ""
