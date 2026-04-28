# Sistema Multi-Agente IA — Business Case CaixaBank 2025

Pipeline de 6 agentes Claude para generar Business Cases bancarios. Desarrollado para el Programa Certificado en Project Management de CaixaBank 2025.

**Demo en producción:** https://vercel-deploy-jet-tau.vercel.app

---

## Arquitectura

```
Idea de proyecto
      │
      ▼
┌─────────────┐
│ Orquestador │  desglosa en hipótesis
└──────┬──────┘
       │
  ┌────┴──────────────────────────┐
  │         (en paralelo)         │
  ▼          ▼          ▼         ▼
Research   Finance    Legal     Risk
  │          │          │         │
  └────┬─────┴──────────┴─────────┘
       │
       ▼
┌─────────────┐
│   Report    │  Business Case ejecutivo
└─────────────┘
```

**Tiempo total:** ~90 segundos (vs ~3 min en pipeline secuencial)

---

## Modos de ejecución

### Modo local — Claude Code CLI (sin costo adicional)

Usa tu suscripción de Claude Code existente. No necesita API key.

**Requisitos:**
- Node.js ≥ 18
- [Claude Code CLI](https://claude.ai/code) instalado y autenticado

```bash
node server.js
# Abre http://localhost:3001
```

### Modo Vercel — Claude Haiku API (~4s por agente)

Despliega la carpeta `web/` en Vercel y configura la variable de entorno:

```
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
cd web
vercel --prod
```

---

## Estructura del repositorio

```
├── server.js              # Servidor local (usa Claude Code CLI)
├── web/
│   ├── index.html         # Frontend: 4 tabs (Resumen, Financiero, Grupos, Multi-Agente)
│   ├── vercel.json        # Configuración Vercel
│   └── api/
│       ├── agent.js       # Serverless: llama a Claude Haiku vía API
│       └── groups.js      # Serverless: persistencia de grupos (JSONBlob)
└── scripts/
    └── financial_module.gs  # Google Apps Script: módulo financiero interactivo (VAN/TIR/ROI/Payback)
```

---

## Agentes

| Agente | Rol | Input | Output |
|--------|-----|-------|--------|
| **Orquestador** | Desglosa la idea en hipótesis | Idea libre | JSON con 5 hipótesis |
| **Research** | Análisis de mercado y competencia | Hipótesis de mercado | Markdown estructurado |
| **Finance** | Proyección financiera | Hipótesis financiera | VAN, TIR, ROI, Payback |
| **Legal** | Marco regulatorio (PSD2, GDPR, DORA…) | Hipótesis legal | Normativas y riesgos |
| **Risk** | Evaluación de riesgos | Hipótesis de riesgo | Top 5 riesgos + mitigantes |
| **Report** | Síntesis ejecutiva | Todos los outputs | Business Case completo |

---

## Módulo Financiero (Google Sheets)

El archivo `scripts/financial_module.gs` genera un Google Sheet interactivo con fórmulas dinámicas:

1. Abre [script.google.com](https://script.google.com) → Nuevo proyecto
2. Pega el contenido de `financial_module.gs`
3. Ejecuta `createFinancialModule()`
4. Edita las celdas amarillas en la hoja **VAN** → todo se recalcula automáticamente

Hojas generadas: Dashboard · VAN · TIR · ROI · Payback · Sensibilidad · Comparativa

---

## Caso práctico: Banco SIV

El sistema viene preconfigurado con el caso del Banco SIV (pérdida de clientes Gen Z). Tres alternativas:

| Alternativa | Inversión | WACC |
|-------------|-----------|------|
| App Fintech Gen Z | €8M | 12% |
| Alianza Neobank | €3M | 10% |
| Rediseño Digital | €5M | 11% |

---

Desarrollado con [Claude Code](https://claude.ai/code) · Anthropic 2025
