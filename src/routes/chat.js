/**
 * chat.js — conversations + the streaming chat endpoint.
 *
 * POST /api/chat
 *   body: { conversationId?: string, message: string, model?: string }
 *   response: text/event-stream
 *     data: {"type":"meta","conversationId":"…","model":"nexus-pro"}
 *     data: {"type":"token","token":"…"}        (many)
 *     data: {"type":"done","usage":{…}}
 */
const router = require('express').Router();
const store = require('../data/store');
const llm = require('../services/llm');

router.get('/conversations', (_req, res) => {
  res.json(store.listConversations());
});

router.get('/conversations/:id', (req, res) => {
  const conversation = store.getConversation(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  res.json(conversation);
});

router.delete('/conversations/:id', (req, res) => {
  const ok = store.deleteConversation(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Conversation not found' });
  res.json({ ok: true });
});

router.post('/chat', async (req, res) => {
  const { conversationId = null, message, model: modelId } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: '"message" is required and must be a non-empty string' });
  }
  const model = llm.getModel(modelId);

  const conversation = store.getOrCreateConversation(conversationId, message.trim());
  store.appendMessage(conversation.id, { role: 'user', content: message.trim() });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (payload) => {
    try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch { /* client gone */ }
  };

  // Track premature client disconnects via the response (NOT req.destroyed,
  // which reads true once the request body has been consumed).
  let clientGone = false;
  res.on('close', () => { clientGone = true; });

  send({ type: 'meta', conversationId: conversation.id, model: model.id, modelName: model.name });

  const startedAt = Date.now();
  let full = '';
  try {
    for await (const token of llm.provider.stream(conversation.messages, { model })) {
      if (clientGone) break; // client disconnected mid-stream
      full += token;
      send({ type: 'token', token });
    }
  } catch (err) {
    console.error('LLM stream error:', err.message);
    send({ type: 'error', error: 'The AI provider failed mid-stream.' });
  }

  const responseMs = Date.now() - startedAt;
  const saved = store.appendMessage(conversation.id, {
    role: 'assistant',
    content: full || '(empty reply)',
    model: model.id,
    responseMs,
  });
  store.logActivity('chat', `${model.name} replied in “${conversation.title}” (${responseMs} ms)`);

  send({
    type: 'done',
    messageId: saved.id,
    usage: { tokens: full.split(/\s+/).filter(Boolean).length, responseMs, model: model.id },
  });
  res.end();
});

module.exports = router;
