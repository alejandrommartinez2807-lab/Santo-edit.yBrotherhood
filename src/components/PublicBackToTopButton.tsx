"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function PublicBackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsVisible(window.scrollY > 720);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <a
      href="#inicio"
      aria-label="Volver al inicio"
      className="fixed bottom-24 right-4 z-[75] flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.16)] transition hover:bg-[var(--brand-accent)] md:bottom-6"
    >
      <ArrowUp size={20} />
    </a>
  );
}
