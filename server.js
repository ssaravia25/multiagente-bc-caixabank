/**
 * Servidor local Multi-Agente — Business Case CaixaBank 2025
 *
 * Usa tu cuenta de Claude Code (sin API key extra, sin costo adicional).
 * Los agentes se ejecutan via  `claude --print`  usando tu suscripción actual.
 *
 * Requisitos:
 *   - Node.js >= 18
 *   - Claude Code CLI instalado y autenticado  (npm install -g @anthropic-ai/claude-code)
 *
 * Uso:
 *   node server.js
 *   Abre:  http://localhost:3001
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { spawn } = require('child_process');

const PORT         = 3001;
const HTML_FILE    = path.join(__dirname, 'web', 'index.html');
const GROUPS_PROXY = 'vercel-deploy-jet-tau.vercel.app'; // datos compartidos en Vercel/JSONBlob

// ─── PROMPTS DE AGENTES (mismos que api/agent.js) ─────────────────────────────

const SYSTEM_PROMPTS = {
  orchestrator: `Eres el Orquestador de un sistema multi-agente de Business Case para el sector bancario español.
Tu tarea: dado una idea de proyecto o iniciativa bancaria, desglósala en hipótesis clave que los agentes especializados deberán investigar.
Responde en español, de forma estructurada con estas 4 dimensiones (formato JSON):
{
  "titulo": "nombre del proyecto",
  "hipotesis_mercado": "pregunta clave para el agente de research",
  "hipotesis_financiera": "pregunta clave para el agente financiero",
  "hipotesis_legal": "pregunta clave para el agente legal",
  "hipotesis_riesgo": "pregunta clave para el agente de riesgos",
  "contexto_general": "resumen de 2-3 líneas del proyecto"
}
Sé preciso y relevante para banca/fintech española.`,

  research: `Eres el Agente de Research de un sistema multi-agente de Business Case bancario.
Analiza el mercado, competencia y tendencias relevantes para la iniciativa propuesta.
Responde en español con estas secciones:

**ANÁLISIS DE MERCADO**
- Tamaño del mercado y segmento objetivo
- Principales competidores (fintechs y neobancos)
- Tendencias clave (Gen Z, digitalización, open banking)

**OPORTUNIDAD**
- Por qué ahora es el momento correcto
- Ventaja competitiva potencial

**DATOS RELEVANTES**
- 2-3 métricas o estadísticas del sector bancario español/europeo`,

  finance: `Eres el Agente Financiero de un sistema multi-agente de Business Case bancario.
Proyecta los indicadores financieros clave de la iniciativa propuesta.
Responde en español con estas secciones:

**SUPUESTOS BASE**
- Inversión estimada (CapEx + OpEx año 1)
- Ingresos proyectados años 1-5 (con justificación)
- Tasa de descuento (WACC) sugerida para banca española

**INDICADORES FINANCIEROS**
- VAN estimado (Valor Actual Neto)
- TIR estimada (Tasa Interna de Retorno)
- ROI aproximado
- Payback period

**ESCENARIOS**
- Optimista / Base / Pesimista (1 línea cada uno)`,

  legal: `Eres el Agente Legal y Regulatorio de un sistema multi-agente de Business Case bancario.
Identifica el marco regulatorio aplicable en España/Europa.
Responde en español con estas secciones:

**MARCO REGULATORIO APLICABLE**
- Normativas clave (PSD2, GDPR, DORA, Basilea III, etc.)
- Licencias o permisos necesarios

**CONSIDERACIONES DE CUMPLIMIENTO**
- Requisitos de protección de datos
- Obligaciones de reporte al Banco de España / BCE
- Restricciones o limitaciones relevantes

**RIESGOS LEGALES**
- 2-3 riesgos legales principales y cómo mitigarlos`,

  risk: `Eres el Agente de Riesgos de un sistema multi-agente de Business Case bancario.
Identifica y evalúa los principales riesgos de la iniciativa.
Responde en español con:

**TOP 5 RIESGOS**
Para cada riesgo:
- Riesgo: descripción
- Tipo: [Operacional / Financiero / Regulatorio / Tecnológico / Reputacional]
- Probabilidad: [Alta / Media / Baja]
- Impacto: [Alto / Medio / Bajo]
- Mitigante: acción concreta

**RIESGO TAIL (Escenario catastrófico)**
- Qué pasaría si el proyecto fracasa completamente
- Plan de contingencia mínimo`,

  report: `Eres el Agente Redactor de un sistema multi-agente de Business Case bancario.
Sintetiza los outputs de todos los agentes anteriores en un Business Case ejecutivo.
Responde en español con el siguiente formato:

# BUSINESS CASE — [TÍTULO]

## 1. RESUMEN EJECUTIVO
[2-3 oraciones: qué se propone, cuánto cuesta, qué se gana]

## 2. PROBLEMA / OPORTUNIDAD
[Descripción del problema y la oportunidad de mercado]

## 3. ALTERNATIVA RECOMENDADA
[La opción propuesta y por qué es la mejor]

## 4. ANÁLISIS FINANCIERO
| Métrica | Valor |
|---------|-------|
| Inversión total | |
| VAN | |
| TIR | |
| ROI | |
| Payback | |

## 5. RIESGOS PRINCIPALES
[Top 3 riesgos y sus mitigantes]

## 6. RECOMENDACIÓN FINAL
**DECISIÓN: APROBAR / NO APROBAR**
[Justificación en 2-3 líneas]`,
};

// ─── LLAMADA A CLAUDE CLI ─────────────────────────────────────────────────────

function callClaude(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const fullPrompt = `ROL E INSTRUCCIONES:\n${systemPrompt}\n\n${'─'.repeat(60)}\n\nENTRADA:\n${userMessage}`;

    const proc = spawn('claude', ['--print', '--output-format', 'text'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let errOut = '';

    proc.stdout.on('data', chunk => { output += chunk.toString(); });
    proc.stderr.on('data', chunk => { errOut += chunk.toString(); });

    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(errOut.trim() || `claude exited with code ${code}`));
      } else {
        resolve(output.trim());
      }
    });

    proc.on('error', err => reject(new Error(`No se pudo ejecutar claude: ${err.message}`)));

    proc.stdin.write(fullPrompt);
    proc.stdin.end();
  });
}

// ─── HELPERS HTTP ─────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function proxyToVercel(req, res, body) {
  const options = {
    hostname: GROUPS_PROXY,
    path: req.url,
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body || ''),
    },
  };

  const proxy = https.request(options, upstream => {
    res.writeHead(upstream.statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    upstream.pipe(res);
  });

  proxy.on('error', e => json(res, 502, { error: 'Proxy error: ' + e.message }));
  if (body) proxy.write(body);
  proxy.end();
}

// ─── SERVIDOR ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // ── Servir HTML (inyectar baseURL local para /api/agent) ──
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      let html = fs.readFileSync(HTML_FILE, 'utf8');
      // Redirige las llamadas de /api/agent al servidor local
      html = html.replace(
        "fetch('/api/agent'",
        "fetch('http://localhost:" + PORT + "/api/agent'"
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (e) {
      res.writeHead(500); return res.end('Error leyendo index.html: ' + e.message);
    }
  }

  // ── /api/agent  →  claude CLI local ──────────────────────────────────────────
  if (req.url === '/api/agent' && req.method === 'POST') {
    const body = await readBody(req);
    let parsed;
    try { parsed = JSON.parse(body); } catch { return json(res, 400, { error: 'JSON inválido' }); }

    const { agent, idea, context } = parsed;
    const systemPrompt = SYSTEM_PROMPTS[agent];
    if (!systemPrompt) return json(res, 400, { error: `Agente desconocido: ${agent}` });

    let userMessage = idea || '';
    if (context && Object.keys(context).length) {
      userMessage += '\n\nCONTEXTO DE AGENTES ANTERIORES:\n' + JSON.stringify(context, null, 2);
    }

    console.log(`\n🤖 [${agent.toUpperCase()}] llamando a claude CLI...`);
    const t0 = Date.now();

    try {
      const output = await callClaude(systemPrompt, userMessage);
      console.log(`   ✅ completado en ${((Date.now()-t0)/1000).toFixed(1)}s`);
      return json(res, 200, { agent, output });
    } catch (e) {
      console.error(`   ❌ error: ${e.message}`);
      return json(res, 500, { error: e.message });
    }
  }

  // ── /api/groups  →  proxy a Vercel (JSONBlob) ─────────────────────────────
  if (req.url.startsWith('/api/groups')) {
    const body = await readBody(req);
    return proxyToVercel(req, res, body);
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Sistema Multi-Agente — Business Case CaixaBank     ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║   URL:    http://localhost:${PORT}                       ║`);
  console.log('║   Agentes: claude CLI (tu cuenta, sin costo extra)   ║');
  console.log('║   Grupos:  JSONBlob en Vercel (compartido)            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log('Ctrl+C para detener.\n');
});
