# Día 0 — Fundación y línea base

run: brotherhood-week-001 · inicio real: 2026-07-29T03:29:47.427Z

- `PASS` **D0-SEDE-1** la base arranca con solo la sede Principal — ["Principal"]
- `PASS` **D0-SEDE-2** San Diego se crea con el módulo real de Sucursales — status=201 id=395e3b33-cda3-4111-8dd5-a5ee52d43cd6
- `PASS` **D0-SEDE-3** la base tiene exactamente 2 sedes activas — ["Principal","San Diego"]
- `PASS` **D0-SEDE-4** Principal queda configurada (mesas, whatsapp, delivery por km, impresión auto) — status=200
- `PASS` **D0-SEDE-5** San Diego queda con overrides propios (mesas y whatsapp) — status=200
- `FAIL` **D0-SEDE-6** cada sede publica SU whatsapp y no se filtra el de la otra — P=false SD=false filtración=false
- `PASS` **D0-USER-alejandro** Alejandro (Dueño) (owner) creado por /api/staff — status=201 
- `PASS` **D0-USER-genesis** Génesis (manager) creado por /api/staff — status=201 
- `PASS` **D0-USER-luis** Luis (manager) creado por /api/staff — status=201 
- `PASS` **D0-USER-mariafernanda** María Fernanda (cashier) creado por /api/staff — status=201 
- `PASS` **D0-USER-kelvin** Kelvin (cashier) creado por /api/staff — status=201 
- `PASS` **D0-USER-roxana** Roxana (cashier) creado por /api/staff — status=201 
- `PASS` **D0-USER-jesus** Jesús (kitchen) creado por /api/staff — status=201 
- `PASS` **D0-USER-dubraska** Dubraska (kitchen) creado por /api/staff — status=201 
- `PASS` **D0-USER-carlosalberto** Carlos Alberto (kitchen) creado por /api/staff — status=201 
- `PASS` **D0-USER-anthony** Anthony (waiter) creado por /api/staff — status=201 
- `PASS` **D0-USER-yorgelis** Yorgelis (waiter) creado por /api/staff — status=201 
- `PASS` **D0-USER-daniela** Daniela (waiter) creado por /api/staff — status=201 
- `PASS` **D0-USER-miguel** Miguel (delivery) creado por /api/staff — status=201 
- `PASS` **D0-USER-vanessa** Vanessa (promoter) creado por /api/staff — status=201 
- `PASS` **D0-USER-soporteqa** Usuario QA Support (support) creado por /api/staff — status=201 
- `PASS` **D0-USER-gustavo** Gustavo (waiter) creado por /api/staff — status=201 
- `PASS` **D0-USER-total** los 16 usuarios del elenco existen en staff_users — staff_users=16
- `PASS` **D0-AUTH-1** los 16 inician sesión real contra Supabase Auth — ok=16/16
- `PASS` **D0-AUTH-2** la contraseña incorrecta se rechaza SIEMPRE — rechazadas=16/16
- `PASS` **D0-AUTH-3** cada sesión reporta SU rol y su navegación por rol — {"role":"owner","nav":50,"allBranches":true,"branchIds":[]}

