import { fetch } from "expo/fetch";
import { getApiUrl } from "./query-client";

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown,
  token?: string | null
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.message || text;
    } catch {}
    const err = new Error(message) as any;
    err.status = res.status;
    err.limitReached = message.includes("limit reached") || message.includes("limitReached");
    throw err;
  }

  return res;
}

export async function authedRequest(
  method: string,
  route: string,
  data?: unknown,
  token?: string | null
): Promise<Response> {
  return apiRequest(method, route, data, token);
}
