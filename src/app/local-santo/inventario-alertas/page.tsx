"use client";

import { useEffect, useMemo, useState } from "react";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { formatUSD } from "@/utils/formatCurrency";

const ADMIN_STORAGE_KEY = "santo_perrito_owner_session";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minimumStock: number;
  costUSD: number;
  costVES: number;
  equivalentCostUSD: number;
  note: string;
  isActive: boolean;
  updatedAt: string;
};

type InventoryMovement = {
  id: string;
  dateLabel: string;
  itemId: string;
  itemName: string;
  movementType: string;
  previousQuantity: number;
  quantityMoved: number;
  finalQuantity: number;
  unit: string;
  reason: string;
  relatedExpense: boolean;
  expenseId: string;
  note: string;
  createdAt: string;
};

type InventoryRecipeIngredient = {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
};

type InventoryRecipe = {
  id: string;
  productId: number;
  productName: string;
  productCategory: string;
  ingredients: InventoryRecipeIngredient[];
  note: string;
  isActive: boolean;
  updatedAt: string;
};

type MenuProduct = {
  id: number;
  name: string;
  category: string;
  isActive?: boolean;
  inventoryDiscountEnabled?: boolean;
};

type InventoryApiResponse = {
  inventory?: InventoryItem[];
  inventoryMovements?: InventoryMovement[];
  error?: string;
};

type InventoryRecipesApiResponse = {
  inventoryRecipes?: InventoryRecipe[];
  error?: string;
};

type PublicProductsApiResponse = {
  products?: MenuProduct[];
  error?: string;
  warning?: string;
};

type AlertLevel = "critical" | "warning" | "info";

type InventoryAlert = {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  itemName?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  minimumStock?: number;
  suggestedQuantity?: number;
  suggestedCostUSD?: number;
  actionLabel: string;
};

async function readApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || "El servidor respondió con un formato no válido" };
  }
}

