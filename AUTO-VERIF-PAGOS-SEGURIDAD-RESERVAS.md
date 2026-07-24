# Auto-verificación — Pagos, seguridad (roles/sede) y reservas

> "Lee AUTO-VERIF-PAGOS-SEGURIDAD-RESERVAS.md y ejecútalo." Tres bloques que comparten
> el mismo hilo: que el sistema no confíe de más y no cobre/exponga de menos.

## A. FLUJO DE PAGO (electrónico vs efectivo)

1. **Electrónico pide reportar (versión suave, `publicPrepayNoticeEnabled=true`).** Pedido Pick up/Delivery con pago móvil/Zelle/transferencia: en el checkout sale el aviso "Importante antes de pedir"; tras registrar, el botón es **"Reportar pago"** (no "Ver avance") y hace scroll a la sección de reporte. El pedido SÍ llega al local (versión suave, no bloquea).
2. **Efectivo NO pide reportar (fix guard electrónico).** Mismo pedido pero en efectivo: NO debe salir "Falta tu pago / reporta captura"; el mensaje es "Tu pedido ya aparece en la pantalla del local". Verifica que `lastOrderPaymentPending` y `orderNeedsPrepayReport` exigen `isElectronicPaymentMethod`.
3. **Mixto.** Pata electrónica → pide reportar; mixto puro efectivo → no. La sección de mixto exige método+monto de ambas patas antes de registrar.
4. **Config.** Comprueba en `/api/public/business-config`: `publicPrepayNoticeEnabled=true`, `publicPaymentBeforeRegisterEnabled=false` (suave), `paymentProofsEnabled=true`. Si el dueño quiere la versión ESTRICTA (no llega al local sin reportar), es `publicPaymentBeforeRegisterEnabled=true`.

## B. SEGURIDAD — roles y sede (los más serios del sistema)

5. **[R1] Todo cuelga del middleware `src/proxy.ts` (Next 16).** Es el ÚNICO punto que borra/reemite `x-staff-role`/`x-staff-branch-ids` desde el Bearer verificado; ninguna ruta re-verifica el token. Verifica: (a) que `proxy.ts` existe con `export function proxy` y `matcher:"/api/:path*"`; (b) que un `curl` a un endpoint sensible con `x-staff-role: owner` FALSO (sin Bearer válido) es rechazado. Riesgo: si alguien baja Next <16 o renombra el archivo, se cae el anti-spoofing → escalada total. Recomendación pendiente: defensa en profundidad (re-verificar Bearer en rutas sensibles) + test de humo que falle si el middleware no corre.
6. **[R2] Modo contraseña .env NO aísla por sede.** Con `x-admin-password`/`ORDERS_*_PASSWORD` el middleware no setea `x-staff-branch-ids` → `unrestricted` → un cajero con la clave compartida puede poner `x-branch-id:<otra sede>` y operar cualquier sede. Verifica si producción usa Supabase Auth (usuarios reales) o modo contraseña; si es contraseña con 2 sedes, este hueco está VIVO. Recomendación: usar Supabase Auth por persona, o atar sedes a cada clave.
7. **[R3] Usuario Supabase sin sedes = todas (fail-open).** Un staff creado sin `allowedBranchIds` ve TODAS las sedes. Verifica y considera invertir a fail-closed (sin sedes = sin acceso, salvo owner/support).
8. **[R4] Secretos compartidos / `support` ≈ super-admin.** `ADMIN_PASSWORD`/`ORDERS_OWNER_PASSWORD` dan owner global sin traza individual; `support` tiene todos los módulos y edita el plan. Audita quién tiene esas claves.
9. **Gating por rol/plan correcto (lo que SÍ está bien).** Cancelar pedido = solo owner; gestión de personal = owner/support; config de sede = owner; consolidado de reportes = owner/support. Módulos desactivados (reservas/proveedores) dan 403 server-side aunque se falsifique el rol (el gating por plan lee business_config, no el header).

## C. RESERVAS (completo pero apagado)

10. **Oculto en público.** Con el módulo apagado: la landing NO renderiza el botón "Reservar mesa" (BottomInfoSections, condicionado a `reservationsEnabled`), `/reservar` muestra "no disponible" y `POST /api/public/reservations` da 403. Verifica que sigue así. (Blind spot BAJO: el sitemap incluye `/reservar` siempre — SEO menor.)
11. **Gating consistente en 3 capas.** UI panel (ModuleAccessGuard) + API privada (403) + público, todas leen `getModulePlanAccess(config,"reservations")`. Default `reservationsModuleEnabled=false`, plan mínimo `complete`.
12. **Al activarlo, funciona.** CRUD completo con branch-scoping; estados activa/completada/cancelada/no_show; validación de solape (`reservationConflicts`). Blind spots: doble booking por condición de carrera (sin constraint DB) y `branch_id` nullable si no hay sede por defecto. Mesa reservada se marca ocupada pero NO bloquea abrir cuenta/pedido (solo aviso).

## Veredicto
Bloque A: debe cumplirse tal cual. Bloque B: R2 (modo contraseña multi-sede) es el hueco de seguridad más accionable si producción no usa Supabase Auth; R1 es fragilidad arquitectural a documentar/blindar. Bloque C: reservas OK, solo pendientes menores.
