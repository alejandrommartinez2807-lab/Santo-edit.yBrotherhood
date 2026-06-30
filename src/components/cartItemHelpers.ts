// Helpers de ítems y canales de venta del carrito, extraídos de CartDrawer (puros).
import type {
  CartItem,
  CartSalesChannel,
  OrderType,
  ProductPaymentMode,
} from "@/components/cartTypes";
import { cleanText } from "@/components/cartUtils";

export function isComboItem(item: CartItem) {
  return item.paymentMode === "divisa" || item.category === "Combos";
}

export function getItemPaymentMode(item: CartItem): ProductPaymentMode {
  return isComboItem(item) ? "divisa" : "mixto";
}

export function getCartLineId(item: CartItem) {
  return item.cartLineId || String(item.id);
}

export function normalizeCartSalesChannels(value: unknown): CartSalesChannel[] {
  if (!Array.isArray(value)) {
    return ["local", "takeaway", "delivery"];
  }

  const channels = value.filter(
    (channel): channel is CartSalesChannel =>
      channel === "local" || channel === "takeaway" || channel === "delivery",
  );

  return channels.length
    ? Array.from(new Set(channels))
    : ["local", "takeaway", "delivery"];
}

export function getOrderTypeSalesChannel(orderType: OrderType): CartSalesChannel {
  if (orderType === "Delivery") return "delivery";
  if (orderType === "Para llevar") return "takeaway";

  return "local";
}

export function getSalesChannelLabel(channel: CartSalesChannel) {
  if (channel === "delivery") return "Delivery";
  if (channel === "takeaway") return "Para llevar";

  return "Comer aquí";
}

export function getCartItemSalesChannels(item: CartItem) {
  return normalizeCartSalesChannels(item.salesChannels);
}

export function itemSupportsOrderType(item: CartItem, orderType: OrderType) {
  return getCartItemSalesChannels(item).includes(
    getOrderTypeSalesChannel(orderType),
  );
}

export function formatItemSalesChannels(item: CartItem) {
  return getCartItemSalesChannels(item).map(getSalesChannelLabel).join(" · ");
}

export function uniqueCartItemNames(items: CartItem[]) {
  return Array.from(
    new Set(items.map((item) => cleanText(item.name)).filter(Boolean)),
  );
}
