-- ─────────────────────────────────────────
--  RAG / VECTOR SEARCH INFRASTRUCTURE
-- ─────────────────────────────────────────

-- Enable pgvector (available on all Supabase projects)
create extension if not exists vector;

-- ── Document chunks table ───────────────────────────────────────────────────
-- Stores embedded chunks of questions, concepts, and study notes for RAG.
-- nomic-embed-text produces 768-dim vectors.
create table if not exists public.document_chunks (
  id           uuid primary key default gen_random_uuid(),
  content      text not null,
  embedding    vector(768),
  source_type  text not null check (source_type in ('question', 'concept', 'study_note')),
  source_id    uuid,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

-- HNSW index for fast approximate nearest-neighbour search (cosine distance)
create index if not exists document_chunks_embedding_hnsw
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Regular indexes for filtering
create index if not exists document_chunks_source_type_idx on public.document_chunks (source_type);
create index if not exists document_chunks_source_id_idx   on public.document_chunks (source_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.document_chunks enable row level security;

-- Authenticated users can read chunks (public knowledge base)
create policy "Authenticated users can read chunks"
  on public.document_chunks for select
  to authenticated
  using (true);

-- Only service role can write (via embedAndStore helper)
create policy "Service role manages chunks"
  on public.document_chunks for all
  to service_role
  using (true) with check (true);

-- ── Similarity search function ─────────────────────────────────────────────
create or replace function match_chunks(
  query_embedding  vector(768),
  match_count      int     default 5,
  source_filter    text    default null,
  min_similarity   float   default 0.3
)
returns table (
  id          uuid,
  content     text,
  metadata    jsonb,
  source_type text,
  source_id   uuid,
  similarity  float
)
language sql stable security definer
set search_path = public
as $$
  select
    dc.id,
    dc.content,
    dc.metadata,
    dc.source_type,
    dc.source_id,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where dc.embedding is not null
    and (source_filter is null or dc.source_type = source_filter)
    and 1 - (dc.embedding <=> query_embedding) >= min_similarity
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- ── Agent memory table ─────────────────────────────────────────────────────
-- Stores per-user agent conversation memory for continuity across sessions.
create table if not exists public.agent_memory (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  key        text not null,           -- e.g. "weak_topics", "last_test_category"
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.agent_memory enable row level security;

create policy "Users manage own memory"
  on public.agent_memory for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Indexes ────────────────────────────────────────────────────────────────
create index if not exists agent_memory_user_idx on public.agent_memory (user_id);
