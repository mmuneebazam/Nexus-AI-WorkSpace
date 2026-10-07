/**
 * store.js — in-memory data store with seeded demo data.
 * Kept framework-free on purpose — swap for Postgres/Mongo + an ORM in production.
 */
const crypto = require('node:crypto');

const uid = () => crypto.randomUUID();
const STATUSES = ['Planning', 'In Progress', 'Completed'];

const conversations = new Map(); // id → conversation
const projects = new Map(); // id → project
const activity = []; // newest first

function logActivity(type, text) {
  activity.unshift({ id: uid(), type, text, at: Date.now() });
  if (activity.length > 40) activity.length = 40;
}

/* ────────────────────────────── seed data ────────────────────────────── */

const SEED_PROJECTS = [
  { title: 'Customer Support Copilot', description: 'AI assistant that drafts support replies grounded in help-center articles.', status: 'In Progress', tags: ['LLM', 'RAG', 'Node.js'], hoursAgo: 0.7 },
  { title: 'Analytics Dashboard Refresh', description: 'Rebuild the reporting UI with realtime charts and role-based views.', status: 'Planning', tags: ['React', 'Charts'], hoursAgo: 5 },
  { title: 'Invoice OCR Pipeline', description: 'Extract line items from scanned invoices and push them to the ERP.', status: 'In Progress', tags: ['Python', 'OCR', 'API'], hoursAgo: 26 },
  { title: 'Agency Website Redesign', description: 'Marketing site with CMS-driven case studies and a contact flow.', status: 'Completed', tags: ['React', 'CSS'], hoursAgo: 50 },
  { title: 'Lead Enrichment API', description: 'Enrich inbound leads with firmographics before they hit the CRM.', status: 'Planning', tags: ['Node.js', 'REST'], hoursAgo: 70 },
];

for (const seed of SEED_PROJECTS) {
  const ts = Date.now() - seed.hoursAgo * 3600 * 1000;
  const id = uid();
  projects.set(id, {
    id,
    title: seed.title,
    description: seed.description,
    status: seed.status,
    tags: seed.tags,
    createdAt: ts,
    updatedAt: ts,
  });
}
logActivity('system', 'Workspace initialized · 5 demo projects seeded');
logActivity('system', 'Mock LLM provider active (set OPENAI_API_KEY for a real model)');

/* ───────────────────────────── conversations ──────────────────────────── */

function listConversations() {
  return [...conversations.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((c) => ({
      id: c.id,
      title: c.title,
      messageCount: c.messages.length,
      lastModel: [...c.messages].reverse().find((m) => m.model)?.model || null,
      updatedAt: c.updatedAt,
    }));
}

function getConversation(id) {
  return conversations.get(id) || null;
}

function getOrCreateConversation(id, firstMessage) {
  if (id && conversations.has(id)) return conversations.get(id);
  const title = firstMessage.length > 52 ? `${firstMessage.slice(0, 52)}…` : firstMessage;
  const conversation = { id: uid(), title, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  conversations.set(conversation.id, conversation);
  logActivity('chat', `New conversation started — “${title}”`);
  return conversation;
}

function appendMessage(conversationId, { role, content, model = null, responseMs = null }) {
  const conversation = conversations.get(conversationId);
  if (!conversation) return null;
  const message = { id: uid(), role, content, model, responseMs, createdAt: Date.now() };
  conversation.messages.push(message);
  conversation.updatedAt = Date.now();
  return message;
}

function deleteConversation(id) {
  const conversation = conversations.get(id);
  if (!conversation) return false;
  conversations.delete(id);
  logActivity('chat', `Conversation deleted — “${conversation.title}”`);
  return true;
}

/* ─────────────────────────────── projects ─────────────────────────────── */

function listProjects() {
  return [...projects.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

function getProject(id) {
  return projects.get(id) || null;
}

function createProject({ title, description, status, tags }) {
  const project = {
    id: uid(), title, description, status, tags,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  projects.set(project.id, project);
  logActivity('project', `Project created — “${title}”`);
  return project;
}

function updateProject(id, patch) {
  const project = projects.get(id);
  if (!project) return null;
  Object.assign(project, patch, { updatedAt: Date.now() });
  logActivity('project', `Project updated — “${project.title}”`);
  return project;
}

function deleteProject(id) {
  const project = projects.get(id);
  if (!project) return false;
  projects.delete(id);
  logActivity('project', `Project deleted — “${project.title}”`);
  return true;
}

/* ─────────────────────────── stats & activity ─────────────────────────── */

function listActivity(limit = 12) {
  return activity.slice(0, limit);
}

function getStats(system) {
  let messageCount = 0;
  let responseTotal = 0;
  let responseCount = 0;
  conversations.forEach((c) => {
    messageCount += c.messages.length;
    c.messages.forEach((m) => {
      if (m.role === 'assistant' && typeof m.responseMs === 'number') {
        responseTotal += m.responseMs;
        responseCount += 1;
      }
    });
  });

  const allProjects = listProjects();
  return {
    conversations: conversations.size,
    messages: messageCount,
    projects: allProjects.length,
    projectsByStatus: STATUSES.reduce((acc, s) => ({
      ...acc,
      [s]: allProjects.filter((p) => p.status === s).length,
    }), {}),
    avgResponseMs: responseCount ? Math.round(responseTotal / responseCount) : null,
    activity: listActivity(),
    projectsPreview: allProjects.slice(0, 3).map((p) => ({
      id: p.id, title: p.title, status: p.status, updatedAt: p.updatedAt,
    })),
    system,
  };
}

module.exports = {
  STATUSES,
  logActivity,
  listConversations,
  getConversation,
  getOrCreateConversation,
  appendMessage,
  deleteConversation,
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listActivity,
  getStats,
};
