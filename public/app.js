/**
 * app.js — Nexus AI Workspace frontend (zero-build vanilla JS SPA)
 *
 * Views: Dashboard · AI Chat (SSE streaming) · Projects (CRUD) · API Reference
 * Talks to the Express API via fetch(); consumes the streaming chat endpoint
 * with a ReadableStream reader and paints tokens as they arrive.
 */
'use strict';

/* ───────────────────────────── helpers ─────────────────────────────── */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${sec % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

async function api(path, options = {}) {
  const res = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(message, type = 'success') {
  const root = $('#toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span class="toast-dot"></span><span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast--out');
    setTimeout(() => el.remove(), 320);
  }, 3400);
}

const statusSlug = (s) => ({ Planning: 'planning', 'In Progress': 'progress', Completed: 'completed' }[s] || 'planning');

/* ───────────────────────────── icons ───────────────────────────────── */

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  spark: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
};

const icon = (name, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ───────────────────────────── state ───────────────────────────────── */

const FALLBACK_MODELS = [
  { id: 'nexus-pro', name: 'Nexus Pro', description: 'Balanced quality' },
  { id: 'nexus-flash', name: 'Nexus Flash', description: 'Optimized for speed' },
];

const state = {
  view: null,
  models: FALLBACK_MODELS,
  model: 'nexus-pro',
  conversations: [],
  conversationId: null,
  messages: [],
  streaming: false,
  streamAbort: null,
  projects: [],
  projectFilter: 'All',
};

let streamBubble = null; // DOM node of the in-flight assistant bubble
let streamRaf = 0;

/* ──────────────────────── mini markdown ────────────────────────────── */

function codeBlockHtml({ lang, code }) {
  return `<div class="code-block"><div class="code-head"><span>${esc(lang)}</span><button class="code-copy" type="button">Copy</button></div><pre><code>${esc(code.replace(/\n$/, ''))}</code></pre></div>`;
}

function renderMarkdown(md, { streaming = false } = {}) {
  const blocks = [];
  const stash = (lang, code) => { blocks.push({ lang: lang || 'code', code }); return `\u0000B${blocks.length - 1}\u0000`; };

  let text = String(md ?? '');
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => stash(lang, code));
  text = text.replace(/```(\w*)\n([\s\S]*)$/g, (_m, lang, code) => stash(lang, code)); // unclosed fence while streaming
  text = esc(text);

  text = text
    .replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/^####?\s+(.+)$/gm, '<h5 class="md-h">$1</h5>');

  const html = text.split(/\n{2,}/).map((chunk) => {
    const block = chunk.trim();
    if (!block) return '';
    if (/^\u0000B\d+\u0000$/.test(block)) return block;
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => /^[-•]\s+/.test(l))) {
      return `<ul>${lines.map((l) => `<li>${l.replace(/^[-•]\s+/, '')}</li>`).join('')}</ul>`;
    }
    if (lines.length && lines.every((l) => /^\d+\.\s+/.test(l))) {
      return `<ol>${lines.map((l) => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('')}</ol>`;
    }
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  const withCodes = html.replace(/\u0000B(\d+)\u0000/g, (_m, i) => codeBlockHtml(blocks[Number(i)]));
  return streaming ? `${withCodes}<span class="caret"></span>` : withCodes;
}

/* ───────────────────────────── router ──────────────────────────────── */

const ROUTES = {
  dashboard: { title: 'Dashboard', sub: 'Workspace overview — metrics, activity, and system status', render: renderDashboard },
  chat: { title: 'AI Chat', sub: 'Replies stream token-by-token over Server-Sent Events from POST /api/chat', render: renderChat },
  projects: { title: 'Projects', sub: 'Full CRUD — every card below is powered by the REST API', render: renderProjects },
  api: { title: 'API Reference', sub: 'Interactive docs — run live requests against this very server', render: renderApiView },
};

function currentRoute() {
  const name = (location.hash || '#/dashboard').replace(/^#\/?/, '') || 'dashboard';
  return ROUTES[name] ? name : 'dashboard';
}

function navigate(view) {
  if (state.view === view) return;
  location.hash = `#/${view}`;
}

async function setView(name) {
  state.view = name;
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $('#view-title').textContent = ROUTES[name].title;
  $('#view-sub').textContent = ROUTES[name].sub;
  $('#view').innerHTML = '';
  await ROUTES[name].render();
}

/* ──────────────────────────── dashboard ────────────────────────────── */

async function renderDashboard() {
  const view = $('#view');
  view.innerHTML = `
    <section class="hero card">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="hero-content">
        <span class="hero-eyebrow">Full-stack demo · live on this server</span>
        <h2>${greeting()} — your workspace is streaming. <span class="grad-text">Nexus is online.</span></h2>
        <p>Express REST API · token-by-token AI chat · project CRUD · interactive API docs — one clean codebase, zero build step.</p>
        <div class="hero-actions">
          <button class="btn btn-primary" data-action="new-chat">${icon('chat', 15)} Start chatting</button>
          <button class="btn" data-action="new-project">${icon('plus', 15)} New project</button>
          <button class="btn" data-action="api">${icon('code', 15)} API docs</button>
        </div>
      </div>
    </section>

    <div class="stats-grid" id="stats-grid">
      <div class="card stat-card skeleton"></div><div class="card stat-card skeleton"></div>
      <div class="card stat-card skeleton"></div><div class="card stat-card skeleton"></div>
    </div>

    <div class="dash-grid">
      <section class="card dash-panel">
        <div class="card-head"><h3>Recent activity</h3><span class="small muted">from /api/stats</span></div>
        <div id="activity-list">
          <div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div>
          <div class="skeleton-line"></div><div class="skeleton-line"></div>
        </div>
      </section>
      <section class="card dash-panel">
        <div class="card-head"><h3>On the board</h3><button class="link-btn" data-action="projects">View all →</button></div>
        <div id="dash-projects">
          <div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div>
        </div>
      </section>
      <section class="card dash-panel">
        <div class="card-head"><h3>System</h3></div>
        <div id="system-panel" class="kv-list">
          <div class="skeleton-line"></div><div class="skeleton-line"></div>
        </div>
      </section>
    </div>`;

  try {
    renderStats(await api('/stats'));
    if (window.__statsTimer) clearInterval(window.__statsTimer);
    window.__statsTimer = setInterval(async () => {
      if (!document.body.contains($('#stats-grid'))) { clearInterval(window.__statsTimer); return; }
      try { renderStats(await api('/stats')); } catch { /* ignore */ }
    }, 10000);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderStats(stats) {
  const cards = [
    { label: 'Conversations', value: stats.conversations, icon: 'chat', sub: `${stats.messages} messages exchanged` },
    { label: 'Projects', value: stats.projects, icon: 'folder', sub: `${stats.projectsByStatus['In Progress']} in progress · ${stats.projectsByStatus.Planning} planning` },
    { label: 'Avg AI response', value: stats.avgResponseMs ? `${(stats.avgResponseMs / 1000).toFixed(1)}s` : '—', icon: 'zap', sub: 'streamed, first token to last' },
    { label: 'API uptime', value: fmtDur(stats.system.uptimeSec), icon: 'activity', sub: stats.system.provider },
  ];
  $('#stats-grid').innerHTML = cards.map((c) => `
    <div class="card stat-card">
      <div class="stat-icon">${icon(c.icon)}</div>
      <div class="stat-meta">
        <span class="stat-label">${c.label}</span>
        <strong class="stat-value">${c.value}</strong>
        <span class="stat-sub">${esc(c.sub)}</span>
      </div>
    </div>`).join('');

  $('#activity-list').innerHTML = stats.activity.length
    ? stats.activity.map((a) => `
      <div class="activity-item">
        <span class="activity-dot t-${esc(a.type)}"></span>
        <div>
          <p>${esc(a.text)}</p>
          <span class="small muted">${timeAgo(a.at)}</span>
        </div>
      </div>`).join('')
    : '<p class="muted">No activity yet — start a chat or create a project.</p>';

  $('#dash-projects').innerHTML = stats.projectsPreview.length
    ? stats.projectsPreview.map((p) => `
      <button class="mini-project" data-action="projects">
        <span class="status-dot s-${statusSlug(p.status)}"></span>
        <div>
          <strong>${esc(p.title)}</strong>
          <span class="small muted">${esc(p.status)} · ${timeAgo(p.updatedAt)}</span>
        </div>
      </button>`).join('')
    : '<p class="muted">No projects yet.</p>';

  $('#system-panel').innerHTML = `
    <div class="kv"><span>AI provider</span><strong>${esc(stats.system.provider)}</strong></div>
    <div class="kv"><span>Models</span><strong>${stats.system.models} streaming profiles</strong></div>
    <div class="kv"><span>Node</span><strong>${esc(stats.system.node)}</strong></div>
    <div class="kv"><span>Uptime</span><strong>${fmtDur(stats.system.uptimeSec)}</strong></div>
    <div class="kv"><span>Data</span><strong>In-memory store (seeded)</strong></div>`;
}

/* ─────────────────────────────── chat ──────────────────────────────── */

async function renderChat() {
  const view = $('#view');
  view.innerHTML = `
    <div class="chat-layout">
      <aside class="panel conv-panel">
        <button class="btn btn-primary btn-block" data-action="new-chat-conv">${icon('plus', 15)} New chat</button>
        <div class="conv-list" id="conv-list"></div>
      </aside>

      <section class="panel chat-panel">
        <header class="chat-header">
          <div class="chat-title">
            <h3 id="chat-conv-title">New conversation</h3>
            <span class="small muted" id="chat-conv-meta">replies stream token-by-token</span>
          </div>
          <div class="chat-controls">
            <select id="model-select" class="select" title="Model profile"></select>
            <button class="icon-btn" data-action="delete-conversation" id="delete-conv-btn" title="Delete conversation" disabled>${icon('trash', 15)}</button>
          </div>
        </header>

        <div class="chat-messages" id="chat-messages"></div>

        <div class="chat-composer">
          <div class="composer-card">
            <textarea id="composer-input" rows="1" placeholder="Message Nexus…"></textarea>
            <button class="send-btn" id="send-btn" data-action="send" title="Send">${icon('send', 16)}</button>
          </div>
          <p class="composer-hint">Enter to send · Shift+Enter for a new line · stop generation anytime</p>
        </div>
      </section>
    </div>`;

  const input = $('#composer-input');
  input.addEventListener('input', () => autosize(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  const modelSelect = $('#model-select');
  modelSelect.innerHTML = state.models
    .map((m) => `<option value="${esc(m.id)}" ${m.id === state.model ? 'selected' : ''}>${esc(m.name)}</option>`)
    .join('');
  modelSelect.addEventListener('change', () => { state.model = modelSelect.value; });

  await refreshConversations();
  if (state.conversationId) {
    await openConversation(state.conversationId, { silent: true });
  } else {
    renderMessages();
  }
  input.focus();
}

function autosize(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

async function refreshConversations() {
  try { state.conversations = await api('/conversations'); } catch { return; }
  renderConvList();
  const title = $('#chat-conv-title');
  if (!title) return;
  const current = state.conversations.find((c) => c.id === state.conversationId);
  if (current) {
    title.textContent = current.title;
    $('#chat-conv-meta').textContent = `${current.messageCount} messages · updated ${timeAgo(current.updatedAt)}`;
    $('#delete-conv-btn').disabled = false;
  } else {
    title.textContent = 'New conversation';
    $('#chat-conv-meta').textContent = 'replies stream token-by-token';
    $('#delete-conv-btn').disabled = true;
  }
}

function renderConvList() {
  const list = $('#conv-list');
  if (!list) return;
  if (!state.conversations.length) {
    list.innerHTML = '<p class="muted small conv-empty">No conversations yet.</p>';
    return;
  }
  list.innerHTML = state.conversations.map((c) => `
    <button class="conv-item ${c.id === state.conversationId ? 'active' : ''}" data-action="open-conversation" data-id="${c.id}">
      <strong>${esc(c.title)}</strong>
      <span class="small muted">${c.messageCount} msgs · ${timeAgo(c.updatedAt)}</span>
    </button>`).join('');
}

async function openConversation(id, { silent = false } = {}) {
  try {
    const conv = await api(`/conversations/${id}`);
    state.conversationId = conv.id;
    state.messages = conv.messages;
    renderMessages();
    renderConvList();
    const current = state.conversations.find((c) => c.id === conv.id);
    if (current) {
      $('#chat-conv-title').textContent = current.title;
      $('#chat-conv-meta').textContent = `${current.messageCount} messages · updated ${timeAgo(current.updatedAt)}`;
      $('#delete-conv-btn').disabled = false;
    }
  } catch (err) {
    if (!silent) toast(err.message, 'error');
    state.conversationId = null;
    state.messages = [];
    renderMessages();
    renderConvList();
  }
}

function startNewChat() {
  state.conversationId = null;
  state.messages = [];
  renderMessages();
  renderConvList();
  const title = $('#chat-conv-title');
  if (title) {
    title.textContent = 'New conversation';
    $('#chat-conv-meta').textContent = 'replies stream token-by-token';
    $('#delete-conv-btn').disabled = true;
  }
  $('#composer-input')?.focus();
}

function welcomeHtml() {
  const chips = [
    { label: 'Explain the architecture', prompt: 'How is this app built? Explain the architecture.' },
    { label: 'Write a React component', prompt: 'Write a React stat-card component.' },
    { label: 'Draft a client email', prompt: 'Draft a client update email for the analytics project.' },
    { label: 'Plan a roadmap', prompt: 'Give me a roadmap for the support copilot project.' },
  ];
  return `
    <div class="chat-welcome">
      <div class="welcome-glyph">${icon('spark', 24)}</div>
      <h3>How can I help today?</h3>
      <p class="muted">Pick a starter or type anything — replies stream live from <code class="inline">POST /api/chat</code>.</p>
      <div class="chips">
        ${chips.map((c) => `<button class="chip" data-action="use-prompt" data-prompt="${esc(c.prompt)}">${esc(c.label)}</button>`).join('')}
      </div>
    </div>`;
}

function messageEl(m, { caret = false } = {}) {
  const el = document.createElement('div');
  el.className = `msg msg--${m.role}`;
  const avatar = m.role === 'user'
    ? `<div class="avatar avatar-user">${icon('user', 14)}</div>`
    : `<div class="avatar avatar-ai">${icon('spark', 14)}</div>`;
  const body = m.role === 'user'
    ? `<div class="bubble bubble-user">${esc(m.content).replace(/\n/g, '<br>')}</div>`
    : `<div class="bubble bubble-ai">${renderMarkdown(m.content, { streaming: caret })}</div>`;
  const meta = m.role === 'assistant' && m.model
    ? `${modelName(m.model)} · ${timeAgo(m.createdAt)}`
    : timeAgo(m.createdAt);
  el.innerHTML = `${avatar}<div class="msg-col">${body}<span class="msg-meta">${esc(meta)}</span></div>`;
  return el;
}

function modelName(id) {
  return state.models.find((m) => m.id === id)?.name || id;
}

function renderMessages() {
  const box = $('#chat-messages');
  if (!box) return;
  if (!state.messages.length) {
    box.innerHTML = welcomeHtml();
    return;
  }
  box.innerHTML = '';
  state.messages.forEach((m) => box.appendChild(messageEl(m)));
  scrollChat(true);
}

function scrollChat(force) {
  const box = $('#chat-messages');
  if (!box) return;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  if (force || nearBottom) box.scrollTop = box.scrollHeight;
}

function showTyping() {
  const box = $('#chat-messages');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'msg msg--assistant';
  el.id = 'typing-row';
  el.innerHTML = `<div class="avatar avatar-ai">${icon('spark', 14)}</div>
    <div class="msg-col"><div class="bubble bubble-ai typing"><span></span><span></span><span></span></div></div>`;
  box.appendChild(el);
  scrollChat(true);
}

function hideTyping() {
  $('#typing-row')?.remove();
}

function setSendState() {
  const btn = $('#send-btn');
  if (!btn) return;
  btn.innerHTML = state.streaming ? icon('stop', 15) : icon('send', 16);
  btn.classList.toggle('streaming', state.streaming);
  btn.title = state.streaming ? 'Stop generating' : 'Send';
}

async function sendMessage() {
  const input = $('#composer-input');
  if (!input || state.streaming) return;
  const text = input.value.trim();
  if (!text) return;

  state.messages.push({ role: 'user', content: text, createdAt: Date.now() });
  const box = $('#chat-messages');
  if (box) {
    if (!state.messages.length || state.messages.length === 1) box.innerHTML = '';
    box.appendChild(messageEl(state.messages[state.messages.length - 1]));
    scrollChat(true);
  }
  input.value = '';
  autosize(input);
  input.focus();

  state.streaming = true;
  setSendState();
  showTyping();

  const controller = new AbortController();
  state.streamAbort = controller;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: state.conversationId, message: text, model: state.model }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${res.status})`);
    }
    await readSseStream(res, handleStreamEvent);
  } catch (err) {
    if (err.name === 'AbortError') {
      toast('Generation stopped', 'info');
      finalizeStream();
    } else {
      hideTyping();
      toast(err.message, 'error');
    }
  } finally {
    state.streaming = false;
    state.streamAbort = null;
    setSendState();
    refreshConversations();
  }
}

/** Read an SSE response body from a fetch() and dispatch each data frame. */
async function readSseStream(res, onEvent) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      try { onEvent(JSON.parse(dataLine.slice(5).trim())); } catch { /* ignore malformed frame */ }
    }
  }
}

function handleStreamEvent(evt) {
  if (evt.type === 'meta') {
    state.conversationId = evt.conversationId;
    hideTyping();
    const msg = { role: 'assistant', content: '', model: evt.model, createdAt: Date.now() };
    state.messages.push(msg);
    const box = $('#chat-messages');
    if (box) {
      const el = messageEl(msg, { caret: true });
      box.appendChild(el);
      streamBubble = el.querySelector('.bubble-ai');
      scrollChat(true);
    }
  } else if (evt.type === 'token') {
    const msg = state.messages[state.messages.length - 1];
    if (msg && msg.role === 'assistant') msg.content += evt.token;
    if (streamBubble && !streamRaf) {
      streamRaf = requestAnimationFrame(() => {
        streamRaf = 0;
        if (!streamBubble) return;
        const current = state.messages[state.messages.length - 1];
        if (current?.role === 'assistant') {
          streamBubble.innerHTML = renderMarkdown(current.content, { streaming: true });
        }
        scrollChat(false);
      });
    }
  } else if (evt.type === 'done') {
    const msg = state.messages[state.messages.length - 1];
    if (msg && msg.role === 'assistant') {
      msg.responseMs = evt.usage?.responseMs;
      msg.createdAt = Date.now();
    }
    finalizeStream();
  } else if (evt.type === 'error') {
    toast(evt.error, 'error');
  }
}

function finalizeStream() {
  const msg = state.messages[state.messages.length - 1];
  if (streamBubble && msg?.role === 'assistant') {
    streamBubble.innerHTML = renderMarkdown(msg.content);
  }
  streamBubble = null;
  hideTyping();
}

async function deleteCurrentConversation() {
  if (!state.conversationId) return;
  const ok = await customConfirm('Delete this conversation?', 'The conversation and all its messages will be removed.');
  if (!ok) return;
  try {
    await api(`/conversations/${state.conversationId}`, { method: 'DELETE' });
    toast('Conversation deleted');
    startNewChat();
    refreshConversations();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ──────────────────────────── projects ─────────────────────────────── */

async function renderProjects() {
  const view = $('#view');
  const filters = ['All', 'Planning', 'In Progress', 'Completed'];
  view.innerHTML = `
    <div class="toolbar">
      <div class="filter-row" id="project-filters">
        ${filters.map((f) => `<button class="filter-chip ${f === state.projectFilter ? 'active' : ''}" data-action="filter-project" data-filter="${f}">${f}</button>`).join('')}
      </div>
      <button class="btn btn-primary" data-action="add-project">${icon('plus', 15)} New project</button>
    </div>
    <div class="projects-grid" id="projects-grid">
      <div class="card proj-skeleton skeleton"></div><div class="card proj-skeleton skeleton"></div>
      <div class="card proj-skeleton skeleton"></div>
    </div>`;

  try {
    state.projects = await api('/projects');
  } catch (err) {
    toast(err.message, 'error');
    state.projects = [];
  }
  renderProjectGrid();
}

function renderProjectGrid() {
  const grid = $('#projects-grid');
  if (!grid) return;
  const filtered = state.projectFilter === 'All'
    ? state.projects
    : state.projects.filter((p) => p.status === state.projectFilter);

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty card">
        <p>No projects${state.projectFilter !== 'All' ? ' in this status' : ''} yet.</p>
        <button class="btn" data-action="add-project">${icon('plus', 15)} Create the first one</button>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((p) => `
    <article class="card project-card">
      <header>
        <span class="badge b-${statusSlug(p.status)}">${esc(p.status)}</span>
        <div class="card-actions">
          <button class="icon-btn" data-action="edit-project" data-id="${p.id}" title="Edit">${icon('edit', 14)}</button>
          <button class="icon-btn danger" data-action="delete-project" data-id="${p.id}" title="Delete">${icon('trash', 14)}</button>
        </div>
      </header>
      <h4>${esc(p.title)}</h4>
      <p class="muted">${esc(p.description) || '<em>No description</em>'}</p>
      <footer>
        <div class="tag-row">${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <span class="small muted">updated ${timeAgo(p.updatedAt)}</span>
      </footer>
    </article>`).join('');
}

function openProjectModal(project) {
  const isEdit = Boolean(project);
  openModal(`
    <h3>${isEdit ? 'Edit project' : 'New project'}</h3>
    <form id="project-form" class="form">
      <label>Title
        <input name="title" required maxlength="80" placeholder="e.g. Support Copilot v2" value="${esc(project?.title || '')}" />
      </label>
      <label>Description
        <textarea name="description" rows="3" maxlength="280" placeholder="What is this project about?">${esc(project?.description || '')}</textarea>
      </label>
      <div class="form-row">
        <label>Status
          <select name="status">
            ${['Planning', 'In Progress', 'Completed'].map((s) => `<option ${project?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        <label>Tags <span class="small muted">(comma-separated)</span>
          <input name="tags" placeholder="React, API, LLM" value="${esc((project?.tags || []).join(', '))}" />
        </label>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Create project'}</button>
      </div>
    </form>`);

  $('#project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      title: fd.get('title'),
      description: fd.get('description'),
      status: fd.get('status'),
      tags: String(fd.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (isEdit) {
        await api(`/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Project updated');
      } else {
        await api('/projects', { method: 'POST', body: JSON.stringify(payload) });
        toast('Project created');
      }
      closeModal();
      state.projects = await api('/projects');
      renderProjectGrid();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function deleteProject(id) {
  const project = state.projects.find((p) => p.id === id);
  if (!project) return;
  const ok = await customConfirm(`Delete “${project.title}”?`, 'This removes the project from the board. This action cannot be undone.');
  if (!ok) return;
  try {
    await api(`/projects/${id}`, { method: 'DELETE' });
    toast('Project deleted');
    state.projects = await api('/projects');
    renderProjectGrid();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ─────────────────────────── api reference ─────────────────────────── */

const API_GROUPS = [
  {
    name: 'System',
    endpoints: [
      { method: 'GET', path: '/api/health', desc: 'Service health, uptime, and the active AI provider.', run: true },
      { method: 'GET', path: '/api/stats', desc: 'Workspace metrics: conversations, messages, projects, activity feed.', run: true },
      { method: 'GET', path: '/api/models', desc: 'Available model profiles and the active provider.', run: true },
    ],
  },
  {
    name: 'AI Chat',
    endpoints: [
      { method: 'GET', path: '/api/conversations', desc: 'List all conversations, most recent first.', run: true },
      { method: 'GET', path: '/api/conversations/:id', desc: 'Full message history for one conversation.' },
      { method: 'POST', path: '/api/chat', desc: 'Send a message — the reply streams back as Server-Sent Events.', body: { conversationId: null, message: 'How does this app work?', model: 'nexus-pro' } },
      { method: 'DELETE', path: '/api/conversations/:id', desc: 'Delete a conversation and its messages.' },
    ],
  },
  {
    name: 'Projects',
    endpoints: [
      { method: 'GET', path: '/api/projects', desc: 'List all projects.', run: true },
      { method: 'POST', path: '/api/projects', desc: 'Create a project.', body: { title: 'New integration', description: 'Connect the billing API', status: 'Planning', tags: ['API'] } },
      { method: 'PATCH', path: '/api/projects/:id', desc: 'Update any project field.', body: { status: 'Completed' } },
      { method: 'DELETE', path: '/api/projects/:id', desc: 'Delete a project.' },
    ],
  },
];

function renderApiView() {
  const view = $('#view');
  view.innerHTML = `
    <p class="muted api-intro">Every endpoint below is served by this exact app — press <strong>Run</strong> to fire a live request and inspect the JSON.</p>
    ${API_GROUPS.map((group) => `
      <section class="api-group">
        <h3>${esc(group.name)}</h3>
        ${group.endpoints.map((e) => `
          <div class="card endpoint-card">
            <div class="endpoint-row">
              <span class="method m-${e.method}">${e.method}</span>
              <code class="endpoint-path">${esc(e.path)}</code>
              <span class="muted endpoint-desc">${esc(e.desc)}</span>
              ${e.run ? `<button class="btn btn-sm" data-action="run-endpoint" data-path="${esc(e.path)}">${icon('play', 12)} Run</button>` : ''}
            </div>
            ${e.body ? `<details class="endpoint-body"><summary>Request body</summary><pre>${esc(JSON.stringify(e.body, null, 2))}</pre></details>` : ''}
            <div class="endpoint-response" hidden></div>
          </div>`).join('')}
      </section>`).join('')}`;
}

async function runEndpoint(path, btn) {
  const card = btn.closest('.endpoint-card');
  const out = card.querySelector('.endpoint-response');
  out.hidden = false;
  out.innerHTML = '<div class="resp-muted muted resp-meta">Running…</div>';
  const t0 = performance.now();
  try {
    const data = await api(path);
    const ms = Math.round(performance.now() - t0);
    out.innerHTML = `<div class="resp-meta ok">200 OK · ${ms} ms</div><pre>${esc(JSON.stringify(data, null, 2))}</pre>`;
  } catch (err) {
    out.innerHTML = `<div class="resp-meta err">${esc(err.message)}</div>`;
  }
}

/* ──────────────────────────── modal & confirm ──────────────────────── */

let modalDismiss = null;

function openModal(inner) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-overlay" data-action="overlay-close"><div class="modal">${inner}</div></div>`;
  document.body.classList.add('modal-open');
  modalDismiss = null;
  setTimeout(() => root.querySelector('input, textarea, select')?.focus(), 60);
}

function closeModal() {
  if (modalDismiss) modalDismiss();
  modalDismiss = null;
  $('#modal-root').innerHTML = '';
  document.body.classList.remove('modal-open');
}

function customConfirm(title, message) {
  return new Promise((resolve) => {
    openModal(`
      <h3>${esc(title)}</h3>
      <p class="muted">${esc(message)}</p>
      <div class="modal-actions">
        <button class="btn" id="confirm-cancel">Cancel</button>
        <button class="btn btn-danger" id="confirm-ok">Delete</button>
      </div>`);
    modalDismiss = () => resolve(false);
    $('#confirm-cancel').addEventListener('click', () => { closeModal(); resolve(false); });
    $('#confirm-ok').addEventListener('click', () => { closeModal(); resolve(true); });
  });
}

/* ─────────────────────────── global events ─────────────────────────── */

document.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('.code-copy');
  if (copyBtn) {
    const code = copyBtn.closest('.code-block')?.querySelector('code')?.textContent || '';
    navigator.clipboard?.writeText(code)
      .then(() => toast('Code copied to clipboard'))
      .catch(() => {});
    return;
  }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  const id = el.dataset.id;

  switch (action) {
    case 'new-chat': navigate('chat'); break;
    case 'api': navigate('api'); break;
    case 'projects': navigate('projects'); break;
    case 'new-project': navigate('projects'); openProjectModal(null); break;

    case 'new-chat-conv': startNewChat(); break;
    case 'open-conversation': openConversation(id); break;
    case 'delete-conversation': deleteCurrentConversation(); break;
    case 'use-prompt': {
      const input = $('#composer-input');
      if (input) { input.value = el.dataset.prompt; autosize(input); }
      sendMessage();
      break;
    }
    case 'send':
      if (state.streaming) state.streamAbort?.abort();
      else sendMessage();
      break;

    case 'add-project': openProjectModal(null); break;
    case 'edit-project': openProjectModal(state.projects.find((p) => p.id === id)); break;
    case 'delete-project': deleteProject(id); break;
    case 'filter-project': {
      state.projectFilter = el.dataset.filter;
      $$('.filter-chip').forEach((c) => c.classList.toggle('active', c.dataset.filter === state.projectFilter));
      renderProjectGrid();
      break;
    }

    case 'run-endpoint': runEndpoint(el.dataset.path, el); break;

    case 'close-modal': closeModal(); break;
    case 'overlay-close': if (e.target === el) closeModal(); break;
    default: break;
  }
});

$('#nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-item');
  if (btn) navigate(btn.dataset.view);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

window.addEventListener('hashchange', () => setView(currentRoute()));

/* ──────────────────────────── health poll ──────────────────────────── */

async function pollHealth() {
  const pill = $('#status-pill');
  const text = $('#status-text');
  if (!pill || !text) return;
  try {
    const h = await api('/health');
    pill.classList.remove('offline');
    pill.classList.add('online');
    text.textContent = `${h.provider.split('(')[0].trim()} · up ${fmtDur(h.uptimeSec)}`;
  } catch {
    pill.classList.remove('online');
    pill.classList.add('offline');
    text.textContent = 'API offline';
  }
}

/* ─────────────────────────────── boot ──────────────────────────────── */

(async function boot() {
  pollHealth();
  setInterval(pollHealth, 20000);

  try {
    const res = await api('/models');
    if (res.models?.length) state.models = res.models;
    if (!state.models.some((m) => m.id === state.model)) state.model = state.models[0]?.id;
  } catch { /* keep fallback models */ }

  await setView(currentRoute());
})();