Navegación por usuario: {"alejandro":{"role":"owner","nav":50,"allBranches":true,"branchIds":[]},"genesis":{"role":"manager","nav":22,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"luis":{"role":"manager","nav":22,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"mariafernanda":{"role":"cashier","nav":5,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"kelvin":{"role":"cashier","nav":5,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"roxana":{"role":"cashier","nav":5,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"jesus":{"role":"kitchen","nav":3,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"dubraska":{"role":"kitchen","nav":3,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"carlosalberto":{"role":"kitchen","nav":3,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"anthony":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"yorgelis":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"daniela":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"miguel":{"role":"delivery","nav":1,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"vanessa":{"role":"promoter","nav":4,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"soporteqa":{"role":"support","nav":50,"allBranches":true,"branchIds":[]},"gustavo":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]}}

- `PASS` **D0-AUTH-4** Génesis queda restringida a Principal y Luis a San Diego (en el token, no en la UI) — genesis={"role":"manager","nav":22,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]} luis={"role":"manager","nav":22,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]}
- `PASS` **D0-PERM-1** kitchen (Jesús) SÍ ve pedidos y NO ve reportes financieros — orders=200 reports=403
- `PASS` **D0-PERM-2** waiter (Anthony) NO puede crear usuarios (solo dueño/soporte) — status=403
- `PASS` **D0-PERM-3** promoter (Vanessa) NO puede cerrar caja — status=403
- `FAIL` **D0-PERM-4** Luis (manager SD) NO puede pedir reportes de Principal pero SÍ los suyos — cruzado=200 propio=200
- `PASS` **D0-PERM-5** x-staff-role inventado por el cliente se elimina en el proxy (401) — status=401
- `PASS` **D0-AUTH-5** dos pestañas del mismo usuario conviven (el primer token sigue vivo) — status=200
- `FAIL` **D0-AUDIT-1** staff.created queda en auditoría por cada usuario — filas=0
- `FAIL` **D0-INV-1** 18 insumos creados en cada sede (36 filas con stock propio) — P=0 SD=0
- `FAIL` **D0-INV-2** el stock inicial quedó como se cargó (Pan: P=400, SD=240) — P=NaN SD=NaN
- `FAIL` **D0-INV-3** las cargas iniciales registran autor real — movimientos=undefined autores=[]
- `FAIL` **D0-PROV-1** los 5 proveedores existen — []
- `FAIL` **D0-COMPRA-FT-1001** factura FT-1001 de Carnes El Toro ($220, credito) — status=403
- `FAIL` **D0-COMPRA-PE-501** factura PE-501 de Panadería La Espiga ($70, pagada) — status=403
- `FAIL` **D0-COMPRA-BC-88** factura BC-88 de Bebidas Corocorote ($96, credito) — status=403
- `FAIL` **D0-COMPRA-EC-77** factura EC-77 de Empaques Carabobo ($36, pagada) — status=403
- `FAIL` **D0-COMPRA-VC-33** factura VC-33 de Verduras Doña Chela ($60, parcial) — status=403

---
reanudado: 2026-07-29T03:37:05.407Z

- `PASS` **D0-SEDE-1** reanudación: la sede Principal existe — ["Principal","San Diego"]
- `PASS` **D0-SEDE-3** la base tiene exactamente 2 sedes activas — ["Principal","San Diego"]
- `PASS` **D0-SEDE-4** config global lista (whatsapp/mesas de Principal, impresión auto, descuento de inventario ON) — status=200
- `PASS` **D0-SEDE-5** San Diego guarda su override real de sede (mesas y whatsapp propios) — status=200
- `PASS` **D0-SEDE-5b** Principal queda con envío por distancia activo (tarifas por km) — status=200
- `PASS` **D0-SEDE-6** cada sede publica SU whatsapp y no se filtra el de la otra — P=584125550101 SD=584245550201
- `PASS` **D0-USER-total** los 16 usuarios del elenco existen en staff_users — staff_users=16
- `PASS` **D0-AUTH-1** los 16 inician sesión real contra Supabase Auth — ok=16/16
- `PASS` **D0-AUTH-2** la contraseña incorrecta se rechaza SIEMPRE — rechazadas=16/16
- `PASS` **D0-AUTH-3** cada sesión reporta SU rol y su navegación por rol — {"role":"owner","nav":50,"allBranches":true,"branchIds":[]}

Navegación por usuario: {"alejandro":{"role":"owner","nav":50,"allBranches":true,"branchIds":[]},"genesis":{"role":"manager","nav":22,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"luis":{"role":"manager","nav":22,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"mariafernanda":{"role":"cashier","nav":5,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"kelvin":{"role":"cashier","nav":5,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"roxana":{"role":"cashier","nav":5,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"jesus":{"role":"kitchen","nav":3,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"dubraska":{"role":"kitchen","nav":3,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"carlosalberto":{"role":"kitchen","nav":3,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"anthony":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"yorgelis":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"daniela":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"miguel":{"role":"delivery","nav":1,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"vanessa":{"role":"promoter","nav":4,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"soporteqa":{"role":"support","nav":50,"allBranches":true,"branchIds":[]},"gustavo":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]}}

- `PASS` **D0-AUTH-4** Génesis queda restringida a Principal y Luis a San Diego (en el token, no en la UI) — genesis={"role":"manager","nav":22,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]} luis={"role":"manager","nav":22,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]}
- `PASS` **D0-PERM-1** kitchen (Jesús) SÍ ve pedidos y NO ve reportes financieros — orders=200 reports=403
- `PASS` **D0-PERM-2** waiter (Anthony) NO puede crear usuarios (solo dueño/soporte) — status=403
- `PASS` **D0-PERM-3** promoter (Vanessa) NO puede cerrar caja — status=403
- `PASS` **D0-PERM-4** Luis (manager SD) solo ve SU sede en la lista y sus reportes responden — visibles=["San Diego"] reports=200
- `PASS` **D0-PERM-5** x-staff-role inventado por el cliente se elimina en el proxy (401) — status=401
- `PASS` **D0-AUTH-5** dos pestañas del mismo usuario conviven (el primer token sigue vivo) — status=200
- `PASS` **D0-AUDIT-1** staff.created queda en auditoría por cada usuario — filas=16
- `PASS` **D0-PERM-6** manager NO puede crear insumos (crear inventario es del dueño) — status=403
- `PASS` **D0-INV-1** 18 insumos creados en cada sede (36 filas con stock propio) — P=18 SD=18
- `PASS` **D0-INV-2** el stock inicial quedó como se cargó (Pan: P=400, SD=240) — P=400 SD=240
- `FAIL` **D0-INV-3** las cargas iniciales registran autor real — movimientos=undefined autores=[]
- `FAIL` **D0-PROV-1** los 5 proveedores existen — []
- `FAIL` **D0-COMPRA-FT-1001** factura FT-1001 de Carnes El Toro ($220, credito) — status=403
- `FAIL` **D0-COMPRA-PE-501** factura PE-501 de Panadería La Espiga ($70, pagada) — status=403
- `FAIL` **D0-COMPRA-BC-88** factura BC-88 de Bebidas Corocorote ($96, credito) — status=403
- `FAIL` **D0-COMPRA-EC-77** factura EC-77 de Empaques Carabobo ($36, pagada) — status=403
- `FAIL` **D0-COMPRA-VC-33** factura VC-33 de Verduras Doña Chela ($60, parcial) — status=403
- `FAIL` **D0-COMPRA-saldos** los saldos por pagar cuadran al centavo (2 en $0, 2 completas, 1 abonada) — FT-1001: sin factura creada · PE-501: sin factura creada · BC-88: sin factura creada · EC-77: sin factura creada · VC-33: sin factura creada
- `PASS` **D0-MENU-1** Principal tiene su menú completo (12 productos + 2 combos + 1 exclusivo) — productos=15
- `PASS` **D0-MENU-2** San Diego SIN menú propio hereda el menú de Principal (público) — hereda 15 productos
- `PASS` **D0-MENU-3** San Diego crea su menú propio (14 + 1 exclusivo) — productos=15
- `PASS` **D0-MENU-4** con menú propio, SD deja de heredar: ve SU menú (con Patacón, sin Malta) — productos=15
- `PASS` **D0-MENU-5** la Doble Brutal cuesta $10 en SD y $9.50 en Principal (precio por sede) — SD=$10
- `PASS` **D0-MENU-6** Principal NO ve el exclusivo de SD (aislamiento del menú) — productos=15
- `PASS` **D0-GASTO-Alquiler loc** gasto "Alquiler local Principal (ficticio)" ($350) — status=200
- `PASS` **D0-GASTO-Limpieza pro** gasto "Limpieza profunda de apertura" ($40) — status=200
- `PASS` **D0-GASTO-Hielo de arr** gasto "Hielo de arranque" ($12) — status=200
- `PASS` **D0-GASTO-Mantenimient** gasto "Mantenimiento menor plancha SD" ($25) — status=200

Línea base (conteo por tabla): {"branches":2,"staff_users":16,"inventory_items":36,"inventory_movements":36,"suppliers":0,"supplier_purchases":0,"menu_products":30,"inventory_recipes":28,"day_expenses":4,"orders":0,"audit_logs":19}

- `PASS` **D0-BASE-1** la base de fundación está poblada y sin pedidos aún — {"branches":2,"staff_users":16,"inventory_items":36,"inventory_movements":36,"suppliers":0,"supplier_purchases":0,"menu_products":30,"inventory_recipes":28,"day_expenses":4,"orders":0,"audit_logs":19}
- `PASS` **D0-BASE-2** cierre técnico de fundación registrado (Principal) — status=200
- `PASS` **D0-BASE-3** cierre técnico de fundación registrado (San Diego) — status=200

---
reanudado: 2026-07-29T03:42:08.137Z

- `PASS` **D0-SEDE-1** reanudación: la sede Principal existe — ["Principal","Brotherhood San Diego"]
- `PASS` **D0-SEDE-3** la base tiene exactamente 2 sedes activas — ["Principal","San Diego"]
- `PASS` **D0-SEDE-4** config global lista (whatsapp/mesas de Principal, impresión auto, descuento de inventario ON) — status=200
- `PASS` **D0-SEDE-5** San Diego guarda su override real de sede (mesas y whatsapp propios) — status=200
- `PASS` **D0-SEDE-5b** Principal queda con envío por distancia activo (tarifas por km) — status=200
- `PASS` **D0-SEDE-6** cada sede publica SU whatsapp y no se filtra el de la otra — P=584125550101 SD=584245550201
- `PASS` **D0-USER-total** los 16 usuarios del elenco existen en staff_users — staff_users=16
- `PASS` **D0-AUTH-1** los 16 inician sesión real contra Supabase Auth — ok=16/16
- `PASS` **D0-AUTH-2** la contraseña incorrecta se rechaza SIEMPRE — rechazadas=16/16
- `PASS` **D0-AUTH-3** cada sesión reporta SU rol y su navegación por rol — {"role":"owner","nav":50,"allBranches":true,"branchIds":[]}

Navegación por usuario: {"alejandro":{"role":"owner","nav":50,"allBranches":true,"branchIds":[]},"genesis":{"role":"manager","nav":22,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"luis":{"role":"manager","nav":22,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"mariafernanda":{"role":"cashier","nav":5,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"kelvin":{"role":"cashier","nav":5,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"roxana":{"role":"cashier","nav":5,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"jesus":{"role":"kitchen","nav":3,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"dubraska":{"role":"kitchen","nav":3,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"carlosalberto":{"role":"kitchen","nav":3,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"anthony":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"yorgelis":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"daniela":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]},"miguel":{"role":"delivery","nav":1,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"vanessa":{"role":"promoter","nav":4,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]},"soporteqa":{"role":"support","nav":50,"allBranches":true,"branchIds":[]},"gustavo":{"role":"waiter","nav":8,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]}}

- `PASS` **D0-AUTH-4** Génesis queda restringida a Principal y Luis a San Diego (en el token, no en la UI) — genesis={"role":"manager","nav":22,"allBranches":false,"branchIds":["e514be79-bb39-4050-9f27-e6c10249a1cf"]} luis={"role":"manager","nav":22,"allBranches":false,"branchIds":["395e3b33-cda3-4111-8dd5-a5ee52d43cd6"]}
- `PASS` **D0-PERM-1** kitchen (Jesús) SÍ ve pedidos y NO ve reportes financieros — orders=200 reports=403
- `PASS` **D0-PERM-2** waiter (Anthony) NO puede crear usuarios (solo dueño/soporte) — status=403
- `PASS` **D0-PERM-3** promoter (Vanessa) NO puede cerrar caja — status=403
- `PASS` **D0-PERM-4** Luis (manager SD) solo ve SU sede en la lista y sus reportes responden — visibles=["San Diego"] reports=200
- `PASS` **D0-PERM-5** x-staff-role inventado por el cliente se elimina en el proxy (401) — status=401
- `PASS` **D0-AUTH-5** dos pestañas del mismo usuario conviven (el primer token sigue vivo) — status=200
- `PASS` **D0-AUDIT-1** staff.created queda en auditoría por cada usuario — filas=16
- `PASS` **D0-PERM-6** manager NO puede crear insumos (crear inventario es del dueño) — status=403
- `PASS` **D0-INV-1** 18 insumos creados en cada sede (36 filas con stock propio) — P=18 SD=18
- `PASS` **D0-INV-2** el stock inicial quedó como se cargó (Pan: P=400, SD=240) — P=400 SD=240
- `PASS` **D0-INV-3** cada insumo deja su movimiento 'Carga inicial' en SU sede (18+18) — P=18 SD=18
- `PASS` **D0-PROV-1** los 5 proveedores existen — ["Carnes El Toro","Panadería La Espiga","Bebidas Corocorote","Empaques Carabobo","Verduras Doña Chela"]
- `PASS` **D0-COMPRA-FT-1001** factura FT-1001 de Carnes El Toro ($220, credito) — status=201
- `PASS` **D0-COMPRA-FT-1001-stock** la compra suma stock (Carne 150g: 300→500) — real=500
- `PASS` **D0-COMPRA-PE-501** factura PE-501 de Panadería La Espiga ($70, pagada) — status=201
- `PASS` **D0-COMPRA-PE-501-stock** la compra suma stock (Pan de hamburguesa: 400→600) — real=600
- `PASS` **D0-COMPRA-BC-88** factura BC-88 de Bebidas Corocorote ($96, credito) — status=201
- `PASS` **D0-COMPRA-BC-88-stock** la compra suma stock (Refresco 1.5L: 150→210) — real=210
- `PASS` **D0-COMPRA-EC-77** factura EC-77 de Empaques Carabobo ($36, pagada) — status=201
- `PASS` **D0-COMPRA-EC-77-stock** la compra suma stock (Empaques burger: 500→800) — real=800
- `PASS` **D0-COMPRA-VC-33** factura VC-33 de Verduras Doña Chela ($60, parcial) — status=201
- `PASS` **D0-COMPRA-VC-33-stock** la compra suma stock (Vegetales frescos: 50→100) — real=100
- `PASS` **D0-COMPRA-saldos** los saldos por pagar cuadran al centavo (2 en $0, 2 completas, 1 abonada) — FT-1001: esperado=$220 real=$220 · PE-501: esperado=$0 real=$0 · BC-88: esperado=$96 real=$96 · EC-77: esperado=$0 real=$0 · VC-33: esperado=$36 real=$36
- `PASS` **D0-MENU-1** Principal tiene su menú completo (12 productos + 2 combos + 1 exclusivo) — productos=15
- `FAIL` **D0-MENU-2** San Diego SIN menú propio hereda el menú de Principal (público) — hereda 15 productos
- `PASS` **D0-MENU-3** San Diego crea su menú propio (14 + 1 exclusivo) — productos=15
- `PASS` **D0-MENU-4** con menú propio, SD deja de heredar: ve SU menú (con Patacón, sin Malta) — productos=15
- `PASS` **D0-MENU-5** la Doble Brutal cuesta $10 en SD y $9.50 en Principal (precio por sede) — SD=$10
- `PASS` **D0-MENU-6** Principal NO ve el exclusivo de SD (aislamiento del menú) — productos=15

Línea base (conteo por tabla): {"branches":2,"staff_users":16,"inventory_items":36,"inventory_movements":41,"suppliers":5,"supplier_purchases":5,"menu_products":30,"inventory_recipes":28,"day_expenses":4,"orders":0,"audit_logs":30}

- `PASS` **D0-BASE-1** la base de fundación está poblada y sin pedidos aún — {"branches":2,"staff_users":16,"inventory_items":36,"inventory_movements":41,"suppliers":5,"supplier_purchases":5,"menu_products":30,"inventory_recipes":28,"day_expenses":4,"orders":0,"audit_logs":30}
- `PASS` **D0-BASE-2** cierre técnico de fundación registrado (Principal) — status=200
- `PASS` **D0-BASE-3** cierre técnico de fundación registrado (San Diego) — status=200
