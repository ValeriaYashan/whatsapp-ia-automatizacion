# whatsapp-ia-automatizacion

Plantilla reutilizable de asistente de atención al cliente por WhatsApp con IA.
Twilio + Claude API, con guardrails en dos capas, tope de gasto y escalamiento
a una persona humana. Pensada para reconfigurar rápido por cliente: lo único
que cambia entre proyectos es `knowledge-base.json`, no la arquitectura.

Ver `docs/` para el checklist de intake y el set de casos adversos para testear
antes de cualquier lanzamiento.

## Qué incluye

- `server.js` — webhook de Twilio, orquesta todo el flujo.
- `guardrails.js` — capa 1, determinística: reglas duras sobre el mensaje entrante.
- `capa2-safety-check.js` — capa 2, probabilística: revisa la respuesta antes de enviarla.
- `budget-guard.js` — tope de gasto diario/mensual, corta el envío automático si se supera.
- `escalamiento.js` — separa el aviso inmediato del resumen diario.
- `system-prompt.js` — arma el system prompt del modelo a partir de la base de conocimiento.
- `knowledge-base.example.json` — plantilla de la base de conocimiento, copiar y completar por cliente.
- `docs/checklist-intake-cliente-whatsapp-ia.md` — qué pedirle al cliente antes de empezar.
- `docs/casos-adversos-ampliados.md` — casos de testing obligatorios antes de lanzar.

## Instalación

```bash
npm install
cp .env.example .env
cp knowledge-base.example.json knowledge-base.json
```

Completar `.env` con las credenciales reales (ver comentarios en el archivo) y
`knowledge-base.json` con los datos del cliente (bloque 1 del checklist de
intake). `knowledge-base.json` está en `.gitignore` a propósito: nunca se
commitea, contiene datos reales de un cliente.

Verificar que no haya errores de sintaxis antes de levantar el servidor:

```bash
npm run check
```

## Probar localmente con el WhatsApp Sandbox de Twilio

1. En la consola de Twilio: Messaging > Try it out > Send a WhatsApp message.
   Anotar el número del sandbox y la palabra de join.
2. Desde tu teléfono, mandarle "join <palabra-clave>" a ese número.
3. Exponer el servidor local con ngrok: `ngrok http 3000`.
4. En Sandbox Settings > "When a message comes in", pegar la URL de ngrok +
   `/webhook/whatsapp`.
5. `npm start` y probar desde el teléfono.
6. Correr `docs/casos-adversos-ampliados.md` completo antes de dar por
   validado el flujo.

El sandbox no requiere aprobación de Meta y es gratis, pero la sesión de join
expira cada 72 horas.

## Pasar a un número real (producción)

No se puede saltear: hay que dar de alta el número como WhatsApp Sender real
en Twilio (Console > Messaging > Senders > WhatsApp Senders), lo que implica
verificación de Meta y, si el Business Portfolio es nuevo, verificación de
negocio (puede tardar semanas). Una vez el sender está ONLINE, apuntar el
webhook de "Edit Sender" al servidor real desplegado, no a ngrok.

Checklist antes de encender en producción:

- [ ] `knowledge-base.json` completo y revisado con el cliente, no con supuestos.
- [ ] Casos adversos de `docs/casos-adversos-ampliados.md` corridos contra el
      webhook ya desplegado, no solo local.
- [ ] `TOPE_DIARIO_USD` y `TOPE_MENSUAL_USD` de `budget-guard.js` ajustados al
      presupuesto real acordado con el cliente.
- [ ] `NOTIFICACION_WHATSAPP_TO` apunta al número correcto de la persona
      responsable de ese cliente.
- [ ] Auditoría de `ciberseguridad-agentes-ia` corrida sobre esta instancia
      concreta, no solo sobre la plantilla genérica.
- [ ] Ningún `.env` ni `knowledge-base.json` con datos reales quedó commiteado.

## Apagado de emergencia

Dos formas, no dependen la una de la otra:

1. Variable de entorno `BOT_PAUSADO=true` y reiniciar el proceso (o cambiarla
   en el panel del hosting sin redeploy si el proveedor lo permite).
2. Desactivar el número desde el panel de Twilio (Messaging > Senders), corta
   el canal completo aunque el servidor siga corriendo.

El apagado automático por tope de gasto ya deja al bot sin responder de forma
automática (ver `server.js` y `budget-guard.js`); no hace falta tocar nada a
mano en ese caso, pero conviene revisar por qué se disparó antes de
reactivarlo.

## Mantenimiento

Actualizar `knowledge-base.json` cuando cambian precios, cupos, horarios o
condiciones. No hace falta tocar ningún otro archivo para eso. Revisar el
comportamiento del bot con fecha fija, no dejarlo aprobado para siempre.
