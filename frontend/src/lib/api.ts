export type ApiFieldErrors = Record<string, unknown>;

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: ApiFieldErrors;

  constructor(status: number, body: unknown) {
    super(getErrorMessage(body, status));
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = getFieldErrors(body);
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

type UnauthorizedListener = () => void;

let csrfInitialization: Promise<void> | undefined;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function initializeApi(): Promise<void> {
  if (!csrfInitialization) {
    csrfInitialization = apiRequest<void>("/api/auth/csrf/");
  }
  return csrfInitialization;
}

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, headers: initialHeaders, ...requestOptions } = options;
  const headers = new Headers(initialHeaders);
  headers.set("Accept", "application/json");

  const method = (requestOptions.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    const csrfToken = readCookie("csrftoken");
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...requestOptions,
      method,
      headers,
      credentials: "include",
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body),
            headers: withJsonContentType(headers),
          }),
    });
  } catch (error) {
    throw new ApiError(0, {
      detail: error instanceof Error ? error.message : "Network request failed.",
    });
  }

  if (response.status === 401) {
    unauthorizedListeners.forEach((listener) => listener());
  }

  const responseBody = await parseResponse(response);
  if (!response.ok) {
    throw new ApiError(response.status, responseBody);
  }

  return responseBody as T;
}

function withJsonContentType(headers: Headers): Headers {
  const jsonHeaders = new Headers(headers);
  jsonHeaders.set("Content-Type", "application/json");
  return jsonHeaders;
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("json")) {
    const text = await response.text();
    if (response.ok) {
      throw new ApiError(response.status, {
        detail: "The server returned a non-JSON response.",
      });
    }
    return text;
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError(response.status, {
      detail: "The server returned invalid JSON.",
    });
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) {
    return undefined;
  }

  const value = cookie.slice(name.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getErrorMessage(body: unknown, status: number): string {
  if (isRecord(body) && typeof body.detail === "string") {
    return body.detail;
  }

  if (typeof body === "string" && body.length > 0) {
    return body;
  }

  return status === 0 ? "Network request failed." : `Request failed (${status}).`;
}

function getFieldErrors(body: unknown): ApiFieldErrors {
  if (isRecord(body)) {
    const fieldErrors = { ...body };
    delete fieldErrors.detail;
    return fieldErrors;
  }

  return body === undefined ? {} : { non_field_errors: body };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
