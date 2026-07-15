// URL canónica del panel privado del hotel. La página vive en /pedidos por
// herencia del template de restaurante; /admin es la puerta oficial y
// next.config redirige /pedidos → /admin para no romper enlaces guardados.
export { default } from "../pedidos/page"
