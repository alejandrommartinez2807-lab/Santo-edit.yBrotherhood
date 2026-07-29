# Repaso de cuotas — escenarios de pago que faltaban

run: brotherhood-week-001 · inicio real: 2026-07-29T06:29:51.961Z

- `PASS` **Q-1** se completó la cuota de 50 pagos reportados por el cliente — total=50 (nuevos=47, confirmados por caja=47)
- `PASS` **Q-2** se completó la cuota de 20 montos en Bs con formato venezolano — total=22 (nuevos=20)
- `PASS` **Q-3** se completó la cuota de 10 correcciones de método, con el candado optimista puesto — total=10 (nuevas=9)
- `PASS` **Q-4** se completó la cuota de 10 reintentos seguros tras timeout (idempotencia) — total=10 (nuevos=8)
- `PASS` **Q-5** se completó la cuota de 10 intentos de pago duplicado, ninguno dobló el cobro — total=10 (nuevos=8)
- `PASS` **Q-6** se completó la cuota de 6 carreras de dos cajeros — total=6
- `PASS` **Q-7** con el candado puesto, en cada carrera gana UNO y el otro recibe 409 — un-solo-ganador=5/5
- `PASS` **Q-8b** el pedido conserva su ORIGEN y solo el cobro es del día nuevo — pago=Pagado origen=2026-07-29
- `PASS` **Q-8** se completó la cuota de 4 cuentas cobradas en un día distinto al de origen — total=4 (nuevas=3)
- `PASS` **Q-Transferencia** se completó la cuota de 90 transferencias — total=90
- `PASS` **Q-Pago móvil** se completó la cuota de 90 pago móvils — total=90
- `PASS` **Q-CIERRE-Principal** el cierre de repaso de Principal cuadra al centavo — esperado=$1116 real=$1116
- `PASS` **Q-CIERRE-San Diego** el cierre de repaso de San Diego cuadra al centavo — esperado=$377.5 real=$377.5

Cuotas tras el repaso: {"efectivo":173,"efectivo-cambio":54,"pagomovil":90,"mixto":91,"transferencia":90,"reintento-seguro":10,"pago-reportado":50,"reportado-bs-formato-ve":22,"segunda-pata":38,"intento-duplicado":10,"carrera-dos-cajeros":6,"cuenta-cobrada-otro-dia":4,"correccion-metodo":10}

---
reanudado: 2026-07-29T06:55:10.803Z

Principal: día 7 = $516 · repaso = $600 (antes el repaso declaraba $1116)
San Diego: día 7 = $241 · repaso = $136.5 (antes el repaso declaraba $377.5)
- `PASS` **FIX-CIERRE-Principal** el cierre de repaso de Principal se rehace con el dinero NUEVO solamente — nuevo=$600 (el anterior declaraba $1116)
cierre de repaso anterior de Principal eliminado del historial (declaraba $1116, duplicando el domingo)
- `PASS` **FIX-CIERRE-San Diego** el cierre de repaso de San Diego se rehace con el dinero NUEVO solamente — nuevo=$136.5 (el anterior declaraba $377.5)
cierre de repaso anterior de San Diego eliminado del historial (declaraba $377.5, duplicando el domingo)
