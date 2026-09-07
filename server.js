/**
 * server.js
 *
 * Webhook de WhatsApp (Twilio) → orquestador → motor de IA → respuesta o
 * escalamiento. Expuesto en POST /webhook/whatsapp.
 *
 * Orden de ejecución por mensaje entrante (no cambiar el orden, es la
 * arquitectura que salió de la auditoría ciberseguridad-agentes-ia):
 *
 *   1. Chequear BOT_PAUSADO (apagado manual o por tope de gasto).
 *   2. guardrails.js (capa 1, determinística) sobre el mensaje entrante.
 *      Si dispara, escala y no se llama al modelo.
 *   3. budget-guard.js antes de llamar al modelo principal.
 *   4. Llamada al modelo principal (Claude) con el system prompt armado
 *      desde knowledge-base.json.
 *   5. budget-guard.js antes de llamar a la capa 2.
 *   6. capa2-safety-check.js sobre la respuesta candidata.
 *   7. Backstop determinístico (guardrails.respuestaContieneDatosSensibles).
 *   8. Envío de la respuesta al cliente, o escalamiento si algo de 2-7 frenó.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const guardrails = require('./guardrails');
const budget = require('./budget-guard');
const { checkResponseSafety } = require('./capa2-safety-check');
const escalamiento = require('./escalamiento');
const { buildSystemPrompt } = require('./system-prompt');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Modelo principal. Verificar que el nombre siga vigente en docs.claude.com
// antes de reactivar en producción — los nombres de modelo cambian.
const MODELO_PRINCIPAL = process.env.MODELO_PRINCIPAL || 'claude-sonnet-4-6';

const KB_PATH = path.join(__dirname, 'knowledge-base.json');

function cargarBaseDeConocimiento() {
  if (!fs.existsSync(KB_PATH)) {
    throw new Error(
      'Falta knowledge-base.json. Copiar knowledge-base.example.json a knowledge-base.json y completarlo con los datos reales del cliente antes de levantar el servidor.'
    );
  }
  return JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
}

// Historial de conversación en memoria, últimos N mensajes por teléfono.
// Para volumen alto o reinicio frecuente, migrar a un store persistente.
const historiales = new Map();
const MAX_HISTORIAL = 10;

function agregarAlHistorial(telefono, role, content) {
  if (!historiales.has(telefono)) historiales.set(telefono, []);
  const historial = historiales.get(telefono);
  historial.push({ role, content });
  if (historial.length > MAX_HISTORIAL) historial.shift();
  return historial;
}

function conversacionCompletaComoTexto(telefono) {
  const historial = historiales.get(telefono) || [];
  return historial.map((m) => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`).join('\n');
}

async function estaPausado() {
  return process.env.BOT_PAUSADO === 'true';
}

app.post('/webhook/whatsapp', async (req, res) => {
  const mensajeEntrante = (req.body.Body || '').trim();
  const telefono = req.body.From; // ej: 'whatsapp:+541140791007'

  // Confirmar recepción a Twilio de inmediato; el resto corre async.
  res.status(200).send('<Response></Response>');

  if (!mensajeEntrante || !telefono) return;

  try {
    if (await estaPausado()) {
      // El bot está apagado (manual o por tope de gasto). No se procesa
      // nada automático; todo pasa a la persona a cargo.
      return;
    }

    const knowledgeBase = cargarBaseDeConocimiento();
    agregarAlHistorial(telefono, 'user', mensajeEntrante);

    // --- Capa 1: determinística, sobre el mensaje entrante ---
    const evaluacion = guardrails.evaluarMensajeEntrante(mensajeEntrante, telefono, knowledgeBase);

    if (evaluacion.disparo) {
      if (evaluacion.tipo === 'aviso_inmediato') {
        await escalamiento.avisoInmediato({
          telefonCliente: telefono,
          conversacionCompleta: conversacionCompletaComoTexto(telefono),
          motivo: evaluacion.motivo,
        });
      } else {
        await escalamiento.agregarAResumenDiario({
          telefonCliente: telefono,
          motivo: evaluacion.motivo,
          extracto: mensajeEntrante,
        });
      }
      return;
    }

    // --- Tope de gasto antes de llamar al modelo principal ---
    const estadoPresupuesto = budget.registrarCostoYVerificar('llamadaModeloPrincipal');
    if (!estadoPresupuesto.dentroDeTope) {
      await escalamiento.avisoInmediato({
        telefonCliente: telefono,
        conversacionCompleta: conversacionCompletaComoTexto(telefono),
        motivo: `bot_pausado_por_tope_de_gasto: ${estadoPresupuesto.motivo}`,
      });
      return;
    }

    // --- Modelo principal ---
    const systemPrompt = buildSystemPrompt(knowledgeBase);
    const historial = historiales.get(telefono) || [];

    const resultado = await anthropic.messages.create({
      model: MODELO_PRINCIPAL,
      max_tokens: 500,
      system: systemPrompt,
      messages: historial,
    });

    const draftResponse = resultado.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    // --- Tope de gasto antes de la capa 2 ---
    const estadoPresupuestoCapa2 = budget.registrarCostoYVerificar('llamadaCapa2');
    if (!estadoPresupuestoCapa2.dentroDeTope) {
      await escalamiento.avisoInmediato({
        telefonCliente: telefono,
        conversacionCompleta: conversacionCompletaComoTexto(telefono),
        motivo: `bot_pausado_por_tope_de_gasto: ${estadoPresupuestoCapa2.motivo}`,
      });
      return;
    }

    // --- Capa 2: probabilística, sobre la respuesta candidata ---
    const safety = await checkResponseSafety(draftResponse, mensajeEntrante);

    // --- Backstop determinístico adicional sobre la respuesta ---
    const tieneDatosSensibles = guardrails.respuestaContieneDatosSensibles(draftResponse);

    if (!safety.approved || tieneDatosSensibles) {
      await escalamiento.avisoInmediato({
        telefonCliente: telefono,
        conversacionCompleta: conversacionCompletaComoTexto(telefono),
        motivo: !safety.approved ? `capa2_bloqueo: ${safety.reason}` : 'backstop_datos_sensibles_en_respuesta',
      });
      return;
    }

    // --- Envío de la respuesta aprobada ---
    agregarAlHistorial(telefono, 'assistant', draftResponse);
    budget.registrarCostoYVerificar('mensajeTwilio');

    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilio.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: telefono,
      body: draftResponse,
    });
  } catch (err) {
    // Cualquier error técnico no manejado: no se le envía nada al cliente
    // sin revisar, se escala para que lo vea una persona.
    console.error('Error procesando mensaje entrante:', err);
    try {
      await escalamiento.avisoInmediato({
        telefonCliente: telefono,
        conversacionCompleta: conversacionCompletaComoTexto(telefono),
        motivo: `error_tecnico: ${err.message}`,
      });
    } catch (errEscalamiento) {
      console.error('Falló también el aviso de escalamiento:', errEscalamiento);
    }
  }
});

app.get('/health', (req, res) => res.status(200).send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
