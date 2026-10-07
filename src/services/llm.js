/**
 * llm.js — AI provider abstraction
 * --------------------------------
 * The whole app talks to any LLM through one interface:
 *
 *   async *stream(messages, { model })  →  yields tokens (strings)
 *
 * By default the MockProvider streams deterministic, realistic replies so the
 * demo runs with zero setup. Set OPENAI_API_KEY (see .env.example) and the
 * OpenAIProvider takes over — same interface, no other code changes.
 */

const CODE = '```'; // markdown code fence
const IB = (s) => `\`${s}\``; // markdown inline code

const MODELS = [
  { id: 'nexus-pro', name: 'Nexus Pro', description: 'Balanced quality — richer, structured replies', wps: 38 },
  { id: 'nexus-flash', name: 'Nexus Flash', description: 'Optimized for speed — snappy, shorter replies', wps: 85 },
];

const getModel = (id) => MODELS.find((m) => m.id === id) || MODELS[0];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ────────────────────────────── Mock replies ───────────────────────────── */

const GREETING = `Hey! 👋 I'm **Nexus** — the assistant built into this workspace.

Right now I'm running on a **mock streaming engine**: this reply was generated server-side and is arriving token-by-token over Server-Sent Events. Swap in an ${IB('OPENAI_API_KEY')} and the exact same UI streams from a real LLM — no frontend changes needed.

A few things to try:
- Ask how **this app is built**
- Ask me to **write a React component** or an **Express route**
- Have me **draft a client email** or a **project roadmap**`;

const INTRO = `I'm **Nexus**, the AI assistant embedded in this demo workspace.

Under the hood I'm a provider-agnostic chat service: ${IB('src/services/llm.js')} defines a small provider interface, and the active provider (mock or OpenAI) streams replies through ${IB('POST /api/chat')} as SSE frames.

I keep full conversation history, support two model profiles, and report response latency after every reply. Ask me for code, writing, or a walkthrough of the architecture.`;

const CAPABILITIES = `Here's what I can do in this demo:

- **Explain the stack** — how the Express API, SSE streaming, and the provider abstraction fit together
- **Generate code** — React components, Express routes, FastAPI endpoints
- **Draft content** — client emails, project summaries, roadmaps
- **Stream live** — every reply arrives token-by-token over ${IB('text/event-stream')}

I'm intentionally a deterministic mock — the goal is to showcase the plumbing: chat state, streaming transport, and a clean swap-in point for a real LLM.`;

const THANKS = `Anytime! 🙌 Need anything else — a code snippet, a client email, or a quick architecture walkthrough?`;

const ARCHITECTURE = `Great question — here's the full picture:

**Frontend** — a zero-build SPA (vanilla JS, one ${IB('app.js')}) with a dashboard, streaming chat, project CRUD, and interactive API docs. No bundler, no framework — but it maps 1:1 to React components if needed.

**Backend** — Node.js + Express. The API lives in ${IB('src/routes/')}: chat + conversations, projects CRUD, and stats/health. Validation, proper status codes, and a central error handler included.

**AI layer** — ${IB('src/services/llm.js')} exposes a provider interface. The ${IB('MockProvider')} streams crafted replies with realistic pacing; the ${IB('OpenAIProvider')} speaks the same interface against the real API. Setting ${IB('OPENAI_API_KEY')} flips the active provider at boot.

**Streaming** — ${IB('POST /api/chat')} responds with ${IB('text/event-stream')}. Each token is a JSON frame; the client reads it with ${IB('fetch')} + a ${IB('ReadableStream')} reader and paints tokens as they land. On completion, the message and its latency are persisted to the conversation.`;

const REACT_CODE = `Here's a clean, reusable stat-card component:

${CODE}jsx
import React from 'react';

export function StatCard({ label, value, hint, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__meta">
        <span className="stat-card__label">{label}</span>
        <strong className="stat-card__value">{value}</strong>
        {hint && <span className="stat-card__hint">{hint}</span>}
      </div>
    </div>
  );
}
${CODE}

It's fully presentational and driven by props, so it's trivial to test and reuse. Want a version with a loading skeleton, or hooked up to live data from ${IB('/api/stats')}?`;

const EXPRESS_CODE = `Here's a compact Express route with validation and error handling:

${CODE}js
const express = require('express');
const router = express.Router();

// POST /api/projects — create a project
router.post('/projects', async (req, res) => {
  const { title, description = '' } = req.body ?? {};
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: '"title" is required' });
  }
  const project = await db.projects.create({ title: title.trim(), description });
  res.status(201).json(project);
});

module.exports = router;
${CODE}

The pattern: validate at the edge, return honest status codes, and keep handlers thin so a central error middleware can catch anything that throws. That's exactly how ${IB('src/routes/projects.js')} in this app works.`;

const PYTHON_CODE = `Sure — here's the same idea in FastAPI:

${CODE}python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class Project(BaseModel):
    title: str
    description: str = ""
    status: str = "Planning"

@app.post("/projects", status_code=201)
def create_project(project: Project):
    if not project.title.strip():
        raise HTTPException(400, detail="title is required")
    return {"id": 1, **project.dict()}
${CODE}

Pydantic handles validation, so handlers stay tiny. Want the streaming-chat equivalent in Python (FastAPI + ${IB('StreamingResponse')})?`;

