const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const N8N_WEBHOOK = 'https://primary-production-26151.up.railway.app/webhook/agendadoccomercialmedico';

// Armazena respostas do AgendaDoc por telefone
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

// ─── SAÍDA: N8N envia resposta aqui ───────────────────────────────────────
// Aceita qualquer combinação de nomes de campo:
//   { telefone, texto }   ← padrão do proxy
//   { number, text }      ← formato Evolution API (como o N8N envia)
//   { to, body }          ← variações possíveis
app.post('/resposta', (req, res) => {
  const body = req.body;

  const tel  = body.telefone || body.number || body.to || body.phone || null;
  const texto = body.texto   || body.text   || body.body || body.message || body.mensagem || null;

  console.log('[resposta] recebido:', JSON.stringify(body).substring(0, 200));

  if (!tel || !texto) {
    console.log('[resposta] campos faltando — recebido:', Object.keys(body).join(', '));
    return res.status(400).json({
      erro: 'Campos obrigatorios: telefone (ou number) e texto (ou text)',
      recebido: Object.keys(body)
    });
  }

  // Normalizar telefone — remover @s.whatsapp.net se vier junto
  const telLimpo = tel.toString().replace('@s.whatsapp.net', '').replace('@lid', '');

  if (!respostas[telLimpo]) respostas[telLimpo] = [];
  respostas[telLimpo].push({ texto, ts: Date.now() });
  if (respostas[telLimpo].length > 10) respostas[telLimpo].shift();

  console.log(`[resposta] armazenado para ${telLimpo}: "${texto.substring(0, 60)}"`);
  res.json({ ok: true, telefone: telLimpo });
});

// ─── POLLING: Simulador busca resposta ────────────────────────────────────
app.get('/buscar-resposta', (req, res) => {
  const { telefone, apos } = req.query;
  if (!telefone) return res.status(400).json({ erro: 'Parametro telefone obrigatorio' });

  const telLimpo = telefone.replace('@s.whatsapp.net', '').replace('@lid', '');
  const aposTs   = parseInt(apos) || 0;
  const msgs     = (respostas[telLimpo] || []).filter(m => m.ts > aposTs);

  if (msgs.length > 0) {
    const ultima = msgs[msgs.length - 1];
    return res.json({ encontrado: true, texto: ultima.texto, ts: ultima.ts });
  }

  res.json({ encontrado: false });
});

// ─── DEBUG: ver todas as respostas armazenadas ─────────────────────────────
app.get('/debug', (_, res) => {
  res.json({ respostas });
});

// ─── HEALTH ────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, version: '3.0' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy AgendaDoc v3 rodando na porta ${PORT}`));
