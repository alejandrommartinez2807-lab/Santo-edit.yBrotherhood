#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { assertBrotherhoodAt } from "./qa-lib.mjs";

// 3177 por defecto (antes 3000, donde llegó a vivir el dev server de otro
// cliente y este script le habría escrito).
const baseUrl = process.env.E2E_BASE_URL || process.env.BASE || "http://localhost:3177";

// La clave salía SOLO de process.env, así que sin exportarla a mano el script
// corría sin autenticar y fallaba sin decir por qué. Ahora cae a .env.local,
// que es donde vive de verdad.
function ownerPasswordFromEnvFile() {
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const clean = line.trim();
      if (!clean || clean.startsWith("#") || !clean.includes("=")) continue;
      const index = clean.indexOf("=");
      if (clean.slice(0, index).trim() !== "ORDERS_OWNER_PASSWORD") continue;
      return clean.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // sin .env.local se sigue con lo que haya en process.env
  }
  return "";
}

const ownerPassword =
  process.env.E2E_OWNER_PASSWORD ||
  process.env.ORDERS_OWNER_PASSWORD ||
  process.env.OWNER_PASSWORD ||
  ownerPasswordFromEnvFile();

await assertBrotherhoodAt(baseUrl);

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
