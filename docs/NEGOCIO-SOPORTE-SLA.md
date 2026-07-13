# Política de soporte y SLA (plantilla)

> Plantilla base para ofrecer soporte formal a los clientes del POS. Ajusta tiempos y canales a lo que puedas cumplir de verdad — un SLA que no cumples resta confianza. **No es asesoría legal**; si lo anexas a un contrato, revísalo con un abogado.

## 1. Canales de soporte

- **WhatsApp de soporte** (principal): +58 ____ · horario __:__ a __:__ (hora Venezuela), L–S.
- **Correo**: soporte@__________.
- **Emergencias** (caída total en horario de servicio): número directo ____.

## 2. Niveles de severidad y tiempos de respuesta (SLA)

| Severidad | Ejemplo | Respuesta | Solución objetivo |
|---|---|---|---|
| **P1 – Crítico** | El sistema no carga / no se puede cobrar en toda la sede | ≤ 1 h en horario | ≤ 4 h |
| **P2 – Alto** | Un módulo caído (cocina, inventario) pero se puede seguir cobrando | ≤ 4 h | ≤ 1 día hábil |
| **P3 – Medio** | Error puntual, dato mal mostrado, duda operativa | ≤ 1 día hábil | ≤ 3 días hábiles |
| **P4 – Bajo** | Mejora, ajuste estético, pedido de nueva función | ≤ 2 días hábiles | Según planificación |

> "Respuesta" = primer contacto humano, no solución. Los tiempos corren en **horario de soporte**.

## 3. Qué incluye el soporte

- Resolución de fallas del sistema y errores de la aplicación.
- Ayuda operativa (cómo cobrar, cerrar caja, cargar menú, generar QR, etc.).
- Aplicación de actualizaciones y correcciones.
- Respaldo de datos periódico (ver §5).
- Alta de sedes y usuarios dentro del plan contratado.

## 4. Qué NO incluye (se cotiza aparte)

- Desarrollo de funciones nuevas a medida.
- Integraciones con sistemas de terceros no contemplados.
- Capacitación adicional fuera del onboarding inicial.
- Recuperación de datos por mal uso del cliente sin respaldo disponible.
- Hardware (impresoras, tablets, internet del local).

## 5. Respaldos y continuidad

- Respaldo de datos **cada __** (diario/semanal). Retención: __ días.
- Ante un incidente grave, restauración desde el último respaldo disponible.
- Los datos viven en Supabase; el cliente puede solicitar una **exportación** de su información en cualquier momento.

## 6. Mantenimiento y actualizaciones

- Las actualizaciones se publican sin costo dentro del plan.
- El mantenimiento programado (si lo hay) se avisa con __ h de anticipación y se hace fuera del horario pico.

## 7. Exclusiones de responsabilidad

El proveedor no responde por caídas de terceros fuera de su control (Supabase, Vercel, proveedor de internet del cliente, cortes eléctricos). En esos casos se asiste al cliente pero el SLA de solución se pausa mientras dure la falla externa.
