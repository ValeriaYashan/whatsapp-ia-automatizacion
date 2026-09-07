/**
 * budget-guard.js
 *
 * Control de permisos mínimos que faltaba: tope de GASTO, no solo de
 * cantidad de mensajes. Sin esto, un bucle de mensajes (por error de un
 * cliente, un bot ajeno, o un intento de abuso) puede consumir Twilio y
 * la API de Claude sin límite hasta que alguien lo note manualmente.
 *
 * Cómo funciona: cada llamada que cuesta plata (mensaje saliente de
 * Twilio, llamada al modelo principal, llamada a la capa 2) registra su
 * costo estimado en un archivo local. Antes de cada acción que cuesta
 * plata, se consulta el acumulado del día y del mes. Si se supera el
 * tope, el bot deja de responder automáticamente y todo pasa a
 * escalamiento inmediato (el cliente sigue atendido, por Valeria).
 *
 * Los costos son estimaciones fijas configurables abajo — no reemplazan
 * mirar la factura real de Twilio y Anthropic, son un freno de mano.
 */

const fs = require('fs');
const path = require('path');

const LEDGER_PATH = path.join(__dirname, 'budget-ledger.json');

// --- Configuración: ajustar estos tres valores antes de reactivar ---
const COSTOS_ESTIMADOS_USD = {
  mensajeTwilio: 0.005, // por mensaje saliente, verificar tarifa vigente
  llamadaModeloPrincipal: 0.01, // estimación por conversación con Sonnet/Haiku, ajustar
  llamadaCapa2: 0.002, // estimación por revisión con Haiku
};

const TOPE_DIARIO_USD = 3; // cortar si se supera esto en un día
const TOPE_MENSUAL_USD = 40; // cortar si se supera esto en el mes
// ---------------------------------------------------------------------

function leerLedger() {
  if (!fs.existsSync(LEDGER_PATH)) {
    return { dias: {} };
  }
  return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
}

function guardarLedger(ledger) {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10); // "2026-09-07"
}

function mesActual(fechaISO) {
  return fechaISO.slice(0, 7); // "2026-09"
}

/**
 * Registra un costo y devuelve el estado del presupuesto después de sumarlo.
 * @param {'mensajeTwilio'|'llamadaModeloPrincipal'|'llamadaCapa2'} tipo
 * @returns {{ dentroDeTope: boolean, gastoHoy: number, gastoMes: number, motivo?: string }}
 */
function registrarCostoYVerificar(tipo) {
  const costo = COSTOS_ESTIMADOS_USD[tipo];
  if (costo === undefined) {
    throw new Error(`Tipo de costo desconocido: ${tipo}`);
  }

  const ledger = leerLedger();
  const fecha = hoyISO();

  if (!ledger.dias[fecha]) {
    ledger.dias[fecha] = 0;
  }
  ledger.dias[fecha] += costo;
  guardarLedger(ledger);

  const gastoHoy = ledger.dias[fecha];
  const gastoMes = Object.entries(ledger.dias)
    .filter(([f]) => mesActual(f) === mesActual(fecha))
    .reduce((acc, [, monto]) => acc + monto, 0);

  if (gastoHoy > TOPE_DIARIO_USD) {
    return {
      dentroDeTope: false,
      gastoHoy,
      gastoMes,
      motivo: `Tope diario superado: US$${gastoHoy.toFixed(2)} de US$${TOPE_DIARIO_USD} permitidos.`,
    };
  }

  if (gastoMes > TOPE_MENSUAL_USD) {
    return {
      dentroDeTope: false,
      gastoHoy,
      gastoMes,
      motivo: `Tope mensual superado: US$${gastoMes.toFixed(2)} de US$${TOPE_MENSUAL_USD} permitidos.`,
    };
  }

  return { dentroDeTope: true, gastoHoy, gastoMes };
}

module.exports = { registrarCostoYVerificar, COSTOS_ESTIMADOS_USD, TOPE_DIARIO_USD, TOPE_MENSUAL_USD };

/**
 * Integración en server.js (referencia):
 *
 * const budget = require('./budget-guard');
 *
 * const estado = budget.registrarCostoYVerificar('llamadaModeloPrincipal');
 * if (!estado.dentroDeTope) {
 *   await escalamiento.avisoInmediato({
 *     conversacionCompleta,
 *     motivo: `Bot apagado automáticamente por tope de gasto: ${estado.motivo}`,
 *   });
 *   // el bot deja de responder automático hasta que Valeria lo reactive
 *   // manualmente (mismo apagado que el de emergencia, panel de Twilio
 *   // o una variable de entorno BOT_PAUSADO=true que server.js chequea
 *   // al arrancar cada request).
 *   return;
 * }
 */
