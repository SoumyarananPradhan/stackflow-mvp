import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProductsPage } from "./ProductsPage";

describe("ProductsPage", () => {
  it("renders low-stock and in-stock badges from server state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          count: 2,
          next: null,
          previous: null,
          results: [
            {
              id: 1,
              name: "Low Widget",
              sku: "LOW-1",
              quantity_on_hand: 2,
              selling_price: null,
              is_low_stock: true,
            },
            {
              id: 2,
              name: "Stocked Widget",
              sku: "STOCK-1",
              quantity_on_hand: 20,
              selling_price: "10.00",
              is_low_stock: false,
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/products"]}>
          <Routes>
            <Route element={<ProductsPage />} path="/products" />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Low stock", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("In stock", { selector: "span" })).toBeInTheDocument();
  });
});
