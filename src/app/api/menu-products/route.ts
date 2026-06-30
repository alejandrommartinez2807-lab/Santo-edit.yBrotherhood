import { NextRequest, NextResponse } from "next/server"
import {
  deleteMenuProduct,
  getBusinessConfig,
  getMenuProducts,
  saveBusinessConfig,
  saveMenuProduct,
  type MenuProduct,
} from "@/lib/orders"
import { getRequestAccess, type LocalRole } from "@/lib/localAccess"
import { normalizeMenuProductInput, normalizeProductIds } from "@/lib/menuProductInput"
import { resolveBranchId } from "@/lib/branch"

import { enforceApiMutationGuards } from "@/lib/apiMutationGuards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BusinessConfigWithFeaturedProducts = {
  featuredProductIds?: unknown
}

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  )
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 })
}

function forbiddenResponse(message = "Esta clave no tiene permiso para administrar el menú") {
  return NextResponse.json({ error: message }, { status: 403 })
}

function checkRole(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request))

  if (!access.ok) {
    return {
      ok: false as const,
      response: unauthorizedResponse(),
      role: null,
    }
  }

  if (!allowedRoles.includes(access.role)) {
    return {
      ok: false as const,
      response: forbiddenResponse(),
      role: access.role,
    }
  }

  return {
    ok: true as const,
    response: null,
    role: access.role,
  }
}

async function getFeaturedProductIdsFromConfig() {
  try {
    const businessConfig =
      (await getBusinessConfig()) as BusinessConfigWithFeaturedProducts

    return normalizeProductIds(businessConfig.featuredProductIds)
  } catch {
    return []
  }
}

function applyFeaturedProductIds(products: MenuProduct[], featuredProductIds: number[]) {
  const featuredIdSet = new Set(featuredProductIds)

  return products.map((product) => ({
    ...product,
    isFeatured: product.isFeatured === true || featuredIdSet.has(product.id),
  }))
}

async function syncFeaturedProductIdInConfig(productId: number, isFeatured: boolean) {
  const businessConfig =
    (await getBusinessConfig()) as BusinessConfigWithFeaturedProducts
  const currentIds = normalizeProductIds(businessConfig.featuredProductIds)
  const currentSet = new Set(currentIds)

  if (isFeatured) {
    currentSet.add(productId)
  } else {
    currentSet.delete(productId)
  }

  const nextIds = Array.from(currentSet).sort((a, b) => a - b)
  const changed =
    currentIds.length !== nextIds.length ||
    currentIds.some((item, index) => item !== nextIds[index])

  if (changed) {
    await saveBusinessConfig({
      featuredProductIds: nextIds,
    })
  }

  return nextIds
}

export async function GET(request: NextRequest) {
  try {
    const roleCheck = checkRole(request, ["owner", "manager"])

    if (!roleCheck.ok) {
      return roleCheck.response
    }

    const [products, featuredProductIds] = await Promise.all([
      getMenuProducts(
        {
          includeInactive: true,
        },
        await resolveBranchId(request),
      ),
      getFeaturedProductIdsFromConfig(),
    ])

    return NextResponse.json({
      ok: true,
      menuProducts: applyFeaturedProductIds(products, featuredProductIds),
      featuredProductIds,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los productos del menú",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-menu-products-post",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "MENU_PRODUCTS_MUTATION_MAX_BYTES",
    maxBytes: 3_000_000,
    rateLimitMessage: "Demasiados cambios del menú. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  try {
    const roleCheck = checkRole(request, ["owner", "manager"])

    if (!roleCheck.ok) {
      return roleCheck.response
    }

    const body = await request.json()
    const input = normalizeMenuProductInput(body.menuProduct || body.product || body)

    if (!input.name) {
      return NextResponse.json(
        { error: "Escribe el nombre del producto." },
        { status: 400 }
      )
    }

    if (input.price <= 0) {
      return NextResponse.json(
        { error: "El precio debe ser mayor a cero." },
        { status: 400 }
      )
    }

    const result = await saveMenuProduct(input, await resolveBranchId(request))
    const productId = Number(result.menuProduct?.id || input.id || 0)
    let featuredProductIds: number[] = []
    let syncWarning = ""

    if (Number.isFinite(productId) && productId > 0) {
      try {
        featuredProductIds = await syncFeaturedProductIdInConfig(
          Math.round(productId),
          input.isFeatured === true
        )
      } catch (error) {
        syncWarning =
          error instanceof Error
            ? `Producto guardado, pero no se pudo sincronizar destacados: ${error.message}`
            : "Producto guardado, pero no se pudo sincronizar destacados."
      }
    }

    return NextResponse.json({
      ok: true,
      menuProduct: {
        ...result.menuProduct,
        isFeatured:
          result.menuProduct?.isFeatured === true ||
          featuredProductIds.includes(Number(result.menuProduct?.id || 0)),
      },
      featuredProductIds,
      warning: syncWarning || undefined,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el producto del menú",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-menu-products-delete",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 256_000,
    rateLimitMessage: "Demasiados cambios del menú. Espera unos segundos e intenta nuevamente.",
  })

  if (guardResponse) return guardResponse


  try {
    const roleCheck = checkRole(request, ["owner", "manager"])

    if (!roleCheck.ok) {
      return roleCheck.response
    }

    const productId = Number(request.nextUrl.searchParams.get("id") || 0)

    if (!Number.isFinite(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "Falta el ID del producto." },
        { status: 400 }
      )
    }

    const result = await deleteMenuProduct(productId)

    try {
      await syncFeaturedProductIdInConfig(Math.round(productId), false)
    } catch {
      // El producto queda desactivado aunque no se pueda limpiar el destacado.
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo desactivar el producto del menú",
      },
      { status: 500 }
    )
  }
}
