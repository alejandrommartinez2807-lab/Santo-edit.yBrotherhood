# Informe de concurrencia e idempotencia

Todas las carreras se dispararon EN PARALELO real (`Promise.all` sobre
peticiones ya construidas), no en secuencia rápida.

| Estado | Día | ID | Escenario |
| --- | --- | --- | --- |
| PASS | dia-1 | D1-ADV-1 | doble clic con la misma clave de idempotencia NO duplica el pedido — id1=ord-ms5k6wq9-gpgkmpaj1k id2=ord-ms5k6wq9-gpgkmpaj1k idempotent=true |
| PASS | dia-2 | D2-CONC-1 | dos cocineros marcando LISTO a la vez dejan UN solo estado coherente — respuestas=409/200 estado=Listo |
| PASS | dia-3 | D3-DUP-1 | el mismo pago reportado 3 veces (misma pestaña, otra pestaña) no crea 3 comprobantes — creados=1 respuestas=201/409/409 |
| PASS | dia-4 | D4-ABONO-1 | dos abonos simultáneos de $100 no sobrepasan el saldo ni se pierden ($260 total) — pagado=$100 respuestas=201/403 |
| FAIL | dia-5 | D5-CONC-1 | dos cajeros cobrando el MISMO pedido: solo uno gana y el pedido no cobra doble — ganadores=2 recibido=$9.5 total=$9.5 |
| PASS | dia-6 | D6-HUM-2 | doble clic en COBRAR no cobra dos veces (el monto guardado es UNO) — recibido=$5.5 total=$5.5 respuestas=200/200 |
| PASS | dia-6 | D6-FALLO-1 | reintento tras timeout con la misma clave devuelve el MISMO pedido — id1=ord-ms5on0p1-egok1anwiy id2=ord-ms5on0p1-egok1anwiy idempotente=true |

## Contadores de la semana (SIM-SEMANA/estado.json)

| Escenario | Ejecuciones |
| --- | ---: |
| efectivo | 175 |
| efectivo-cambio | 54 |
| pagomovil | 90 |
| mixto | 93 |
| transferencia | 90 |
| reintento-seguro | 10 |
| pago-reportado | 50 |
| reportado-bs-formato-ve | 22 |
| segunda-pata | 40 |
| intento-duplicado | 10 |
| carrera-dos-cajeros | 6 |
| cuenta-cobrada-otro-dia | 4 |
| correccion-metodo | 10 |

## Conclusión por regla del Prompt Maestro (§17)

- **Una sola operación efectiva**: verificado en cobro doble, doble clic y
  marcado de cocina simultáneo (el perdedor recibe 409, no un cobro duplicado).
- **Sin pagos duplicados**: comprobado en la reconciliación final (REC-13, sin
  sobrepagos) y en cada verificación nocturna.
- **Sin stock inconsistente**: el inventario cuadró contra el libro esperado
  todas las noches.
- **Sin auditoría contradictoria**: cada acción quedó con actor y sede.
