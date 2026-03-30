FROM ollama/ollama:latest

# Models to pull on first boot (CPU-only on Render)
# phi3:mini  = 2.2GB  — fast tier, MCQ gen, tutor
# qwen2:0.5b = 352MB  — bank/bulk generation (very fast on CPU)
# nomic-embed-text = 274MB — RAG embeddings
#
# NOTE: mistral:7b is 4.1GB — too heavy for CPU, skip unless using GPU
ENV OLLAMA_MODELS=/root/.ollama
ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_KEEP_ALIVE=24h
ENV OLLAMA_NUM_PARALLEL=1
ENV OLLAMA_MAX_LOADED_MODELS=2

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 11434

ENTRYPOINT ["/entrypoint.sh"]
