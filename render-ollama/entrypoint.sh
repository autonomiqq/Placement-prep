#!/bin/sh
set -e

# Start Ollama server in background
ollama serve &
OLLAMA_PID=$!

# Wait for server to be ready
echo "[ollama] Waiting for server..."
until ollama list > /dev/null 2>&1; do
  sleep 2
done
echo "[ollama] Server ready"

# Pull models if not already cached on persistent disk
pull_if_missing() {
  MODEL=$1
  if ollama show "$MODEL" > /dev/null 2>&1; then
    echo "[ollama] $MODEL already cached"
  else
    echo "[ollama] Pulling $MODEL ..."
    ollama pull "$MODEL"
    echo "[ollama] $MODEL ready"
  fi
}

pull_if_missing "nomic-embed-text"   # 274MB — pull first (smallest, needed for RAG)
pull_if_missing "qwen2:0.5b"         # 352MB — bulk generation
pull_if_missing "phi3:mini"          # 2.2GB — main fast tier

echo "[ollama] All models ready. Serving on :11434"

# Hand off to Ollama server process
wait $OLLAMA_PID
