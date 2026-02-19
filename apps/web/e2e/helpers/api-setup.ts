const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function getDemoZoneId(): Promise<string> {
  const res = await fetch(`${API_URL}/api/zones`);
  if (!res.ok) throw new Error(`Failed to fetch zones: ${res.status}`);
  const json = await res.json();
  const zones = json.data as { id: string; slug: string }[];
  const demo = zones.find((z) => z.slug === "downtown-demo");
  if (!demo) throw new Error("Demo zone not found — did seed run?");
  return demo.id;
}

export async function createCycleViaAPI(
  adminToken: string,
  zoneId: string
): Promise<string> {
  const res = await fetch(`${API_URL}/api/cycles/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ zoneId }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Create cycle failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  return json.data.id as string;
}

export async function transitionCycle(
  adminToken: string,
  cycleId: string,
  targetStatus: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/cycles/transition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ cycleId, status: targetStatus }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Transition cycle to ${targetStatus} failed (${res.status}): ${body}`
    );
  }
}
