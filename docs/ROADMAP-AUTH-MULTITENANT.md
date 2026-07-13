# Roadmap: autenticación y multi-tenant

Plan **accionable y por fases** para endurecer auth y aislamiento. Escrito para ejecutarse de a poco, con verificación al final de cada fase, sin romper la operación. Contexto en [`TRASPASO-TECNICO.md`](TRASPASO-TECNICO.md) §5.

## Realidad actual (importante, corrige el mito de "no es multi-tenant")

Hoy **cada marca/cliente es un despliegue separado**: su propio proyecto de Supabase + su propio proyecto de Vercel. Eso significa que **el aislamiento entre clientes ya es fuerte** — los datos de un cliente ni siquiera viven en la misma base que los de otro. Es un modelo *single-tenant por despliegue*, no un multi-tenant compartido.

Dentro de un cliente, la separación por **sede** se hace por `branch_id`, filtrado **en el código** (el backend usa el service role de Supabase, que hoy **salta RLS**). Funciona y hay *fitness guards* que fallan el test si alguien olvida filtrar por sede.

Entonces hay dos temas distintos que a veces se mezclan:
1. **Robustez de auth** (usuarios propios vs claves compartidas) — mejorable ya.
2. **Estrategia de escala** (¿seguir un despliegue por cliente, o mover a multi-tenant compartido?) — decisión de negocio, no urgente.

## Fase 0 — Guardrails y visibilidad (bajo riesgo, hacer primero)

Meta: blindar lo que ya existe antes de cambiar nada.

- Inventariar cada uso de `getSupabaseAdmin()` y confirmar que **toda** consulta operativa filtra por `branch_id` (ampliar los fitness guards a más tablas).
- Añadir tests que intenten leer datos de otra sede y **deben fallar**.
- Documentar las superficies de auth (headers `x-staff-*`, `x-branch-id`, contraseñas por rol).
- Verificación: `npm test` verde + revisión manual del inventario.

## Fase 1 — Usuarios propios como estándar (retirar claves compartidas)

Meta: cada persona con su cuenta; las claves por rol (`.env`) quedan como *fallback* a apagar por cliente.

- `staff_users` pasa a ser la fuente canónica (ya existe la tabla y el forward de rol por middleware).
- Bandera por negocio `requireNamedUsers`: cuando está activa, se rechaza el login por clave compartida.
- Migrar cada cliente creando sus usuarios y activando la bandera; recién ahí se pueden borrar las `ORDERS_*_PASSWORD`.
- Beneficio inmediato: la **auditoría** deja de decir solo el rol y siempre dice **quién** (ver módulo Auditoría).
- Verificación: login por usuario en cada rol; auditoría muestra nombre; el fallback por clave sigue funcionando hasta apagarlo.

## Fase 2 — RLS por sede en Supabase (defensa en profundidad)

Meta: que aunque haya un bug en el código o se filtre una clave, la base **no** deje cruzar datos entre sedes.

- Activar Row Level Security en las tablas operativas con política por `branch_id` (y por usuario donde aplique).
- Introducir un **rol de base con RLS** para las operaciones de usuario, y reservar el service role solo para tareas administrativas puntuales.
- Hacerlo **tabla por tabla**, primero en modo observación (log) y luego enforcing, para no tumbar nada.
- Riesgo: medio (requiere probar cada endpoint). Se hace incremental. Migraciones las aplica el dueño.
- Verificación: cada módulo sigue funcionando por sede; un intento de leer otra sede con el rol de usuario es rechazado por la base.

## Fase 3 — Decisión de escala (negocio)

Solo cuando el volumen lo pida. Dos caminos, elegir uno:

**Opción A — Seguir single-tenant y automatizar el alta.** Mantener un Supabase+Vercel por cliente, pero con un **script/asistente de provisioning** (crea proyectos, carga env, aplica migraciones, siembra la marca). Bajo riesgo, conserva el aislamiento fuerte. Ideal hasta decenas de clientes.

**Opción B — Multi-tenant compartido.** Una sola base y un solo despliegue sirviendo a muchos negocios por subdominio, con `tenant_id` en todas las tablas + RLS por tenant. Escala a cientos de clientes barato, pero es el cambio más grande y riesgoso (columna tenant en todo, routing, migración de datos, RLS estricta). Solo vale la pena con muchos clientes.

Recomendación: **A ahora, B solo si el negocio crece a escala.** La Fase 2 (RLS por sede) es un buen paso hacia B sin comprometerse todavía.

## Orden sugerido y esfuerzo

| Fase | Riesgo | Esfuerzo | Cuándo |
|---|---|---|---|
| 0 · Guardrails | Bajo | Bajo | Ya |
| 1 · Usuarios propios | Bajo–Medio | Medio | Corto plazo |
| 2 · RLS por sede | Medio | Medio–Alto | Medio plazo |
| 3 · Escala (A/B) | A: bajo / B: alto | Según opción | Cuando el volumen lo pida |

Cada fase es independiente y deja el sistema estable. No arrancar la Fase 2 ni la 3 sin aprobar el alcance primero.
