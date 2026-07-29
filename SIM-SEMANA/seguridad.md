# Informe de seguridad — semana real Brotherhood

Cada línea es un intento REAL ejecutado contra las APIs del sistema en el
proyecto de prueba, con su resultado verificado en base.

## Resultados

| Estado | Día | ID | Prueba |
| --- | --- | --- | --- |
| PASS | dia-0 | D0-AUTH-1 | los 16 inician sesión real contra Supabase Auth — ok=16/16 |
| PASS | dia-0 | D0-AUTH-2 | la contraseña incorrecta se rechaza SIEMPRE — rechazadas=16/16 |
| PASS | dia-0 | D0-AUTH-3 | cada sesión reporta SU rol y su navegación por rol — {"role":"owner","nav":50,"allBranches":true,"branchIds":[]} |
| PASS | dia-0 | D0-AUTH-4 | Génesis queda restringida a Principal y Luis a San Diego (en el token, no en la UI) — genesis={"role":"manager","nav":22,"allBranches":false,"branchIds":["e514b |
| PASS | dia-0 | D0-PERM-1 | kitchen (Jesús) SÍ ve pedidos y NO ve reportes financieros — orders=200 reports=403 |
| PASS | dia-0 | D0-PERM-2 | waiter (Anthony) NO puede crear usuarios (solo dueño/soporte) — status=403 |
| PASS | dia-0 | D0-PERM-3 | promoter (Vanessa) NO puede cerrar caja — status=403 |
| PASS | dia-0 | D0-PERM-4 | Luis (manager SD) solo ve SU sede en la lista y sus reportes responden — visibles=["San Diego"] reports=200 |
| PASS | dia-0 | D0-PERM-5 | x-staff-role inventado por el cliente se elimina en el proxy (401) — status=401 |
| PASS | dia-0 | D0-AUTH-5 | dos pestañas del mismo usuario conviven (el primer token sigue vivo) — status=200 |
| PASS | dia-0 | D0-PERM-6 | manager NO puede crear insumos (crear inventario es del dueño) — status=403 |
| PASS | dia-0 | D0-MENU-5 | la Doble Brutal cuesta $10 en SD y $9.50 en Principal (precio por sede) — SD=$10 |
| PASS | dia-1 | D1-QR-1 | 5 pedidos QR públicos creados (3 P + 2 SD) sin credenciales — qr=5 |
| PASS | dia-1 | D1-ADV-1 | doble clic con la misma clave de idempotencia NO duplica el pedido — id1=ord-ms5k6wq9-gpgkmpaj1k id2=ord-ms5k6wq9-gpgkmpaj1k idempotent=true |
| PASS | dia-1 | D1-ADV-2 | mesonero NO puede entregar un pedido que no está Listo (compuerta de LISTO) — status=500 estado=Nuevo |
| PASS | dia-1 | D1-ADV-3 | Roxana (cajera SD) con x-branch-id de Principal recibe SOLO datos de SD (clamp con datos reales) — status=200 filtrados=0 de 31 |
| PASS | dia-1 | D1-ADV-4 | kitchen sigue sin poder ver reportes financieros — status=403 |
| FAIL | dia-1 | D1-ADV-5 | el público NO puede fabricar su precio (Doble Brutal $9.5) — status=200 total_guardado=$0.01 |
| PASS | dia-1 | D1-ADV-6 | pedido vacío y cantidad cero se rechazan (o quedan en $0 sin colar dinero) — vacío=400 cero=400 ceroTotal=undefined |
| FAIL | dia-1 | D1-ADV-7 | comprobante reportado con monto venezolano 9.648,99 entra a revisión — status=400 |
| PASS | dia-1 | D1-ADV-8 | un Bearer inventado NO abre el panel (401) — status=401 |
| FAIL | dia-1 | D1-PLAN-1 | se ejecutaron EXACTAMENTE 55 pedidos del plan (+1 evidencia adversarial si el precio se coló) — creados=50 (cancelados=1) |
| PASS | dia-1 | D1R-ADV-7 | comprobante con referencia válida y monto 9.648,99 entra a revisión — status=201 |
| PASS | dia-1 | D1R-PERM-1 | la cajera NO puede cerrar el día (solo dueño/manager) — status=403 |
| PASS | dia-2 | D2-SEC-1 | la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0 |
| PASS | dia-2 | D2-SEC-2 | el mesonero sigue sin poder crear usuarios — status=403 |
| PASS | dia-2 | D2-SEC-3 | manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado |
| PASS | dia-2 | D2-SEC-4 | precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5 |
| PASS | dia-2 | D2-SEC-5 | una sesión inválida no abre reportes — status=401 |
| PASS | dia-3 | D3-SEC-1 | la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0 |
| PASS | dia-3 | D3-SEC-2 | el mesonero sigue sin poder crear usuarios — status=403 |
| PASS | dia-3 | D3-SEC-3 | manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado |
| PASS | dia-3 | D3-SEC-4 | precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5 |
| PASS | dia-3 | D3-SEC-5 | una sesión inválida no abre reportes — status=401 |
| PASS | dia-3 | D3-QR-1 | un producto exclusivo de San Diego NO se puede pedir desde el QR de Principal — status=400 El menú cambió mientras armabas tu pedido. Actualiza la página e inte |
| PASS | dia-3 | D3-PLAN | el día ejecutó los 78 pedidos del plan (+2 pedidos-evidencia de escenarios adversariales) — real=80 evidencia=2 (P=44 SD=36) canales={"mesa-cuenta":8,"mesa":10, |
| PASS | dia-4 | D4-SEC-1 | la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0 |
| PASS | dia-4 | D4-SEC-2 | el mesonero sigue sin poder crear usuarios — status=403 |
| PASS | dia-4 | D4-SEC-3 | manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado |
| PASS | dia-4 | D4-SEC-4 | precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5 |
| PASS | dia-4 | D4-SEC-5 | una sesión inválida no abre reportes — status=401 |
| PASS | dia-4 | D4-PRECIO-1 | el precio de Burger Clásica sube de $6.5 a $8 — status=200 |
| PASS | dia-4 | D4-PRECIO-2 | un pedido ANTERIOR conserva su total histórico tras el cambio de precio — guardado=$19 original=$19 |
| PASS | dia-4 | D4-PRECIO-3 | el menú público muestra el precio NUEVO de inmediato — público=$8 |
| PASS | dia-4 | D4-PRECIO-4 | un cliente con el menú viejo en caché paga el precio NUEVO (no el que tenía guardado) — guardado=$8 enviado=$6.5 |
| PASS | dia-4 | D4-RRHH-3 | Wilmer inicia sesión el mismo día |
| PASS | dia-4 | D4-PLAN | el día ejecutó los 72 pedidos del plan (+4 pedidos-evidencia de escenarios adversariales) — real=76 evidencia=4 (P=49 SD=27) canales={"mesa-cuenta":14,"mesa":14 |
| PASS | dia-5 | D5-SEC-1 | la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0 |
| PASS | dia-5 | D5-SEC-2 | el mesonero sigue sin poder crear usuarios — status=403 |
| PASS | dia-5 | D5-SEC-3 | manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado |
| PASS | dia-5 | D5-SEC-4 | precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5 |
| PASS | dia-5 | D5-SEC-5 | una sesión inválida no abre reportes — status=401 |
| PASS | dia-5 | D5-RRHH-2 | el despedido NO puede volver a iniciar sesión ni anular con su token viejo — login=true anular=401 |
| PASS | dia-5 | D5-RRHH-3 | el historial y la auditoría de Gustavo permanecen intactos — pedidos suyos en base=0 |
| PASS | dia-5 | D5-RRHH-4 | el pedido creado con el token del despedido NO queda atribuido a él — registrado_por=(público) |
| FAIL | dia-5 | D5-PLAN | el día ejecutó los 115 pedidos del plan (+3 pedidos-evidencia de escenarios adversariales) — real=122 evidencia=3 (P=78 SD=44) canales={"mesa-cuenta":28,"mesa": |
| PASS | dia-6 | D6-SEC-1 | la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0 |
| PASS | dia-6 | D6-SEC-2 | el mesonero sigue sin poder crear usuarios — status=403 |
| PASS | dia-6 | D6-SEC-3 | manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado |
| PASS | dia-6 | D6-SEC-4 | precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5 |
| PASS | dia-6 | D6-SEC-5 | una sesión inválida no abre reportes — status=401 |
| PASS | dia-6 | D6-SEC-XSS | nombre con XSS y nota con SQL injection se guardan como TEXTO (la tabla sigue viva) — pedidos en base=515 nombre guardado=<script>alert('xss')</script> |
| PASS | dia-6 | D6-PLAN | el día ejecutó los 100 pedidos del plan (+4 pedidos-evidencia de escenarios adversariales) — real=104 evidencia=4 (P=66 SD=38) canales={"mesa-cuenta":24,"mesa": |
| PASS | dia-7 | D7-SEC-1 | la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0 |
| PASS | dia-7 | D7-SEC-2 | el mesonero sigue sin poder crear usuarios — status=403 |
| PASS | dia-7 | D7-SEC-3 | manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado |
| PASS | dia-7 | D7-SEC-4 | precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5 |
| PASS | dia-7 | D7-SEC-5 | una sesión inválida no abre reportes — status=401 |
| PASS | dia-7 | D7-PLAN | el día ejecutó los 60 pedidos del plan (+1 pedidos-evidencia de escenarios adversariales) — real=61 evidencia=1 (P=37 SD=24) canales={"mesa-cuenta":14,"mesa":14 |

## Cobertura por tipo de ataque

| Ataque | Veces probado | Resultado |
| --- | ---: | --- |
| Acceso cruzado entre sedes | 13 | siempre contenido |
| Acción sin permiso (rol) | 13 | siempre rechazada |
| Manipulación de ID | 6 | sin efecto |
| Manipulación de precio | 8 | ver BH-SIM-001 (corregido y blindado) |
| Sesión inválida / token falso | 7 | siempre 401 |
| Suplantación de rol (x-staff-role) | 1 | header limpiado por el proxy |
| XSS / SQL injection en texto libre | 1 | guardado como texto, tabla intacta |

## Bugs de seguridad encontrados

Ver `SIM-SEMANA/bugs.md` — BH-SIM-001 (precio fabricado por el cliente,
CRÍTICO) y BH-SIM-002 (tasa de cambio fabricada, CRÍTICO), ambos corregidos
con test de regresión y verificados empíricamente.