function getStoredPassword() {
  if (typeof window === "undefined") return "";

  try {
    return window.sessionStorage.getItem(ADMIN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;

  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

function normalizeSignedNumber(value: unknown) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue)) return 0;

  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

function normalizeComparableText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeInventoryItem(value: unknown): InventoryItem {
  const source = (value || {}) as Partial<InventoryItem>;

  return {
    id: String(source.id || "").trim(),
    name: String(source.name || "").trim(),
    category: String(source.category || "General").trim() || "General",
    quantity: normalizeSignedNumber(source.quantity),
    unit: String(source.unit || "unidades").trim() || "unidades",
    minimumStock: normalizeNumber(source.minimumStock),
    costUSD: normalizeNumber(source.costUSD),
    costVES: normalizeNumber(source.costVES),
    equivalentCostUSD: normalizeNumber(source.equivalentCostUSD || source.costUSD),
    note: String(source.note || "").trim(),
    isActive: source.isActive !== false,
    updatedAt: String(source.updatedAt || "").trim(),
  };
}

function normalizeInventoryMovement(value: unknown): InventoryMovement {
  const source = (value || {}) as Partial<InventoryMovement>;

  return {
    id: String(source.id || "").trim(),
    dateLabel: String(source.dateLabel || "").trim(),
    itemId: String(source.itemId || "").trim(),
    itemName: String(source.itemName || "").trim(),
    movementType: String(source.movementType || "Movimiento").trim() || "Movimiento",
    previousQuantity: normalizeSignedNumber(source.previousQuantity),
    quantityMoved: normalizeNumber(source.quantityMoved),
    finalQuantity: normalizeSignedNumber(source.finalQuantity),
    unit: String(source.unit || "unidades").trim() || "unidades",
    reason: String(source.reason || "").trim(),
    relatedExpense: source.relatedExpense === true,
    expenseId: String(source.expenseId || "").trim(),
    note: String(source.note || "").trim(),
    createdAt: String(source.createdAt || "").trim(),
  };
}

function normalizeRecipeIngredient(value: unknown): InventoryRecipeIngredient {
  const source = (value || {}) as Partial<InventoryRecipeIngredient>;

  return {
    itemId: String(source.itemId || "").trim(),
    itemName: String(source.itemName || "").trim(),
    quantity: normalizeNumber(source.quantity),
    unit: String(source.unit || "unidades").trim() || "unidades",
  };
}

function normalizeInventoryRecipe(value: unknown): InventoryRecipe {
  const source = (value || {}) as Partial<InventoryRecipe>;
  const productId = Number(source.productId || 0);
  const ingredients = Array.isArray(source.ingredients) ? source.ingredients : [];

  return {
    id: String(source.id || "").trim(),
    productId: Number.isFinite(productId) ? Math.round(productId) : 0,
    productName: String(source.productName || "").trim(),
    productCategory: String(source.productCategory || "").trim(),
    ingredients: ingredients
      .map(normalizeRecipeIngredient)
      .filter((ingredient) => ingredient.itemId && ingredient.itemName && ingredient.quantity > 0),
    note: String(source.note || "").trim(),
    isActive: source.isActive !== false,
    updatedAt: String(source.updatedAt || "").trim(),
  };
}

function normalizeMenuProduct(value: unknown): MenuProduct | null {
  const source = (value || {}) as Partial<MenuProduct>;
  const id = Number(source.id || 0);
  const name = String(source.name || "").trim();

  if (!Number.isFinite(id) || id <= 0 || !name) return null;

  return {
    id: Math.round(id),
    name,
    category: String(source.category || "Producto").trim() || "Producto",
    isActive: source.isActive !== false,
    inventoryDiscountEnabled: source.inventoryDiscountEnabled !== false,
  };
}

function formatDate(value: string) {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(date);
}

function formatQuantity(value: number, unit: string) {
  const formatted = Number(value || 0).toLocaleString("es-VE", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  return `${formatted} ${unit || "unidades"}`;
}

function getRecipeKey(recipe: InventoryRecipe) {
  return `${recipe.productId || 0}|${normalizeComparableText(recipe.productName)}`;
}

function findRecipeForProduct(recipes: InventoryRecipe[], product: MenuProduct) {
  return recipes.find((recipe) => {
    if (recipe.productId > 0 && recipe.productId === product.id) return true;

    return normalizeComparableText(recipe.productName) === normalizeComparableText(product.name);
  });
}

function buildInventoryAlerts(
  inventory: InventoryItem[],
  recipes: InventoryRecipe[],
  menuProducts: MenuProduct[],
) {
  const alerts: InventoryAlert[] = [];
  const activeItems = inventory.filter((item) => item.id && item.name && item.isActive !== false);
  const activeRecipes = recipes.filter((recipe) => recipe.id && recipe.productName && recipe.isActive !== false);
  const inventoryIds = new Set(activeItems.map((item) => item.id));
  const recipeKeys = new Set(activeRecipes.map(getRecipeKey));

  activeItems.forEach((item) => {
    const shouldWarnStock = item.minimumStock > 0 && item.quantity <= item.minimumStock;
    const isOut = item.quantity <= 0;
    const suggestedQuantity = Math.max(item.minimumStock - item.quantity, 0);
    const suggestedCostUSD = item.equivalentCostUSD > 0 ? suggestedQuantity * item.equivalentCostUSD : 0;

    if (isOut) {
      alerts.push({
        id: `out-${item.id}`,
        level: "critical",
        title: "Insumo agotado",
        detail: `${item.name} está en cero o negativo. Revisa si debe comprarse o ajustarse con conteo físico.`,
        itemName: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        minimumStock: item.minimumStock,
        suggestedQuantity,
        suggestedCostUSD,
        actionLabel: "Comprar o ajustar inventario",
      });
      return;
    }

    if (shouldWarnStock) {
      alerts.push({
        id: `low-${item.id}`,
        level: "warning",
        title: "Stock bajo",
        detail: `${item.name} está igual o por debajo del mínimo configurado.`,
        itemName: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        minimumStock: item.minimumStock,
        suggestedQuantity,
        suggestedCostUSD,
        actionLabel: "Revisar compra sugerida",
      });
    }

    if (item.equivalentCostUSD <= 0 && item.costUSD <= 0 && item.costVES <= 0) {
      alerts.push({
        id: `cost-${item.id}`,
        level: "info",
        title: "Costo sin registrar",
        detail: `${item.name} no tiene costo registrado. Esto limita el análisis de compras y reposición.`,
        itemName: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        minimumStock: item.minimumStock,
        suggestedQuantity: 0,
        suggestedCostUSD: 0,
        actionLabel: "Completar costo del insumo",
      });
    }
  });

  activeRecipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
      if (inventoryIds.has(ingredient.itemId)) return;

      alerts.push({
        id: `recipe-missing-${recipe.id}-${ingredient.itemId}`,
        level: "warning",
        title: "Receta con insumo no encontrado",
        detail: `${recipe.productName} usa ${ingredient.itemName}, pero ese insumo no aparece activo en inventario.`,
        itemName: ingredient.itemName,
        category: recipe.productCategory || "Receta",
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        minimumStock: 0,
        suggestedQuantity: 0,
        suggestedCostUSD: 0,
        actionLabel: "Corregir receta o reactivar insumo",
      });
    });
  });

  menuProducts
    .filter((product) => product.isActive !== false && product.inventoryDiscountEnabled !== false)
    .forEach((product) => {
      const recipe = findRecipeForProduct(activeRecipes, product);

      if (recipe && recipeKeys.has(getRecipeKey(recipe))) return;

      alerts.push({
        id: `recipe-gap-${product.id}`,
        level: "info",
        title: "Producto sin receta",
        detail: `${product.name} está activo y puede venderse, pero no tiene receta de inventario asociada.`,
        itemName: product.name,
        category: product.category,
        quantity: 0,
        unit: "",
        minimumStock: 0,
        suggestedQuantity: 0,
        suggestedCostUSD: 0,
        actionLabel: "Crear receta cuando esté lista",
      });
    });

  return alerts.sort((alertA, alertB) => {
    const priority: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };

    if (priority[alertA.level] !== priority[alertB.level]) {
      return priority[alertA.level] - priority[alertB.level];
    }

    return String(alertA.itemName || alertA.title).localeCompare(String(alertB.itemName || alertB.title));
  });
}

