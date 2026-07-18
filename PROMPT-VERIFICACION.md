# Prompt de verificación de errores — pégalo en una sesión nueva

Copia y pega TODO lo de abajo como mensaje para revisar la app antes de publicar
o cuando sospeches de un problema. Está pensado para este proyecto (Next.js 16 +
Supabase, rama brotherhood-publico) y para verificar **sin navegador**
(preview/localhost se cuelgan aquí): usa tsc + tests + build + revisión de código
+ curl sobre el sitio en vivo.

---

Eres un revisor de calidad de esta app. Verifica que NO haya errores, en este
orden, y repórtame cada hallazgo con archivo:línea y cómo reproducirlo. NO uses
preview, localhost ni el navegador (se cuelgan): verifica con tsc, tests, build,
revisión de código y `curl` sobre el sitio en vivo.

1. **Estático (bloqueantes):** corre y reporta el resultado de:
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   Si algo falla, arréglalo o dime la causa exacta. No sigas si el build falla.

2. **Salud del sitio en vivo** (brotherhood-xi.vercel.app), con `curl -s -o
   /dev/null -w "%{http_code}"`:
   - `/` debe dar 200.
   - `/pedidos` y `/mis-pedidos` deben cargar (200).
   - `/api/public/business-config` debe dar 200 y traer `publicCurrencySymbol`.
   - `/api/whatsapp/webhook` (GET, sin token) debe dar 403.
   - `/api/exchange-rate` debe dar 200 con una tasa válida.

3. **Aislamiento por sede (no debe haber mezclas):** confirma que cada llamada
   a `/api/*` lleva `x-branch-id` (vía AuthBridge) y que los datos (pedidos,
   recibos, tickets, reportes) quedan scopeados a la sede seleccionada. Busca
   cualquier lectura de pedidos/cuentas que NO respete la sede.

4. **Página pública (cliente):** revisa que no rompa si:
   - la tasa de cambio falla (debe usar el fallback local sin crashear),
   - el carrito está vacío, o con combos + productos normales mezclados,
   - `publicCurrencySymbol` es "$" o "€" (los precios públicos cambian de signo;
     los bolívares NO cambian; el panel del staff sigue en "$"),
   - falta algún campo de config (debe degradar con defaults, no con crash).

5. **Encuesta WhatsApp:** revisa degradación cuando faltan cosas:
   - sin `WHATSAPP_*` en el server → el envío automático queda apagado, no
     tira error visible;
   - webhook: firma inválida → 401; body no-JSON → 200 sin procesar; payload
     desconocido → se ignora sin crashear;
   - sin migración 0027 → no se envía y se avisa; no se duplican respuestas.

6. **Impresión (feature de tickets):**
   - `printFlowMode` = "none" no imprime nada; = "auto" abre la comanda al
     enviar a cocina (tipo=cocina) y el recibo al marcar Listo (tipo=recibo);
   - `ReceiptTicket` no debe crashear si el pedido no tiene ítems, sin sede
     (usa el nombre del negocio), o sin nombre de cliente;
   - el `window.open` de auto-impresión ocurre dentro del gesto del clic (antes
     de cualquier await) para no ser bloqueado.

7. **Config:** los campos nuevos (`publicCurrencySymbol`, `printFlowMode`) se
   guardan, se normalizan (solo "$"/"€" y "none"/"auto") y tienen default en
   `businessConfigFields`, `ordersBusinessConfig` y el panel de Configuración
   (el test `businessConfigFields.test.ts` debe pasar).

8. **Errores generales:** busca accesos a `undefined`/`null` sin guardas,
   `.map`/`.find` sobre posibles no-arrays, y estados que puedan causar
   hidratación inconsistente (SSR vs cliente).

Al final, dame una lista priorizada de hallazgos (o "todo limpio") y NO cambies
nada sin explicármelo primero.
