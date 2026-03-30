#!/bin/sh
set -e

ollama serve &
OLLAMA_PID=$!

echo "[Ollama] Waiting for server to start..."
until ollama list > /dev/null 2>&1; do
  sleep 2
done
echo "[Ollama] Server is up."

PRIMARY_MODEL="${OLLAMA_MODEL:-llama3.2:3b}"
echo "[Ollama] Pulling primary model: $PRIMARY_MODEL"
ollama pull "$PRIMARY_MODEL"
echo "[Ollama] $PRIMARY_MODEL is ready."

if [ -n "$OLLAMA_EXTRA_MODEL" ]; then
  echo "[Ollama] Pulling extra model: $OLLAMA_EXTRA_MODEL"
  ollama pull "$OLLAMA_EXTRA_MODEL"
  echo "[Ollama] $OLLAMA_EXTRA_MODEL is ready."
fi

# Build custom placement models from Modelfiles if present
if [ -f /models/Modelfile.placement-mcq ]; then
  echo "[Ollama] Building placement-mcq model..."
  ollama create placement-mcq -f /models/Modelfile.placement-mcq
  echo "[Ollama] placement-mcq ready."
fi

if [ -f /models/Modelfile.placement-tutor ]; then
  echo "[Ollama] Building placement-tutor model..."
  ollama create placement-tutor -f /models/Modelfile.placement-tutor
  echo "[Ollama] placement-tutor ready."
fi

if [ -f /models/Modelfile.placement-bank ]; then
  echo "[Ollama] Pulling qwen2:0.5b for fast bank generation..."
  ollama pull qwen2:0.5b
  echo "[Ollama] Building placement-bank model..."
  ollama create placement-bank -f /models/Modelfile.placement-bank
  echo "[Ollama] placement-bank ready."
fi

echo "[Ollama] All models loaded. Ready for inference."
wait $OLLAMA_PID
