"use client"

import { useEffect, useState } from "react"
import { useExchangeRate } from "@/hooks/useExchangeRate"
import { useCart } from "@/hooks/useCart"
import { getSelectedBranchId, setSelectedBranchId } from "@/lib/branchClient"

import Navbar from "@/components/Navbar"
import Hero from "@/components/Hero"
import Products from "@/components/Products"
import CartDrawer from "@/components/CartDrawer"
import PublicPromotion from "@/components/PublicPromotion"
import FeaturedProducts from "@/components/FeaturedProducts"
import OpenAccountInfo from "@/components/OpenAccountInfo"
import BottomInfoSections from "@/components/BottomInfoSections"
import PublicThemeSync from "@/components/PublicThemeSync"

export default function Home() {
  const cart = useCart()
  const exchange = useExchangeRate()
  const [isCartOpen, setIsCartOpen] = useState(false)

  useEffect(() => {
    // QR por sucursal: si la URL trae ?branch, fijamos esa sucursal para el cliente
    // después de hidratar. Así evitamos efectos de cliente durante el render inicial.
    const branchParam = new URLSearchParams(window.location.search).get("branch")

    if (branchParam && getSelectedBranchId() !== branchParam) {
      setSelectedBranchId(branchParam)
    }
  }, [])

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] text-[var(--brand-ink-3)]">
      <PublicThemeSync />
      <Navbar
        totalItems={cart.totalItems}
        onOpenCart={() => setIsCartOpen(true)}
      />

      <Hero />

      <FeaturedProducts onAddToCart={cart.addItem} exchangeRate={exchange.rate} />

      <Products onAddToCart={cart.addItem} exchangeRate={exchange.rate} />

      <PublicPromotion />

      <OpenAccountInfo />

      <BottomInfoSections />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart.items}
        totalPrice={cart.totalPrice}
        removeItem={cart.removeItem}
        increaseQuantity={cart.increaseQuantity}
        decreaseQuantity={cart.decreaseQuantity}
        updateItemNote={cart.updateItemNote}
        updateItemNoteEnabled={cart.updateItemNoteEnabled}
        exchangeRate={exchange.rate}
        exchangeSource={exchange.source}
        exchangeValueDate={exchange.valueDate}
        exchangeFallback={exchange.fallback}
        exchangeManual={exchange.manual}
        exchangeWarning={exchange.warning}
      />
    </main>
  )
}
