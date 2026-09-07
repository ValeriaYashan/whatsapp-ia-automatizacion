/**
 * system-prompt.js
 *
 * Arma el system prompt del modelo principal a partir de knowledge-base.json.
 * Regla de diseño: el prompt nunca "sabe" nada que no venga de la base de
 * conocimiento. Si un dato no está ahí, el bot tiene que decir que no lo
 * tiene confirmado y escalar, no inventarlo ni completarlo de memoria.
 */

function buildSystemPrompt(knowledgeBase) {
  const { negocio, oferta, formas_de_pago, obras_sociales_o_coberturas, faq, cosas_que_el_bot_nunca_hace } =
    knowledgeBase;

  const ofertaTexto = oferta
    .map((item) => {
      const partes = [`- ${item.nombre}: ${item.descripcion}`];
      if (item.precio) partes.push(`  Precio: ${item.precio}`);
      if (item.duracion) partes.push(`  Duración: ${item.duracion}`);
      if (item.modalidad) partes.push(`  Modalidad: ${item.modalidad}`);
      if (item.requisitos) partes.push(`  Requisitos: ${item.requisitos}`);
      return partes.join('\n');
    })
    .join('\n\n');

  const faqTexto = faq.map((item) => `P: ${item.pregunta}\nR: ${item.respuesta}`).join('\n\n');

  const nuncaTexto = cosas_que_el_bot_nunca_hace.map((regla) => `- ${regla}`).join('\n');

  return `Sos el asistente de WhatsApp de ${negocio.nombre} (${negocio.rubro}). Respondés
consultas de clientes de forma clara, cordial y precisa, usando EXCLUSIVAMENTE la
información que aparece abajo. Nunca respondas de memoria ni completes con datos
generales del rubro que no estén acá.

Horario de atención: ${negocio.horario_atencion}
${negocio.ubicacion ? `Ubicación: ${negocio.ubicacion}` : ''}

OFERTA VIGENTE:
${ofertaTexto}

FORMAS DE PAGO ACEPTADAS: ${formas_de_pago.join(', ')}
${obras_sociales_o_coberturas && obras_sociales_o_coberturas.length ? `COBERTURAS: ${obras_sociales_o_coberturas.join(', ')}` : ''}

PREGUNTAS FRECUENTES:
${faqTexto}

REGLAS DURAS, sin excepción:
${nuncaTexto}

Si la consulta no está cubierta por la información de arriba, o no estás segura de la
respuesta, decilo con honestidad ("dejame confirmarte eso con el equipo") y no inventes
nada. Ese caso lo maneja la capa de escalamiento del sistema, vos solo generás una
respuesta neutra de espera.`;
}

module.exports = { buildSystemPrompt };
