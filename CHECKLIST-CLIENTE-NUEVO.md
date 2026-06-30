# Checklist — Montar un cliente nuevo (servicio llave en mano)

Receta repetible para dejar una instancia lista. Tiempo estimado: ~30–45 min.

---

## 1. Copia del proyecto
- [ ] Duplica esta plantilla en una carpeta nueva del cliente.
- [ ] `npm install`

## 2. Supabase (base de datos del cliente)
- [ ] Crea un proyecto nuevo en https://supabase.com (plan Free).
- [ ] **SQL Editor** → corre en orden TODOS los archivos de `supabase/migrations/`:
  - `0001_initial_schema.sql`
  - `0002_seed_defaults.sql`
  - `0003_orders_seq.sql`
  - `0004_*` (si existe)
  - `0005_inventory.sql`
  - `0006_caja.sql`
  - `0007_order_attachment.sql`
  - `0013_*` / `0014_supplier_payables.sql` / `0015_business_complexity_controls.sql` si existen en la instancia actual
- [ ] **Storage** → crea 3 buckets **públicos**: `menu-images`, `payment-proofs`, `order-attachments`.
      (También se crean solos al subir la primera imagen, pero mejor dejarlos listos.)
- [ ] Copia de **Project Settings → API**: URL, anon key y service_role key.

## 3. Variables de entorno
- [ ] `cp .env.example .env.local`
- [ ] Rellena las 3 claves de Supabase.
- [ ] Pon contraseñas fuertes para cada rol (`ORDERS_*_PASSWORD`).

## 4. Marca (white-label)
- [ ] Edita `src/lib/brand.ts`: nombre, eslogan, WhatsApp, Instagram, ubicación, moneda, idioma, zona horaria.
- [ ] Logo: pon el archivo del cliente en `/public` y su ruta en `BRAND.logoUrl` (ej. `/logo.png`).
- [ ] Colores: edita los valores `nuevo` en `brand-colors.json` y corre:
  ```
  node scripts/rebrand-colors.mjs --dry   # ver qué cambiaría
  node scripts/rebrand-colors.mjs         # aplicar
  ```

## 5. Datos iniciales
- [ ] (Opcional, para demo o arranque) Carga menú y mesas de ejemplo:
  ```
  node scripts/seed-demo.mjs
  ```
- [ ] O entra al panel del dueño y carga el menú/mesas reales del cliente.
- [ ] En **Configuración del negocio**: nombre, horario, WhatsApp, y activa los
      módulos del plan contratado (incluye **Cuentas abiertas** si lo usará).
- [ ] En **Complejidad y permisos**, elige Simple / Estándar / Avanzado o Personalizado según lo que el dueño quiere que pueda hacer el cliente.
- [ ] Carga las **zonas de delivery** (si aplica).
- [ ] Crea recetas para los productos principales y costos por insumo para que Reportes 2e calcule margen aproximado.

## 6. Prueba local
- [ ] `npm run dev`
- [ ] Verifica: crear pedido → cobrar en caja → abrir cuenta por QR →
      adjuntar imagen → menú con imagen → inventario → proveedor/compra →
      cuenta por pagar/abono parcial → cierre de caja.
- [ ] En `/local-santo/soporte`, revisa que Supabase, Storage, variables, módulos, productos, proveedores, compras, cuentas por pagar, inventario, comprobantes y cuentas abiertas respondan correctamente.
- [ ] Con `npm run dev` activo, ejecuta `npm run e2e:purchase-inventory` para confirmar Compra → Inventario.
- [ ] Con `npm run dev` activo, ejecuta `npm run e2e:supplier-payables` para confirmar vencimientos, pagos parciales y estado pagado.
- [ ] Con `npm run dev` activo, ejecuta `npm run e2e:business-complexity` para confirmar perfiles y permisos públicos.
- [ ] Revisa que la marca, el logo y los colores se vean correctos.

## 7. Despliegue (Vercel)
- [ ] Importa el proyecto en Vercel.
- [ ] Carga TODAS las variables de `.env.local` en Vercel (Settings → Environment Variables).
- [ ] Deploy. Abre la URL y repite una prueba rápida del flujo.
- [ ] Genera los QR de mesa desde el panel e imprímelos para el cliente.

## 8. Entrega
- [ ] Pasa al cliente las URLs (pública + `/pedidos`) y sus contraseñas por rol.
- [ ] Explica: panel del dueño, caja, cocina, cuentas por QR.

---

### Recordatorios
- El sistema corre 100% en Supabase como backend único.
- Cada cliente = su propio proyecto Supabase + su propio deploy (instancias separadas).
- El plan Free de Supabase permite 2 proyectos por organización; crea una organización nueva si te quedas sin cupo.
