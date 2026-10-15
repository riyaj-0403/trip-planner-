// Small fetch wrapper used by the real (backend) API layer.
// Every call goes through request(), so error handling lives in one place.

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "/api").replace(/\/$/, "");

/** An error that carries the HTTP status, so pages can react to 404 vs 400 vs 500. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** True for "this trip / destination / activity does not exist" (works for mock errors too). */
export function isNotFound(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 404;
  return err instanceof Error && /not found/i.test(err.message);
}

function resourceName(path: string): string {
  if (path.includes("/activities")) return "Activity";
  if (path.includes("/destinations")) return "Destination";
  return "Trip";
}

export async function request<T = void>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  // Read the body as text first: DELETE returns an empty body, so res.json() would throw.
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    if (res.status === 404) throw new ApiError(404, `${resourceName(path)} not found`);
    const message =
      (data as { message?: string } | undefined)?.message ||
      (res.status >= 500 ? "Something went wrong on the server. Please try again." : "Request failed.");
    throw new ApiError(res.status, message);
  }

  return data as T;
}