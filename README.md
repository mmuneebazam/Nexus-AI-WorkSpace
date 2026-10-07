# ⬡ Nexus AI — Full-Stack AI Workspace

A clean, **end-to-end web application** built as a portfolio demo for AI + full-stack roles: a **Node.js/Express REST API**, a **streaming AI chat engine**, a **project tracker with full CRUD**, and **interactive API docs** — all in one zero-build codebase.

> Frontend SPA · REST API · SSE token streaming · LLM provider abstraction · live API explorer

---

## ✨ Features

| Area | What it does |
|---|---|
| **Dashboard** | Live metrics, activity feed, system status — all fed by `GET /api/stats` |
| **AI Chat** | Token-by-token streaming over **Server-Sent Events**, multiple conversations, model switching, stop-generation, markdown + code blocks with copy buttons |
| **Projects** | Full CRUD over REST (create / edit / delete / filter) with status badges and tags |
| **API Reference** | Interactive docs — press **Run** to fire live requests at this very server and inspect the JSON |
| **AI layer** | Provider abstraction: a deterministic **mock streaming engine** by default; set `OPENAI_API_KEY` and a real LLM takes over — **zero frontend changes** |

## 🧱 Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS single-page app (zero build step, hand-rolled design system, no external assets) |
| Backend | Node.js 18+, Express 4 — routing, validation, status codes, central error handler |
| AI | Provider interface (`MockProvider` / `OpenAIProvider`) with SSE streaming |
| Data | In-memory store with seeded demo data (swap for Postgres/Mongo in production) |

## 🚀 Quick start

```bash
npm install
npm start          # → http://localhost:3000
```

Optional — stream from a real LLM instead of the mock engine:

```bash
cp .env.example .env    # add OPENAI_API_KEY=sk-...
npm start
```

Dev mode with auto-reload: `npm run dev`

## 📁 Project structure

```
nexus-ai-workspace/
├── server.js                 # Express app, static serving, SPA fallback, error handler
├── src/
│   ├── routes/
│   │   ├── meta.js           # /health  /models  /stats  /activity
│   │   ├── chat.js           # /chat (SSE stream)  /conversations CRUD
│   │   └── projects.js       # /projects CRUD (validation + status codes)
│   ├── services/
│   │   └── llm.js            # AI provider abstraction (Mock ⇄ OpenAI)
│   └── data/
│       └── store.js          # In-memory store + seed data + activity log
└── public/
    ├── index.html            # SPA shell
    ├── styles.css            # Design system (dark theme, zero external assets)
    └── app.js                # Views, router, SSE client, CRUD, interactive docs
```

## 🔌 API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health, uptime, active provider |
| GET | `/api/stats` | Metrics + activity feed |
| GET | `/api/models` | Model profiles + provider |
| GET | `/api/conversations` | List conversations |
| GET | `/api/conversations/:id` | Message history |
| POST | `/api/chat` | **Streaming reply (SSE)** |
| DELETE | `/api/conversations/:id` | Delete a conversation |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project (201) |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

## 🤖 How the AI streaming works

1. The client `POST`s to `/api/chat` with `{ conversationId, message, model }` using `fetch()`
2. The server responds with `Content-Type: text/event-stream`
3. Each token arrives as an SSE frame: `data: {"type":"token","token":"…"}`
4. The client reads the body with a `ReadableStream` reader and paints tokens live (with a blinking caret)
5. On `{"type":"done"}`, the reply + its latency are persisted to the conversation

**Swapping in a real LLM:** `src/services/llm.js` defines one interface — `async *stream(messages, { model })`. The mock and the OpenAI provider both implement it; the app picks based on whether `OPENAI_API_KEY` is present. No route or frontend changes required.

## 🎯 What this demonstrates

- **REST API design** — routing, input validation, correct status codes, error handling, request logging
- **Real-time streaming** — SSE on the server, `fetch` + stream consumption on the client
- **AI/LLM integration architecture** — provider pattern, model config, latency tracking, conversation state
- **Clean UI engineering** — a polished, responsive interface without frameworks; maps 1:1 to React components
- **Developer experience** — interactive API docs, health endpoint, ready-to-clone repo hygiene

---

*Built as a demo project for the “AI Full-Stack Developer — Part-Time” role. Happy to walk through any part of it in a Loom or a call.* 🚀
