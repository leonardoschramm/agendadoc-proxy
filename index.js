const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const N8N_WEBHOOK = 'https://primary-production-26151.up.railway.app/webhook/agendadoccomercialmedico';
const respostas = {};

// ─── ENTRADA: Simulador → N8N ─────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  try {
    let payload = req.body;
    let forward = payload;
    if (Array.isArray(payload) && payload.length > 0 && payload[0].body) {
      forward = payload[0].body;
    }
    const r = await axios.post(N8N_WEBHOOK, forward, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ erro: err.message });
  }
});

// ─── SAÍDA: N8N → Proxy ───────────────────────────────────────────────────
app.post('/resposta', (req, res) => {
  const body  = req.body;
  const tel   = (body.telefone || body.number || body.to || body.phone || '').toString().replace('@s.whatsapp.net','').replace('@lid','');
  const texto = body.texto || body.text || body.body || body.message || body.mensagem || '';

  console.log('[resposta] recebido tel:', tel, '| texto:', texto.substring(0,60));

  if (!tel || !texto) {
    return res.status(400).json({ erro: 'Campos obrigatorios: telefone (ou number) e texto (ou text)', recebido: Object.keys(body) });
  }

  if (!respostas[tel]) respostas[tel] = [];
  respostas[tel].push({ texto, ts: Date.now() });
  if (respostas[tel].length > 20) respostas[tel].shift();

  res.json({ ok: true, telefone: tel });
});

// ─── POLLING: busca respostas após timestamp ───────────────────────────────
// GET /buscar-resposta?telefone=xxx&apos=ts
app.get('/buscar-resposta', (req, res) => {
  const tel    = (req.query.telefone || '').replace('@s.whatsapp.net','').replace('@lid','');
  const aposTs = parseInt(req.query.apos) || 0;
  if (!tel) return res.status(400).json({ erro: 'Parametro telefone obrigatorio' });

  const msgs = (respostas[tel] || []).filter(m => m.ts > aposTs);
  if (msgs.length > 0) {
    return res.json({ encontrado: true, mensagens: msgs, total: msgs.length });
  }
  res.json({ encontrado: false, mensagens: [], total: 0 });
});

// ─── LIMPAR: remove mensagens já lidas (evita poluição no próximo turno) ──
// DELETE /limpar?telefone=xxx&ate=ts
app.delete('/limpar', (req, res) => {
  const tel  = (req.query.telefone || '').replace('@s.whatsapp.net','').replace('@lid','');
  const ateTs = parseInt(req.query.ate) || Date.now();
  if (!tel) return res.status(400).json({ erro: 'Parametro telefone obrigatorio' });

  if (respostas[tel]) {
    respostas[tel] = respostas[tel].filter(m => m.ts > ateTs);
  }
  res.json({ ok: true, restantes: (respostas[tel] || []).length });
});

// ─── DEBUG ────────────────────────────────────────────────────────────────
app.get('/debug', (_, res) => res.json({ respostas }));

// ─── HEALTH ────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, version: '4.0' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy AgendaDoc v4 rodando na porta ${PORT}`));