const EMAIL = `Here's a draft you can adapt:

**Subject:** Quick update — your project

Hi there,

Quick update on where things stand: the core API is live and the dashboard is fully wired up. Highlights this week:

- Streaming chat endpoint shipped (${IB('POST /api/chat')})
- Project CRUD and an activity feed, all over REST
- Average AI response latency is sitting around one second

Next up: real LLM provider integration and auth. Happy to jump on a quick call if you'd like a walkthrough.

Best,
Your name

---
Want it warmer, shorter, or more technical? I can also add a milestone table.`;

const SUMMARY = `Here's a tight summary of this workspace:

- **What it is** — a full-stack demo: an Express REST API plus a SPA with streaming AI chat and a project tracker
- **How the AI works** — a provider abstraction with a mock engine by default; one env var swaps in a real LLM
- **Proof it's real** — open the API Reference tab and run the endpoints yourself; every UI element on this page is powered by them

TL;DR: a small but complete picture of how production AI features get built.`;

const ROADMAP = `Here's a lean three-phase plan:

**Phase 1 — Foundation (week 1)**
- Scaffold the API and database schema
- Auth + project CRUD

**Phase 2 — AI layer (week 2)**
- Provider abstraction (mock → OpenAI)
- Streaming chat + conversation history

**Phase 3 — Polish (week 3)**
- Dashboard analytics and the activity feed
- Testing, docs, deployment

Each phase ends with something demoable — that's the rule. Want me to break a phase down into daily tasks?`;

const JOKE = `Why do AI assistants never get lost?

Because they always follow the **token** stream. 🌀

(Okay, that one streamed better in my head.)`;

function genericReply(question, model) {
  const topic = question.replace(/[?.!]+\s*$/, '').slice(0, 120);
  const opener = model.id === 'nexus-flash'
    ? `Quick take on **"${topic}"**:`
    : `Good one. Here's my structured take on **"${topic}"**:`;
  return `${opener}

**Where I'd start**
- Define the outcome — what does "done" look like?
- List the constraints: timeline, budget, stack, people
- Cut scope to the smallest slice that still proves the idea

**Then**
- Build that slice end-to-end — API, UI, data
- Put it in front of a real user and watch what confuses them
- Iterate on evidence, not opinions

*Heads up: I'm the demo's mock provider — deterministic replies, real streaming. Add an ${IB('OPENAI_API_KEY')} and this exact conversation gets real answers.*`;
}

/** Pick a contextual canned reply for the last user message. */
function craftReply(messages, model) {
  const q = String(messages[messages.length - 1]?.content ?? '').toLowerCase().trim();

  if (!q) return genericReply('that', model);
  if (/^(hi|hey|hello|yo|salaam|assalam|good (morning|afternoon|evening))\b/.test(q)) return GREETING;
  if (/(who are you|what are you|your name|introduce yourself|about yourself)/.test(q)) return INTRO;
  if (/(what can you do|your capabilit|how do you work|what do you do|^help$)/.test(q)) return CAPABILITIES;
  if (/\b(thanks|thank you|great job|awesome|nice work|perfect)\b/.test(q)) return THANKS;
  if (/(write|create|build|generate|show|give|make|example|snippet|implement|component|endpoint)/.test(q)
      && /(react|jsx|next\.?js|component)/.test(q)) return REACT_CODE;
  if (/(write|create|build|generate|show|give|make|example|snippet|implement)/.test(q)
      && /(python|fastapi|flask|django|pandas)/.test(q)) return PYTHON_CODE;
  if (/(write|create|build|generate|show|give|make|example|snippet|implement|route|endpoint)/.test(q)
      && /(express|node|api|rest|server|backend)/.test(q)) return EXPRESS_CODE;
  if (/(email|outreach|proposal|client update|follow.?up|message to)/.test(q)) return EMAIL;
  if (/(roadmap|milestone|sprint|timeline|project plan|\bplan\b)/.test(q)) return ROADMAP;
  if (/(summar|tl;?dr|recap|overview of this|what is this)/.test(q)) return SUMMARY;
  if (/(architect|stack|how (is|does|do|did)|how it works|built|tech|backend|frontend|database|deploy)/.test(q)) return ARCHITECTURE;
  if (/joke/.test(q)) return JOKE;
  return genericReply(q, model);
}

/* ─────────────────────────────── Providers ─────────────────────────────── */

/** Deterministic, realistic streaming engine — zero setup, zero cost. */
class MockProvider {
  id = 'mock';
  label = 'Mock streaming engine (no API key)';

  async *stream(messages, { model }) {
    const reply = craftReply(messages, model);
    const delay = Math.max(5, Math.round(1000 / model.wps));
    const tokens = reply.match(/\S+\s*/g) || [];
    for (const token of tokens) {
      await sleep(delay + Math.random() * 10);
      yield token;
    }
  }
}

/** Real LLM via the OpenAI-compatible chat completions API (streaming). */
class OpenAIProvider {
  id = 'openai';
  label = `OpenAI (${process.env.OPENAI_MODEL || 'gpt-4o-mini'})`;

  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async *stream(messages, { _model }) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        stream: true,
        messages: [
          { role: 'system', content: 'You are Nexus, a concise, friendly assistant inside a developer workspace demo.' },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    if (!res.ok || !res.body) throw new Error(`LLM request failed (${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch { /* ignore malformed frame */ }
      }
    }
  }
}

function getProvider() {
  return process.env.OPENAI_API_KEY
    ? new OpenAIProvider(process.env.OPENAI_API_KEY)
    : new MockProvider();
}

const provider = getProvider();

module.exports = { MODELS, getModel, getProvider, provider, MockProvider, OpenAIProvider };
