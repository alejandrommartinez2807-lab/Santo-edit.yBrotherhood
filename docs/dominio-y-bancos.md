# Dominio .com y métodos de pago (bancos)

Guía para el dueño: cómo tener el sitio en un dominio propio `.com` y cómo
configurar los métodos de pago que ve el cliente.

## Conseguir el dominio .com

El `.com` se **alquila por año** (± 10-13 USD/año) en un registrador. Opciones,
de más fácil a más barata:

1. **Vercel (recomendado si quieres cero configuración).** En el panel del
   proyecto (vercel.com → proyecto `brotherhood` → Settings → Domains) puedes
   buscar y comprar el dominio ahí mismo; queda conectado automáticamente,
   con SSL incluido. Requiere tarjeta internacional.
2. **Namecheap / Porkbun.** Suelen ser más baratos y aceptan PayPal (útil si
   no tienes tarjeta internacional). Se compra el dominio y luego se conecta
   a Vercel (paso siguiente).
3. **Cloudflare Registrar.** Precio de costo (el más barato a la larga), pero
   pide tarjeta y es un poco más técnico.

### Conectar un dominio comprado fuera de Vercel

1. En Vercel: proyecto → **Settings → Domains** → escribir el dominio → Add.
2. Vercel muestra los registros DNS a crear en el registrador:
   - Dominio raíz (`midominio.com`): registro **A** → `76.76.21.21`
   - `www`: registro **CNAME** → `cname.vercel-dns.com`
3. Guardar y esperar la propagación (minutos a pocas horas). Vercel emite el
   certificado SSL solo.

Cada plantilla/cliente (Santo Perrito, Brotherhood, demos) es un proyecto
Vercel separado, así que cada uno puede tener su propio `.com`.

## Métodos de pago del carrito (bancos)

Lo que el cliente ve al pedir se configura desde el panel, sin tocar código:

- **Dónde:** `Configuración` → campo **"Métodos de pago del carrito"**
  (uno por línea). Ejemplos: `Pago móvil Banesco 0412-0000000 V-12345678`,
  `Zelle correo@ejemplo.com`, `Efectivo (USD o Bs)`.
- El cliente elige el método al confirmar el pedido y puede **reportar su
  pago** desde la confirmación si "pagos online" está activo.
- El staff verifica el pago en **Caja** antes de marcar el pedido cobrado.

### Recomendaciones

- Incluir en cada línea todos los datos que el cliente necesita para pagar
  sin preguntar (banco, teléfono, cédula/RIF, correo de Zelle).
- Revisar los datos tras cualquier cambio de cuenta bancaria: es texto libre,
  el sistema no valida que la cuenta exista.
- En eventos/ferias, la sede del evento puede tener su propia configuración
  (Configuración por sede) si se cobra con otra cuenta.
