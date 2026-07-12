#!/usr/bin/env bash
###############################################################################
# LogAI — One-shot setup script
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "╔══════════════════════════════════════════════╗"
echo "║           LogAI — Setup Script               ║"
echo "╚══════════════════════════════════════════════╝"

# 1. Generate JWT secret if not set
if grep -q "CHANGE_ME" "$PROJECT_DIR/.env" 2>/dev/null; then
  echo ""
  echo "→ Generating JWT secret..."
  JWT_SECRET=$(openssl rand -hex 64)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/CHANGE_ME_generate_with_openssl_rand_hex_64/$JWT_SECRET/" "$PROJECT_DIR/.env"
  else
    sed -i "s/CHANGE_ME_generate_with_openssl_rand_hex_64/$JWT_SECRET/" "$PROJECT_DIR/.env"
  fi
  echo "  ✓ JWT secret generated"
else
  echo "→ JWT secret already configured"
fi

# 2. Start all services
echo ""
echo "→ Starting Docker services..."
cd "$PROJECT_DIR"
docker-compose up -d --build

# 3. Wait for Elasticsearch
echo ""
echo "→ Waiting for Elasticsearch to be ready..."
until curl -sf http://localhost:9200/_cluster/health > /dev/null 2>&1; do
  echo "  ... waiting"
  sleep 5
done
echo "  ✓ Elasticsearch is ready"

# 4. Wait for PostgreSQL
echo ""
echo "→ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U logai > /dev/null 2>&1; do
  echo "  ... waiting"
  sleep 2
done
echo "  ✓ PostgreSQL is ready"

# 5. Run database migrations
echo ""
echo "→ Running database migrations..."
docker-compose exec -T backend alembic upgrade head
echo "  ✓ Migrations complete"

# 6. Done
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║          LogAI is ready!                     ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  FastAPI:        http://localhost:8000       ║"
echo "║  API Docs:       http://localhost:8000/docs  ║"
echo "║  Auth Service:   http://localhost:4001       ║"
echo "║  Elasticsearch:  http://localhost:9200       ║"
echo "║  NGINX:          http://localhost:80         ║"
echo "║  Fluentd HTTP:   http://localhost:9880       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. cd frontend && npm run dev"
echo "  2. Create a server via API to get an API key"
echo "  3. Run the demo shipper: cd shipper && python demo.py --key YOUR_KEY"

