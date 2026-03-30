#!/bin/bash
set -e

echo "=== PlacementPrep Setup ==="

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo "Docker is required. Install from https://docker.com"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js 20+ is required."; exit 1; }

# Copy env file
if [ ! -f apps/web/.env.local ]; then
  cp .env.example apps/web/.env.local
  echo "Created apps/web/.env.local — please fill in your Supabase credentials."
fi

# Install dependencies
echo "Installing Node dependencies..."
cd apps/web && npm install && cd ../..

echo ""
echo "=== Next steps ==="
echo "1. Edit apps/web/.env.local with your Supabase project URL and keys"
echo "   Get them from https://supabase.com/dashboard"
echo ""
echo "2. Run Supabase migrations:"
echo "   npx supabase db push  (if using Supabase cloud)"
echo "   OR"
echo "   npx supabase start && npx supabase db reset  (local dev)"
echo ""
echo "3. Start development:"
echo "   docker compose up  (starts Next.js + Ollama)"
echo "   OR"
echo "   cd apps/web && npm run dev  (Next.js only, Ollama must be running separately)"
echo ""
echo "4. On first Ollama start, it will pull the model (~2GB for llama3.2:3b)."
echo "   You can change the model with OLLAMA_MODEL in your .env.local"
