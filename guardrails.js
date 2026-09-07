/**
 * guardrails.js
 *
 * Capa 1 (determinística) de guardrails. Corre ANTES de llamar al modelo
 * principal, sobre el mensaje entrante del cliente. Reglas duras: listas de
 * palabras y expresiones regulares, no razonamiento. Si algo no matchea acá,
 * la responsabilidad de frenarlo pasa a capa2-safety-check.js, que revisa la
 * RESPUESTA generada, no el mensaje. Ver casos-adversos-ampliados.md para el
 * set de pruebas que hay que correr contra las dos capas.
 *
 * Regla de orden (auditoría ciberseguridad-agentes-ia): esta capa corre
 * primero y, si dispara, tiene la última palabra: no se llama al modelo
 * principal, se va directo a escalamiento.
 */

const PATRONES = {
  negociacion_de_precio_o_condiciones: [
    /descuent/i,
    /combo/i,
    /rebaj/i,
    /m[aá]s barat/i,
    /precio especial/i,
    /me sale menos/i,
    /me hac[eé]n el mismo precio/i,
    /promo/i,
    /me cobr[aá]s menos/i,
  ],
  pedido_de_datos_de_cuenta_bancaria: [
    /\bcbu\b/i,
    /\balias\b/i,
    /\bcvu\b/i,
    /n[uú]mero de cuenta/i,
    /a d[oó]nde transfiero/i,
    /mercado ?pago/i,
    /te mando la se[ñn]a/i,
    /d[oó]nde deposito/i,
  ],
  intento_de_inyeccion: [
    /ignor[aá] (las |tus )?instruccion/i,
    /actu[aá] como si fueras/i,
    /revel[aá] (tu|el) (system ?prompt|configuraci[oó]n)/i,
    /mensaje de prueba del sistema/i,
    /sos ahora/i,
  ],
  reclamo: [
    /reclamo/i,
    /no (me )?contest[aá]/i,
    /esto no (es|funciona)/i,
    /p[eé]sim[oa]/i,
    /insatisfech/i,
    /mala experiencia/i,
  ],
  intencion_de_cancelacion_o_devolucion: [
    /devuelvan la (plata|dinero)/i,
    /quiero (que me devuelvan|cancelar)/i,
    /devoluci[oó]n/i,
    /anular la (compra|inscripci[oó]n|reserva)/i,
  ],
};

// Estado de conversación en memoria: cantidad de intercambios y de reclamos
// por número de teléfono. Para un volumen chico alcanza; si el servidor se
// reinicia, se resetea. Para volumen alto, migrar a un store persistente.
const estadoConversaciones = new Map();

function obtenerEstado(telefono) {
  if (!estadoConversaciones.has(telefono)) {
    estadoConversaciones.set(telefono, { intercambios: 0, reclamos: 0 });
  }
  return estadoConversaciones.get(telefono);
}

function matchea(mensaje, patrones) {
  return patrones.some((regex) => regex.test(mensaje));
}

/**
 * Evalúa el mensaje entrante contra los gatillos duros.
 * @param {string} mensaje - texto del cliente
 * @param {string} telefono - identificador de la conversación (número)
 * @param {object} knowledgeBase - para saber qué gatillos van a inmediato vs resumen
 * @returns {{ disparo: boolean, tipo: 'aviso_inmediato'|'resumen_diario'|null, motivo: string|null }}
 */
function evaluarMensajeEntrante(mensaje, telefono, knowledgeBase) {
  const estado = obtenerEstado(telefono);
  estado.intercambios += 1;

  const gatillosInmediatos = knowledgeBase.gatillos_escalamiento.aviso_inmediato;
  const gatillosDiarios = knowledgeBase.gatillos_escalamiento.resumen_diario;

  // Intento de inyección: siempre aviso inmediato, no depende de config del cliente.
  if (matchea(mensaje, PATRONES.intento_de_inyeccion)) {
    return { disparo: true, tipo: 'aviso_inmediato', motivo: 'intento_de_inyeccion' };
  }

  if (
    gatillosInmediatos.includes('negociacion_de_precio_o_condiciones') &&
    matchea(mensaje, PATRONES.negociacion_de_precio_o_condiciones)
  ) {
    return { disparo: true, tipo: 'aviso_inmediato', motivo: 'negociacion_de_precio_o_condiciones' };
  }

  if (
    gatillosInmediatos.includes('pedido_de_datos_de_cuenta_bancaria') &&
    matchea(mensaje, PATRONES.pedido_de_datos_de_cuenta_bancaria)
  ) {
    return { disparo: true, tipo: 'aviso_inmediato', motivo: 'pedido_de_datos_de_cuenta_bancaria' };
  }

  if (matchea(mensaje, PATRONES.reclamo)) {
    estado.reclamos += 1;

    const conIntencionDeCancelacion = matchea(mensaje, PATRONES.intencion_de_cancelacion_o_devolucion);
    const esSegundoReclamo = estado.reclamos >= 2;

    if (conIntencionDeCancelacion || esSegundoReclamo) {
      return {
        disparo: true,
        tipo: 'aviso_inmediato',
        motivo: conIntencionDeCancelacion ? 'reclamo_con_intencion_de_cancelacion' : 'segundo_reclamo_misma_conversacion',
      };
    }

    return { disparo: true, tipo: 'resumen_diario', motivo: 'reclamo' };
  }

  if (gatillosDiarios.includes('mas_de_3_intercambios_sin_resolver') && estado.intercambios > 3) {
    return { disparo: true, tipo: 'resumen_diario', motivo: 'mas_de_3_intercambios_sin_resolver' };
  }

  return { disparo: false, tipo: null, motivo: null };
}

/**
 * Backstop determinístico sobre la respuesta saliente, antes de que la vea
 * capa 2. No reemplaza a capa2-safety-check.js, es una red adicional barata
 * para los patrones más obvios (regex sobre CBU/alias en la respuesta).
 */
function respuestaContieneDatosSensibles(respuesta) {
  return matchea(respuesta, PATRONES.pedido_de_datos_de_cuenta_bancaria);
}

function resetearEstado(telefono) {
  estadoConversaciones.delete(telefono);
}

module.exports = {
  evaluarMensajeEntrante,
  respuestaContieneDatosSensibles,
  resetearEstado,
};
