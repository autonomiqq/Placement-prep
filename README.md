!# PlacementPrep — AI-Powered Placement Test Practice Platform

A full-stack, self-hosted web application for engineering students to practice placement tests with AI-generated questions, real-time scoring, and personalized weakness detection.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript 5 |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Cache / Buffer | Redis 7 |
| AI / LLM | Ollama (local, self-hosted — phi3, mistral) |
| Styling | Tailwind CSS 3.4 |
| State | Zustand 5 |
| Charts | Recharts 2 |
| Deployment | Docker + Nginx (horizontally scalable) |

---

## Features

### Student Features
- **Registration & Login** — Email/password auth via Supabase
- **Practice Tests** — Timed MCQ exams with negative marking, auto-submit on timer expiry, answer buffering via Redis
- **Real-time Exam UI** — Question palette, flag for review, live countdown timer
- **Instant Scoring** — Scored via PostgreSQL function with per-question marks/negative marks
- **Results & Review** — See correct/wrong answers, explanations, AI-powered deep-dive explanations
- **AI Tutor** — Streaming chat powered by local Ollama LLM (phi3)
- **Analytics Dashboard** — Category performance, score trend charts (radar + line)
- **Weakness Detection** — Automatic identification of weak categories and topics based on answer history, with recommended tests
- **Leaderboard** — Top 50 students ranked by total points
- **Profile** — Edit personal details, view stats, delete account

### Admin Features
- **Test Management** — Create, edit, publish/unpublish tests
- **Question Bank** — AI-generated questions stored in a reusable bank with topic/category/difficulty filtering
- **Question Generation** — Generate MCQ questions on any topic using local Ollama models
- **Pull from Bank** — Pull questions from the bank into tests with optional topic filtering
- **Student Management** — List, search, add individual students, bulk import via CSV
- **Admin Analytics** — Student performance stats, test completion rates

---

## AI-Powered Weakness Detection

The platform automatically analyses a student's performance history and surfaces personalised insights:

**How it works:**
1. **Category accuracy** — Computed as `correct answers ÷ total questions attempted` per category from `user_category_stats`
2. **Weakness score** — Weighted formula: 50% average score gap + 50% accuracy gap, scaled by number of tests taken to avoid false signals from sparse data
3. **Weak topics** — Aggregates wrong answers' question `tags` (e.g. "speed", "percentage", "lcm") across all submitted attempts, minimum 3 appearances before surfacing

**Where it appears:**
- **Dashboard** → "Focus Areas" widget with category accuracy bars and 3 recommended untaken tests
- **Analytics page** → Full breakdown with accuracy bars, weak topics panel, and recommended tests grid
- **`WeaknessInsights` component** → Reusable client component (`compact` or full mode) embeddable anywhere

**API endpoint:** `GET /api/analytics/insights` — returns `InsightsPayload` with weak categories, strong categories, weak topics, recommended tests, and overall accuracy.

---

## Project Structure

```
/
├── apps/web/                    # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/          # Login, Register
│   │   │   ├── (dashboard)/     # Student pages
│   │   │   │   ├── dashboard/   # Main dashboard + Focus Areas widget
│   │   │   │   ├── analytics/   # Full analytics + weakness breakdown
│   │   │   │   ├── tests/       # Browse, attempt, results
│   │   │   │   ├── leaderboard/
│   │   │   │   ├── profile/
│   │   │   │   └── tutor/       # AI chat
│   │   │   ├── (admin)/         # Admin panel
│   │   │   │   ├── admin/
│   │   │   │   │   ├── overview/
│   │   │   │   │   ├── tests/
│   │   │   │   │   ├── students/
│   │   │   │   │   ├── question-bank/
│   │   │   │   │   └── analytics/
│   │   │   └── api/
│   │   │       ├── analytics/insights/  # Weakness detection engine
│   │   │       ├── tests/[testId]/      # attempt, submit, answers
│   │   │       ├── ai/                  # chat, explain, generate
│   │   │       ├── admin/               # tests, students, question-bank
│   │   │       ├── auth/register/
│   │   │       └── profile/
│   │   ├── components/
│   │   │   ├── analytics/
│   │   │   │   ├── AnalyticsCharts.tsx      # Radar + line charts
│   │   │   │   └── WeaknessInsights.tsx     # Reusable weakness widget
│   │   │   ├── layout/                  # Sidebar, Topbar
│   │   │   └── tests/                   # ExplainButton
│   │   ├── hooks/           # useTimer, useAIChat, useAuth
│   │   ├── lib/
│   │   │   ├── agent/       # PlacementAgent (ReAct loop + tools)
│   │   │   ├── cache/       # Redis test/question caching
│   │   │   ├── exam/        # Answer buffer management
│   │   │   ├── ollama/      # LLM client + prompts
│   │   │   ├── rag/         # Knowledge base retrieval (partial)
│   │   │   └── supabase/    # Client, server, admin guard
│   │   ├── stores/          # testSessionStore (Zustand)
│   │   └── types/           # DB and test types
│   ├── Dockerfile
│   └── next.config.ts
├── supabase/
│   └── migrations/          # 6 SQL files: schema, RLS, functions, RAG, admin, question-bank
├── nginx/nginx.conf
├── docker-compose.yml
└── README.md
```

