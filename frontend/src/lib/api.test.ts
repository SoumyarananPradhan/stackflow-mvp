import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "./api";

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "csrftoken=; Max-Age=0";
  });

  it("sends the decoded CSRF cookie on non-GET requests", async () => {
    document.cookie = "csrftoken=token%2Bvalue";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/products/", {
      method: "POST",
      body: { name: "Widget" },
    });

    const request = fetchMock.mock.calls[0][1];
    expect(new Headers(request?.headers).get("X-CSRFToken")).toBe("token+value");
    expect(request?.credentials).toBe("include");
  });
});
