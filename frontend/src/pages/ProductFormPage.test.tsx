import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProductFormPage } from "./ProductFormPage";

function renderProductForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/products/new"]}>
        <Routes>
          <Route element={<ProductFormPage />} path="/products/new" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProductFormPage", () => {
  it("shows required-field validation without submitting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderProductForm();

    fireEvent.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("SKU is required.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps server SKU errors to the SKU field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sku: ["A product with this SKU already exists."] }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderProductForm();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Widget" } });
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "WIDGET-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));

    expect(
      await screen.findByText("A product with this SKU already exists."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("SKU")).toHaveAttribute("aria-invalid", "true");
  });
});
