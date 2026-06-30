# Fase 2 — Cuentas por mesa abiertas con QR

No requiere migraciones nuevas: usa el esquema de la Fase 0/1. Lo que cambió es
el flujo público para que el **cliente abra la cuenta de su mesa al escanear el QR**.

## Cómo funciona ahora

1. El cliente escanea el **QR de su mesa** → cae en el menú con la mesa
   preseleccionada (esto ya existía).
2. Al ir a registrar el pedido, si la mesa **no tiene cuenta abierta**, aparece
   el botón **"Abrir cuenta de la mesa"**. Un toque y la cuenta queda abierta.
3. A partir de ahí, cada pedido se **suma a la cuenta de la mesa** (sin cobrar).
   El cliente puede pedir las veces que quiera.
4. Cuando se van, **el personal cierra la cuenta y cobra** desde el panel de caja
   / cuentas abiertas.

## Garantía de que NO se mezcla

Cada apertura de mesa es una **fila de cuenta distinta** con su propio identificador.
Los pedidos se enganchan por ese identificador, no por el nombre de la mesa. Por eso:

- Una mesa puede abrir y cerrar **cuantas veces quieras al día**; cada sesión queda
  separada y guardada.
- El sistema impide tener **dos cuentas abiertas a la vez** en la misma mesa
  (índice único en la base). El historial de cuentas cerradas es ilimitado.

## Generar QR de mesas (el dueño)

Ya existe el panel **"Enlaces QR por mesa"** (en `local-santo/mesas` y el panel del
dueño). Genera una imagen QR por cada mesa configurada, con opciones de copiar,
imprimir y enviar. Para tener **más QR**, el dueño solo agrega más mesas en
Configuración del negocio: cada mesa nueva obtiene su QR automáticamente.

## Qué cambió en el código

- `src/app/api/public/open-accounts/route.ts` — **nuevo** endpoint público para que
  el cliente abra la cuenta de su mesa (sin contraseña; valida módulo y mesa;
  idempotente si ya hay una cuenta abierta).
- `src/app/api/public/business-config/route.ts` — expone `openAccountsEnabled`.
- `src/components/CartDrawer.tsx` — botón "Abrir cuenta de la mesa" en el caso de
  mesa sin cuenta, con su handler.
- `src/components/OpenAccountInfo.tsx` — **nueva** sección pública "Abrir cuenta"
  con las instrucciones (solo aparece si el módulo está activo).
- `src/app/page.tsx` — monta la sección en la home.

## Probar en local

```
npm run dev
```

1. Abre `/mesa/Mesa%201` (o escanea el QR de una mesa) → debe llevarte al menú con
   la mesa puesta.
2. Agrega productos y ve a registrar el pedido. Si la mesa está libre, toca
   **"Abrir cuenta de la mesa"** → el pedido se suma a la cuenta.
3. Repite con otro pedido en la misma mesa → debe sumarse a la misma cuenta.
4. En el panel (caja/cuentas abiertas) cierra y cobra la cuenta.
5. Vuelve a abrir la misma mesa → es una cuenta NUEVA, separada de la anterior.

> Requisito: el módulo **Cuentas abiertas** debe estar activo en Configuración del
> negocio (sigue gobernado por la config en Google Sheets hasta la Fase 3).
