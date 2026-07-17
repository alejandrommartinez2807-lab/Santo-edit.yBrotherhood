-- 0028: order_items.product_id de integer a bigint.
--
-- Por qué: el editor de menú (saveMenuProduct), el clonado de sedes/eventos
-- (branchProvisioning) y la carga masiva generan ids de producto con
-- Date.now() (~1.78e12), que desbordan el rango de integer (~2.15e9).
-- menu_products.id e inventory_recipes.product_id ya son bigint; esta era la
-- única columna rezagada y hacía fallar la CREACIÓN de pedidos con
-- "value ... is out of range for type integer" para cualquier producto
-- creado por el editor o clonado (los ids 1-8 del menú semilla sí cabían,
-- por eso no se había notado).

alter table order_items
  alter column product_id type bigint;