function getAlertClasses(level: AlertLevel) {
  if (level === "critical") return "border-red-700 bg-red-100 text-red-900";
  if (level === "warning") return "border-yellow-500 bg-[var(--brand-accent-100)] text-[var(--brand-ink)]";

  return "border-[var(--brand-primary)]/30 bg-white text-[var(--brand-ink)]";
}

function getMovementClasses(type: string) {
  const normalized = normalizeComparableText(type);

  if (normalized.includes("salida")) return "border-red-200 bg-red-50 text-red-800";
  if (normalized.includes("entrada")) return "border-green-200 bg-green-50 text-green-800";
  if (normalized.includes("elimin")) return "border-[var(--brand-ink-3)] bg-[var(--brand-ink-3)] text-white";

  return "border-[var(--brand-accent)] bg-yellow-50 text-[var(--brand-ink)]";
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "normal",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "normal" | "warning" | "critical";
}) {
  const toneClasses =
    tone === "critical"
      ? "border-red-600 bg-red-100"
      : tone === "warning"
        ? "border-yellow-500 bg-[var(--brand-accent-100)]"
        : "border-[var(--brand-primary)]/25 bg-white";

  return (
    <article className={`rounded-[1.75rem] border p-5 shadow-sm ${toneClasses}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">{label}</p>
      <strong className="mt-2 block text-3xl font-bold text-[var(--brand-ink-3)]">{value}</strong>
      <p className="mt-2 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">{detail}</p>
    </article>
  );
}

function LoginScreen({
  password,
  showPassword,
  isLoading,
  message,
  onPasswordChange,
  onTogglePassword,
  onLogin,
}: {
  password: string;
  showPassword: boolean;
  isLoading: boolean;
  message: string | null;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onLogin: () => void;
}) {
  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-3)]">
      <section className="mx-auto flex min-h-[80vh] w-full max-w-md items-center">
        <div className="w-full overflow-hidden rounded-[2rem] border border-[var(--brand-primary)]/45 bg-white shadow-sm">
          <div className="h-6 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:32px_32px] bg-[position:0_0,0_16px,16px_-16px,0] bg-[var(--brand-cream)]" />

          <div className="p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] text-[var(--brand-ink)]">
              <ShieldAlert size={30} />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-primary)]">
              Inventario premium
            </p>
            <h1 className="font-serif mt-2 text-4xl leading-tight text-[var(--brand-ink-3)] font-semibold">
              Alertas de inventario
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
              Entra con una clave privada autorizada para revisar stock bajo, insumos agotados, recetas incompletas y movimientos recientes.
            </p>

            <div className="mt-6 text-left">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                Clave privada
              </label>
              <div className="mt-2 flex overflow-hidden rounded-2xl border border-[var(--brand-primary)]/40 bg-white">
                <input
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onLogin();
                  }}
                  type={showPassword ? "text" : "password"}
                  className="min-w-0 flex-1 px-4 py-3 text-sm font-bold outline-none"
                  placeholder="Clave del dueño o soporte"
                />
                <button
                  type="button"
                  onClick={onTogglePassword}
                  className="border-l border-[var(--brand-primary)] px-4 text-[var(--brand-primary)]"
                  aria-label={showPassword ? "Ocultar clave" : "Mostrar clave"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {message ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {message}
              </p>
            ) : null}

            <button
              type="button"
              onClick={onLogin}
              disabled={isLoading}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-5 py-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="animate-spin" size={17} /> : <LogIn size={17} />}
              Entrar
            </button>

            <a
              href="/admin"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-5 py-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
            >
              <ArrowLeft size={17} />
              Volver al panel
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function InventoryAlertsPage() {
  return (
    <ModuleAccessGuard moduleKey="inventoryAlerts" moduleName="Inventario alertas">
      <InventoryAlertsPageContent />
    </ModuleAccessGuard>
  );
}

function InventoryAlertsPageContent() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [recipes, setRecipes] = useState<InventoryRecipe[]>([]);
  const [menuProducts, setMenuProducts] = useState<MenuProduct[]>([]);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<"all" | AlertLevel>("all");

  const alerts = useMemo(
    () => buildInventoryAlerts(inventory, recipes, menuProducts),
    [inventory, recipes, menuProducts],
  );

  const filteredAlerts = useMemo(() => {
    const query = normalizeComparableText(searchText);

    return alerts.filter((alert) => {
      if (filter !== "all" && alert.level !== filter) return false;
      if (!query) return true;

      return normalizeComparableText(
        [alert.title, alert.detail, alert.itemName, alert.category, alert.actionLabel]
          .filter(Boolean)
          .join(" "),
      ).includes(query);
    });
  }, [alerts, filter, searchText]);

  const activeItems = inventory.filter((item) => item.id && item.name && item.isActive !== false);
  const criticalCount = alerts.filter((alert) => alert.level === "critical").length;
  const warningCount = alerts.filter((alert) => alert.level === "warning").length;
  const infoCount = alerts.filter((alert) => alert.level === "info").length;
  const reorderCostUSD = alerts.reduce(
    (total, alert) => total + normalizeNumber(alert.suggestedCostUSD),
    0,
  );
  const recentMovements = movements.slice(0, 12);
  const recipeCoverage = menuProducts.length
    ? Math.round(
        (menuProducts.filter((product) => findRecipeForProduct(recipes, product)).length /
          menuProducts.length) *
          100,
      )
    : 0;

  async function loadData(nextPassword = password, silent = false) {
    const cleanPassword = String(nextPassword || "").trim();

    if (!cleanPassword) {
      setMessage("Escribe la clave privada para revisar el inventario.");
      return false;
    }

    if (!silent) setIsLoading(true);
    setMessage(null);

    try {
      const [inventoryResponse, recipesResponse, productsResponse] = await Promise.all([
        fetch("/api/inventory", {
          method: "GET",
          headers: { "x-admin-password": cleanPassword },
          cache: "no-store",
        }),
        fetch("/api/inventory-recipes", {
          method: "GET",
          headers: { "x-admin-password": cleanPassword },
          cache: "no-store",
        }),
        fetch("/api/public/products", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const inventoryData = (await readApiResponse(inventoryResponse)) as InventoryApiResponse;
      const recipesData = (await readApiResponse(recipesResponse)) as InventoryRecipesApiResponse;
      const productsData = (await readApiResponse(productsResponse)) as PublicProductsApiResponse;

      if (!inventoryResponse.ok) {
        throw new Error(inventoryData.error || "No se pudo cargar el inventario.");
      }

      if (!recipesResponse.ok) {
        throw new Error(recipesData.error || "No se pudieron cargar las recetas de inventario.");
      }

      const nextInventory = Array.isArray(inventoryData.inventory)
        ? inventoryData.inventory.map(normalizeInventoryItem).filter((item) => item.id && item.name)
        : [];
      const nextMovements = Array.isArray(inventoryData.inventoryMovements)
        ? inventoryData.inventoryMovements.map(normalizeInventoryMovement).filter((movement) => movement.id)
        : [];
      const nextRecipes = Array.isArray(recipesData.inventoryRecipes)
        ? recipesData.inventoryRecipes.map(normalizeInventoryRecipe).filter((recipe) => recipe.id && recipe.productName)
        : [];
      const nextProducts = Array.isArray(productsData.products)
        ? productsData.products
            .map(normalizeMenuProduct)
            .filter((product): product is MenuProduct => Boolean(product))
        : [];

      setInventory(nextInventory);
      setMovements(nextMovements);
      setRecipes(nextRecipes);
      setMenuProducts(nextProducts);
      setIsLoggedIn(true);

      try {
        window.sessionStorage.setItem(ADMIN_STORAGE_KEY, cleanPassword);
      } catch {
        // El panel puede funcionar aunque sessionStorage no esté disponible.
      }

      if (productsData.warning) {
        setMessage(productsData.warning);
      }

      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la revisión de inventario.",
      );
      return false;
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  async function handleLogin() {
    await loadData(password);
  }

  function handleLogout() {
    setIsLoggedIn(false);
    setPassword("");
    setInventory([]);
    setMovements([]);
    setRecipes([]);
    setMenuProducts([]);
    setMessage(null);

    try {
      window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch {
      // No hace falta hacer nada.
    }
  }

  useEffect(() => {
    // Difiere la restauración de sesión un tick para no hacer setState
    // síncrono dentro del efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      const storedPassword = getStoredPassword();

      if (!storedPassword) return;

      setPassword(storedPassword);
      void loadData(storedPassword, true);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isLoggedIn) {
    return (
      <LoginScreen
        password={password}
        showPassword={showPassword}
        isLoading={isLoading}
        message={message}
        onPasswordChange={setPassword}
        onTogglePassword={() => setShowPassword((current) => !current)}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-6 text-[var(--brand-ink-3)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-[var(--brand-primary)]/45 bg-white shadow-sm">
          <div className="h-5 bg-[linear-gradient(45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(-45deg,var(--brand-primary)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--brand-primary)_75%),linear-gradient(-45deg,transparent_75%,var(--brand-primary)_75%)] bg-[length:30px_30px] bg-[position:0_0,0_15px,15px_-15px,0] bg-[var(--brand-cream)]" />
          <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-center lg:p-7">
            <div>
              <a
                href="/admin"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
              >
                <ArrowLeft size={16} />
                Volver al panel
              </a>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-primary)]">
                Inventario premium ligero
              </p>
              <h1 className="font-serif mt-2 text-4xl leading-tight text-[var(--brand-ink-3)] sm:text-5xl font-semibold">
                Alertas de inventario
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                Revisión rápida para saber qué insumos están agotados, cuáles están cerca del mínimo, qué costos faltan y qué productos activos todavía no tienen receta.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--brand-primary)]/25 bg-yellow-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                Próxima acción sugerida
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                Usa esta pantalla para revisar antes de comprar. Los ajustes reales se siguen haciendo desde Inventario.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <a
                  href="/local-santo/inventario"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-[var(--brand-accent)] px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                >
                  <PackageCheck size={16} />
                  Abrir inventario
                </a>
                <button
                  type="button"
                  onClick={() => loadData(password)}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-60"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                  Actualizar
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] sm:col-span-2 lg:col-span-1"
                >
                  Cambiar clave
                </button>
              </div>
            </div>
          </div>
        </header>

        {message ? (
          <section className="rounded-[1.5rem] border border-yellow-400 bg-[var(--brand-accent-100)] px-5 py-4 text-sm font-bold leading-6 text-[var(--brand-ink)]">
            {message}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Insumos activos"
            value={String(activeItems.length)}
            detail="Productos de inventario disponibles para control y recetas."
          />
          <SummaryCard
            label="Alertas críticas"
            value={String(criticalCount)}
            detail="Insumos agotados o en cantidad negativa."
            tone={criticalCount > 0 ? "critical" : "normal"}
          />
          <SummaryCard
            label="Stock bajo"
            value={String(warningCount)}
            detail="Insumos por debajo o igual al mínimo configurado."
            tone={warningCount > 0 ? "warning" : "normal"}
          />
          <SummaryCard
            label="Costo estimado"
            value={formatUSD(reorderCostUSD)}
            detail="Estimación rápida para reponer mínimos con costos registrados."
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-[2rem] border border-[var(--brand-primary)]/45 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  Revisión de alertas
                </p>
                <h2 className="font-serif mt-1 text-2xl text-[var(--brand-ink-3)] font-semibold">
                  Pendientes de inventario
                </h2>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  Esta lista no cambia datos. Solo te ayuda a decidir qué comprar, ajustar o configurar.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row lg:min-w-[420px]">
                <div className="flex flex-1 items-center gap-2 rounded-full border border-[var(--brand-primary)]/35 bg-white px-4 py-2">
                  <Search size={17} className="text-[var(--brand-primary)]" />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[var(--brand-ink-2)]/40"
                    placeholder="Buscar insumo, receta o alerta"
                  />
                </div>

                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as "all" | AlertLevel)}
                  className="rounded-full border border-[var(--brand-primary)]/35 bg-white px-4 py-2 text-sm font-bold text-[var(--brand-ink)] outline-none"
                >
                  <option value="all">Todas</option>
                  <option value="critical">Críticas</option>
                  <option value="warning">Stock bajo</option>
                  <option value="info">Configuración</option>
                </select>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {filteredAlerts.length ? (
                filteredAlerts.map((alert) => (
                  <article
                    key={alert.id}
                    className={`rounded-[1.5rem] border p-4 ${getAlertClasses(alert.level)}`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {alert.level === "critical" ? (
                            <XCircle size={19} />
                          ) : alert.level === "warning" ? (
                            <AlertTriangle size={19} />
                          ) : (
                            <CheckCircle2 size={19} />
                          )}
                          <strong className="text-sm font-bold uppercase tracking-[0.08em]">
                            {alert.title}
                          </strong>
                          {alert.category ? (
                            <span className="rounded-full border border-current px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] opacity-80">
                              {alert.category}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm font-bold leading-6">{alert.detail}</p>
                      </div>

                      <div className="grid gap-2 text-left lg:min-w-[210px]">
                        {typeof alert.quantity === "number" && alert.unit ? (
                          <div className="rounded-2xl border border-current/25 bg-white/55 px-3 py-2 text-xs font-bold">
                            Actual: {formatQuantity(alert.quantity, alert.unit)}
                          </div>
                        ) : null}
                        {alert.minimumStock && alert.minimumStock > 0 && alert.unit ? (
                          <div className="rounded-2xl border border-current/25 bg-white/55 px-3 py-2 text-xs font-bold">
                            Mínimo: {formatQuantity(alert.minimumStock, alert.unit)}
                          </div>
                        ) : null}
                        {alert.suggestedQuantity && alert.suggestedQuantity > 0 && alert.unit ? (
                          <div className="rounded-2xl border border-current/25 bg-white/55 px-3 py-2 text-xs font-bold">
                            Sugerido: {formatQuantity(alert.suggestedQuantity, alert.unit)}
                          </div>
                        ) : null}
                        {alert.suggestedCostUSD && alert.suggestedCostUSD > 0 ? (
                          <div className="rounded-2xl border border-current/25 bg-white/55 px-3 py-2 text-xs font-bold">
                            Estimado: {formatUSD(alert.suggestedCostUSD)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-3 rounded-2xl border border-current/25 bg-white/60 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em]">
                      Acción: {alert.actionLabel}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-green-400 bg-green-50 p-6 text-center text-green-800">
                  <CheckCircle2 className="mx-auto" size={30} />
                  <h3 className="mt-3 text-xl font-bold uppercase">Sin alertas en esta vista</h3>
                  <p className="mt-2 text-sm font-bold leading-6">
                    No hay pendientes con los filtros actuales. Puedes cambiar la búsqueda o revisar el inventario completo.
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-[2rem] border border-[var(--brand-primary)]/45 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Recetas
              </p>
              <h2 className="font-serif mt-1 text-2xl text-[var(--brand-ink-3)] font-semibold">
                Cobertura {recipeCoverage}%
              </h2>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                Productos activos con receta configurada para descuento automático cuando un pedido se marca entregado.
              </p>
              <div className="mt-4 grid gap-2 text-sm font-bold">
                <div className="flex justify-between rounded-2xl border border-[var(--brand-primary)]/20 bg-yellow-50 px-4 py-3">
                  <span>Productos activos</span>
                  <span>{menuProducts.length}</span>
                </div>
                <div className="flex justify-between rounded-2xl border border-[var(--brand-primary)]/20 bg-yellow-50 px-4 py-3">
                  <span>Recetas activas</span>
                  <span>{recipes.filter((recipe) => recipe.isActive !== false).length}</span>
                </div>
                <div className="flex justify-between rounded-2xl border border-[var(--brand-primary)]/20 bg-yellow-50 px-4 py-3">
                  <span>Alertas de configuración</span>
                  <span>{infoCount}</span>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[var(--brand-primary)]/45 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                Movimientos recientes
              </p>
              <h2 className="font-serif mt-1 text-2xl text-[var(--brand-ink-3)] font-semibold">
                Últimos cambios
              </h2>

              <div className="mt-4 grid gap-3">
                {recentMovements.length ? (
                  recentMovements.map((movement) => (
                    <article
                      key={movement.id}
                      className={`rounded-[1.25rem] border p-3 ${getMovementClasses(movement.movementType)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <strong className="block text-sm font-bold uppercase leading-5">
                            {movement.itemName || "Insumo"}
                          </strong>
                          <p className="mt-1 text-xs font-bold leading-5">
                            {movement.movementType} · {formatQuantity(movement.quantityMoved, movement.unit)}
                          </p>
                        </div>
                        <Clock size={17} className="shrink-0" />
                      </div>
                      <p className="mt-2 text-xs font-bold leading-5 opacity-80">
                        {movement.reason || "Movimiento registrado"}
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] opacity-70">
                        {movement.createdAt ? formatDate(movement.createdAt) : movement.dateLabel || "Sin fecha"}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl border border-[var(--brand-primary)]/20 bg-yellow-50 px-4 py-4 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                    Todavía no hay movimientos recientes para mostrar.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
