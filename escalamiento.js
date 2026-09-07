/**
 * escalamiento.js
 *
 * Separa el aviso inmediato (pago, datos de cuenta, inyección, reclamo con
 * intención de cancelación o segundo reclamo) del resumen agrupado diario
 * (el resto de los gatillos). El destino de ambos es el WhatsApp personal
 * configurado en NOTIFICACION_WHATSAPP_TO, nunca un resumen que el propio
 * bot generó de la conversación crítica: en el aviso inmediato se manda la
 * conversación completa, sin resumir.
 */

const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const FROM = process.env.TWILIO_WHATSAPP_FROM; // ej: 'whatsapp:+14155238886'
const TO = process.env.NOTIFICACION_WHATSAPP_TO; // ej: 'whatsapp:+5491100000000'

// Buffer en memoria del resumen diario. En producción real conviene
// persistirlo (archivo o base chica) para que un reinicio no lo pierda
// antes de que se mande el corte del día.
let bufferResumenDiario = [];

/**
 * Aviso inmediato: se manda apenas se detecta el gatillo, con la
 * conversación completa, no un resumen.
 */
async function avisoInmediato({ telefonCliente, conversacionCompleta, motivo }) {
  const cuerpo = `⚠️ AVISO INMEDIATO (${motivo})\nCliente: ${telefonCliente}\n\n${conversacionCompleta}`;

  await client.messages.create({
    from: FROM,
    to: TO,
    body: cuerpo.slice(0, 1550), // WhatsApp corta mensajes muy largos, margen de seguridad
  });
}

/**
 * Gatillos no urgentes: se acumulan y se mandan una vez al día (cron o
 * llamada manual a enviarResumenDiario, ver comentario de integración).
 */
function agregarAResumenDiario({ telefonCliente, motivo, extracto }) {
  bufferResumenDiario.push({
    telefonCliente,
    motivo,
    extracto,
    timestamp: new Date().toISOString(),
  });
}

async function enviarResumenDiario() {
  if (bufferResumenDiario.length === 0) return;

  const lineas = bufferResumenDiario.map(
    (item) => `• ${item.telefonCliente} — ${item.motivo}: "${item.extracto}"`
  );

  const cuerpo = `📋 Resumen diario (${bufferResumenDiario.length} casos)\n\n${lineas.join('\n')}`;

  await client.messages.create({
    from: FROM,
    to: TO,
    body: cuerpo.slice(0, 1550),
  });

  bufferResumenDiario = [];
}

module.exports = { avisoInmediato, agregarAResumenDiario, enviarResumenDiario };

/**
 * Integración de enviarResumenDiario: correrlo con un cron job (ej.
 * node-cron o un cron del sistema operativo) una vez al día, a una hora
 * fija. No depender de que alguien lo dispare a mano.
 */