---

## Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `profiles` | Student/admin profile extending auth.users |
| `tests` | Test metadata (category, difficulty, timing) |
| `questions` | Questions linked to tests |
| `mcq_options` | Answer options per question |
| `test_attempts` | Student attempt records (in_progress / submitted) |
| `answers` | Per-question responses with scoring |
| `user_category_stats` | Aggregated stats per student per category |
| `question_bank` | Reusable AI-generated questions |
| `tutor_sessions / tutor_messages` | AI tutor chat history |

**Key DB functions:**
- `score_attempt(p_attempt_id)` — Scores all answers, updates stats and rank
- `refresh_ranks()` — Recalculates leaderboard ranks
- `handle_new_user()` — Trigger on signup to create profile

---

## Getting Started

### Prerequisites
- Docker Desktop
- Git

### 1. Clone and configure

```bash
git clone <repo-url>
cd sample1
cp .env.example .env
# Edit .env with your Supabase URL, keys, and app URL
```

### 2. Run database migrations

```bash
# Using Supabase CLI
supabase db push
```

### 3. Start the stack

```bash
# Standard (phi3 model for AI features)
docker compose up -d

# With smart model (mistral 7B for better reasoning)
docker compose --profile smart up -d

# Scale web tier for high load
docker compose up -d --scale web=3
```

### 4. Seed initial data (optional)

```bash
# Create admin + student test accounts
node apps/web/seed-users.mjs

# Seed 30 sample aptitude questions
node apps/web/seed-questions.mjs
```

### 5. Access

| URL | Purpose |
|---|---|
| `http://localhost:8080` | Main application |
| `http://localhost:8080/admin` | Admin panel |
| `http://localhost:11434` | Ollama API (direct) |

---

## Test Credentials (after seeding)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@placementprep.com` | `Admin@123` |
| Student | `student@placementprep.com` | `Student@123` |

---

## Key Architecture Decisions

**Answer buffering via Redis**
Student answers are written to Redis on each answer change (`exam:answers:{attemptId}`). On submit, the server merges Redis buffer with the client-submitted state. This means answers survive a page refresh or brief disconnect.

**Test caching**
Test metadata and questions are cached in Redis for 10 minutes (`test:meta:v2:{testId}`, `test:questions:v2:{testId}`). Reduces DB load when many students start the same test simultaneously.

**Role-based access**
- `profiles.role` = `admin` or `student`
- Admin pages protected by server-side `requireAdmin()` guard
- Students cannot access `/admin/*` or call admin API routes
- Admins cannot take tests (blocked at API + UI level)

**Expired attempt handling**
If a student's in-progress attempt has expired when they revisit the test, the server marks it as submitted and returns `410 Gone`. The client redirects back to the test detail page instead of showing an empty exam.

**Weakness detection algorithm**
Weakness score = `(100 - avg_score) × 0.5 + (100 - accuracy) × 0.5`, scaled by `min(tests_taken / 3, 1)` to avoid over-weighting sparse data. Categories with 0 tests taken are excluded from weak/strong rankings.

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
APP_URL=http://localhost:8080

OLLAMA_BASE_URL=http://ollama-fast:11434
OLLAMA_FAST_MODEL=phi3:mini
OLLAMA_SMART_MODEL=mistral:7b-instruct-q4_0
OLLAMA_EMBED_MODEL=nomic-embed-text

REDIS_URL=redis://redis:6379
```

---

## Docker Services

| Service | Image | Purpose |
|---|---|---|
| `nginx` | nginx:alpine | Reverse proxy + load balancer (port 8080) |
| `web` | sample1-web | Next.js application (port 3000, scalable) |
| `redis` | redis:7-alpine | Cache + answer buffer (256MB, LRU) |
| `ollama-fast` | ollama/ollama | Always-on LLM (phi3:mini) |
| `ollama-smart` | ollama/ollama | Optional reasoning model (mistral 7B) |

---

## Roadmap

- [ ] Coding question sandbox (Monaco editor + server-side execution)
- [ ] Streak system (daily activity tracking)
- [ ] Email notifications (test reminders, results)
- [ ] Full RAG knowledge base (topic-specific study material)
- [ ] Mobile-optimised exam interface
- [ ] Export student reports (CSV/PDF)
- [ ] Weekly leaderboard resets + badges
# edtech-platform-placements
# Placement-prep
