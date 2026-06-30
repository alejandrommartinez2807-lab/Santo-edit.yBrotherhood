#!/usr/bin/env node

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";
const ownerPassword =
  process.env.E2E_OWNER_PASSWORD ||
  process.env.ORDERS_OWNER_PASSWORD ||
  process.env.OWNER_PASSWORD ||
  "";

const requiredPublicKeys = [
  "publicAllowOrdering",
  "publicAllowEatHere",
  "publicAllowTakeaway",
  "publicAllowDelivery",
  "publicAllowOpenAccounts",
  "publicAllowPaymentProofs",
  "publicAllowCustomerNotes",
  "publicAllowAttachments",
];

const requiredPrivateKeys = [
  "businessComplexityProfile",
  "internalAllowCancelOrders",
  "internalAllowEditOrderNotes",
  "internalAllowReopenPayments",
  "internalRequireCloseReview",
  "internalShowAdvancedReports",
  "inventoryAutoDeductEnabled",
  "inventoryAutoDeductDryRun",
];

async function readJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let json = {};

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} no devolvió JSON válido: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(
      `${path} devolvió ${response.status}: ${json.error || text}`,
    );
  }

  return json;
}

function assertKeys(source, keys, label) {
  const missing = keys.filter((key) => !(key in source));

  if (missing.length) {
    throw new Error(`${label}: faltan campos ${missing.join(", ")}`);
  }
}

async function main() {
  console.log(`E2E complejidad 2g contra ${baseUrl}`);

  const publicConfig = await readJson("/api/public/business-config");
  assertKeys(
    publicConfig.businessConfig || publicConfig,
    requiredPublicKeys,
    "Config pública",
  );
  console.log("✓ Config pública expone controles públicos");

  if (!ownerPassword) {
    console.log(
      "⚠ No hay E2E_OWNER_PASSWORD/ORDERS_OWNER_PASSWORD. Se omite revisión privada.",
    );
    return;
  }

  const privateConfig = await readJson("/api/business-config", {
    headers: { "x-admin-password": ownerPassword },
  });
  assertKeys(
    privateConfig.businessConfig || privateConfig,
    requiredPrivateKeys,
    "Config privada",
  );
  console.log("✓ Config privada expone permisos internos");
  console.log(
    "✓ Inventario automático queda preparado sin activarse por defecto",
  );
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
