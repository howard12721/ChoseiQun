type ErrorPayload = {
  message?: string;
};

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, {
    ...init,
    headers,
  });

  const data = (await response.json().catch(() => ({}))) as T & ErrorPayload;
  if (!response.ok) {
    throw new Error(data.message ?? "API request failed");
  }
  return data;
}
