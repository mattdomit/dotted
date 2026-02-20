const host = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const API_BASE = host.endsWith("/api") ? host : `${host}/api`;

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, headers, ...rest } = options || {};

  const authHeaders: Record<string, string> = {};
  const resolvedToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  if (resolvedToken) {
    authHeaders["Authorization"] = `Bearer ${resolvedToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...headers,
    },
    ...rest,
  });

  const json = await res.json().catch(() => ({ error: res.statusText }));

  if (!res.ok) {
    throw new Error(json.error || json.message || `API error ${res.status}`);
  }

  return json as T;
}
