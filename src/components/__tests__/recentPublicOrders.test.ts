import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchRecentOrdersLiveInfo } from "@/components/recentPublicOrders";

// La hora de gracia de "Tus pedidos en curso": un pedido Listo/Entregado NO
// sale de la lista al instante — se queda 1 hora (por si el cliente quiere
// revisarlo) y después se poda. Cancelado sí sale de una.

const HOUR_MS = 60 * 60 * 1000;

function mockStatusFetch(byId: Record<string, { status?: string; missing?: boolean }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const id = new URL(url, "http://local.test").searchParams.get("pedido") || "";
      const entry = byId[id];
      if (!entry || entry.missing) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ ok: false }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          status: entry.status,
          displayNumber: "#07",
          payment: { reportable: false, reported: false, confirmed: true },
        }),
      };
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRecentOrdersLiveInfo — hora de gracia de Listo/Entregado", () => {
  it("un Listo recién visto (sin finishedAt) sigue en la lista con su estado", async () => {
    mockStatusFetch({ "ord-1": { status: "Listo" } });

    const { live, finishedIds } = await fetchRecentOrdersLiveInfo([{ id: "ord-1" }]);

    expect(finishedIds).toEqual([]);
    expect(live["ord-1"]?.status).toBe("Listo");
  });

  it("un Listo dentro de la hora de gracia sigue visible", async () => {
    mockStatusFetch({ "ord-2": { status: "Listo" } });
    const hace10min = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { live, finishedIds } = await fetchRecentOrdersLiveInfo([
      { id: "ord-2", finishedAt: hace10min },
    ]);

    expect(finishedIds).toEqual([]);
    expect(live["ord-2"]?.status).toBe("Listo");
  });

  it("un Entregado con la hora de gracia vencida se poda", async () => {
    mockStatusFetch({ "ord-3": { status: "Entregado" } });
    const hace2horas = new Date(Date.now() - 2 * HOUR_MS).toISOString();

    const { live, finishedIds } = await fetchRecentOrdersLiveInfo([
      { id: "ord-3", finishedAt: hace2horas },
    ]);

    expect(finishedIds).toEqual(["ord-3"]);
    expect(live["ord-3"]).toBeUndefined();
  });

  it("un Cancelado sale de una, sin hora de gracia", async () => {
    mockStatusFetch({ "ord-4": { status: "Cancelado" } });

    const { live, finishedIds } = await fetchRecentOrdersLiveInfo([{ id: "ord-4" }]);

    expect(finishedIds).toEqual(["ord-4"]);
    expect(live["ord-4"]).toBeUndefined();
  });

  it("un 404 (el local reinició el día) también se poda", async () => {
    mockStatusFetch({ "ord-5": { missing: true } });

    const { finishedIds } = await fetchRecentOrdersLiveInfo([{ id: "ord-5" }]);

    expect(finishedIds).toEqual(["ord-5"]);
  });
});
