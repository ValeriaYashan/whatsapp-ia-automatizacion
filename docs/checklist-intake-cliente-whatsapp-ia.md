# Checklist de intake — Automatización de WhatsApp con IA
### Para [NOMBRE DEL CLIENTE]

Este documento reúne la información necesaria para configurar el asistente de WhatsApp. Cuanto más completo esté, más preciso y confiable va a ser el sistema desde el primer día. Lo que no se complete acá queda marcado como pendiente y se resuelve en la reunión de relevamiento.

---

## 1. Oferta completa y actualizada

- Servicios o productos que ofrecen, con precio de cada uno (o rango, si varía).
- Duración de cada servicio o turno.
- Obras sociales, prepagas o formas de pago que aceptan.
- Ubicación, dirección y cómo llegar si es relevante.
- Horarios de atención.
- Requisitos para una primera consulta o contratación (documentación, estudios previos, señas).

*Cualquier dato que hoy responden por WhatsApp a mano tiene que estar acá. Si algo cambia seguido (cupos, turnos disponibles, precios de temporada), avisarlo aparte: ese dato no va fijo en la base de conocimiento, se actualiza manualmente.*

## 2. Preguntas reales que reciben por WhatsApp

- Capturas o un resumen de las últimas semanas de conversaciones, si las tienen a mano.
- Las tres o cinco preguntas que más se repiten, en las palabras exactas que usa la gente (no la versión prolija que uno imagina).
- Preguntas que generaron confusión o una respuesta incorrecta en el pasado.

*Las FAQ reales casi siempre son distintas de las que el negocio cree que le preguntan. Esta sección es la que más cambia el diseño del bot.*

## 3. Criterio de derivación específico del rubro

- Qué situación necesita sí o sí una persona del negocio y el bot no puede resolver sola (ejemplo: una urgencia médica, un reclamo, una negociación de precio, un pedido de asesoramiento profesional).
- Cuál de esas situaciones es la más urgente y necesita aviso inmediato, y cuáles pueden esperar un resumen diario.
- Si hay algo que el bot nunca debe decir o prometer bajo ninguna circunstancia.

## 4. Acceso técnico

- Si ya tienen un número de WhatsApp Business en uso, o si hay que dar de alta uno nuevo.
- Acceso de administrador a su Meta Business Portfolio (o alta como colaboradora si ya existe uno).
- Cuenta de Twilio a nombre del negocio, no de Valeria, con acceso de colaboradora durante la implementación.
- Nombre público que van a ver los clientes (tiene que cumplir las guías de nombre de Meta) y categoría del negocio.

## 5. Presupuesto y destino de los avisos

- Tope de gasto diario y mensual que quieren fijar para Twilio y la API de IA (referencia: con volumen chico suele quedar por debajo de USD 20 por mes, a confirmar con datos reales).
- A qué número de WhatsApp tienen que llegar los avisos de escalamiento (recepción, dueño, ambos, según el tipo de gatillo).
- Quién es la persona responsable de revisar las conversaciones y aprobar cambios en la base de conocimiento.

---

## Antes de la reunión de relevamiento

Con este checklist completo, o al menos los bloques 1 y 2, la reunión de relevamiento se enfoca en definir los criterios de derivación del bloque 3 y confirmar el acceso técnico del bloque 4, en vez de perder tiempo levantando información básica sobre la mesa.

*Plantilla reutilizable: adaptar el bloque 3 (criterio de derivación) al rubro específico de cada cliente antes de enviarla. Lo que es crítico en un consultorio médico no es lo mismo que en una inmobiliaria o un estudio contable.*
