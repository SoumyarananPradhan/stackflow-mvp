import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Notice,
  Spinner,
} from "../components/ui";
import { apiRequest } from "../lib/api";
import type { Product, ProductListResponse } from "../lib/products";

const pageSize = 20;

type Ordering = "" | "name" | "-name" | "quantity_on_hand" | "-quantity_on_hand";

export function ProductsPage() {
  const location = useLocation();
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState<Ordering>("");
  const [localNotice, setLocalNotice] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 300);
    return () => window.clearTimeout(timerId);
  }, [searchText]);

  const products = useQuery({
    queryKey: ["products", "list", page, debouncedSearch, ordering],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }
      if (ordering) {
        params.set("ordering", ordering);
      }
      return apiRequest<ProductListResponse>(`/api/products/?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });
  const deleteMutation = useMutation({
    mutationFn: (productId: number) =>
      apiRequest<void>(`/api/products/${productId}/`, { method: "DELETE" }),
    onSuccess: async () => {
      if (page > 1 && !products.isPlaceholderData && products.data?.results.length === 1) {
        setPage((current) => current - 1);
      }
      setProductToDelete(null);
      setDeleteError(undefined);
      setLocalNotice("Product deleted.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error) => {
      setProductToDelete(null);
      setDeleteError(error instanceof Error ? error.message : "Unable to delete product.");
    },
  });

  if (products.isPending) {
    return (
      <div className="py-12 text-center">
        <Spinner label="Loading products…" />
      </div>
    );
  }

  if (products.isError && !products.data) {
    return (
      <ErrorState message={products.error.message} onRetry={() => void products.refetch()} />
    );
  }

  const data = products.data;
  const totalPages = Math.max(1, Math.ceil(data.count / pageSize));
  const notice = localNotice ?? readNotice(location.state);

  function toggleOrdering(field: "name" | "quantity_on_hand") {
    setPage(1);
    setOrdering((current) =>
      current === field ? `-${field}` : current === `-${field}` ? field : field,
    );
  }

  const hasSearch = debouncedSearch.length > 0;

  return (
    <section>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Products</h1>
          <p className="mt-2 text-sm text-slate-600">View and manage your inventory.</p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          to="/products/new"
        >
          Add Product
        </Link>
      </header>

      {notice && (
        <div className="mb-5">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}
      {deleteError && (
        <div className="mb-5">
          <Notice tone="error">{deleteError}</Notice>
        </div>
      )}
      {products.isError && products.data && (
        <div className="mb-5">
          <ErrorState
            message={products.error.message}
            onRetry={() => void products.refetch()}
          />
        </div>
      )}

      <Card>
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-sm">
            <Input
              label="Search products"
              onChange={(event) => {
                setPage(1);
                setSearchText(event.target.value);
              }}
              placeholder="Search by name or SKU"
              type="search"
              value={searchText}
            />
          </div>
          <p aria-live="polite" className="min-h-5 text-sm text-slate-500" role="status">
            {products.isFetching && products.isPlaceholderData ? "Updating results…" : ""}
          </p>
        </div>

        {data.results.length === 0 ? (
          hasSearch ? (
            <EmptyState
              description={`No products match "${debouncedSearch}". Try a different name or SKU.`}
              title="No search results"
            />
          ) : (
            <EmptyState
              action={
                <Link
                  className="inline-flex min-h-10 items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
                  to="/products/new"
                >
                  Add Product
                </Link>
              }
              description="Add a product to start tracking your inventory."
              title="No products yet"
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table
                aria-busy={products.isFetching}
                className="w-full min-w-[58rem] border-collapse text-left text-sm"
              >
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <SortableHeader
                      direction={getSortDirection(ordering, "name")}
                      label="Name"
                      onClick={() => toggleOrdering("name")}
                    />
                    <th className="px-4 py-3 font-semibold" scope="col">
                      SKU
                    </th>
                    <SortableHeader
                      align="right"
                      direction={getSortDirection(ordering, "quantity_on_hand")}
                      label="Quantity"
                      onClick={() => toggleOrdering("quantity_on_hand")}
                    />
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Low stock
                    </th>
                    <th className="px-4 py-3 text-right font-semibold" scope="col">
                      Selling price
                    </th>
                    <th className="px-4 py-3 text-right font-semibold" scope="col">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.results.map((product) => (
                    <tr className="hover:bg-slate-50" key={product.id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{product.name}</td>
                      <td className="px-4 py-4 font-mono text-slate-600">{product.sku}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-slate-900">
                        {product.quantity_on_hand}
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={product.is_low_stock ? "warning" : "success"}>
                          {product.is_low_stock ? "Low stock" : "In stock"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-slate-700">
                        {formatPrice(product.selling_price)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            className="inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
                            to={`/products/${product.id}/edit`}
                          >
                            Edit
                          </Link>
                          <Button
                            onClick={() => {
                              setDeleteError(undefined);
                              setProductToDelete(product);
                            }}
                            variant="danger"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row">
              <p aria-live="polite" className="text-sm text-slate-600">
                Page {page} of {totalPages}
                {data.count > 0 && ` · ${data.count} products`}
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={page <= 1 || products.isPlaceholderData}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  variant="secondary"
                >
                  Previous
                </Button>
                <Button
                  disabled={!data.next || products.isPlaceholderData}
                  onClick={() => setPage((current) => current + 1)}
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
      <ConfirmDialog
        confirmDisabled={deleteMutation.isPending}
        confirmLabel={deleteMutation.isPending ? "Deleting…" : "Delete product"}
        description={
          productToDelete
            ? `Are you sure you want to permanently delete "${productToDelete.name}"? This action cannot be undone.`
            : undefined
        }
        onCancel={() => {
          if (!deleteMutation.isPending) {
            setProductToDelete(null);
          }
        }}
        onConfirm={() => {
          if (productToDelete) {
            deleteMutation.mutate(productToDelete.id);
          }
        }}
        open={productToDelete !== null}
        title="Delete product?"
      />
    </section>
  );
}

function SortableHeader({
  align,
  direction,
  label,
  onClick,
}: {
  align?: "left" | "right";
  direction: "ascending" | "descending" | "none";
  label: string;
  onClick: () => void;
}) {
  return (
    <th
      aria-sort={direction}
      className={`px-4 py-3 font-semibold ${align === "right" ? "text-right" : ""}`}
      scope="col"
    >
      <button
        className="rounded-sm hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
        onClick={onClick}
        type="button"
      >
        {label}
        <span aria-hidden="true" className="ml-1">
          {direction === "ascending" ? "↑" : direction === "descending" ? "↓" : "↕"}
        </span>
      </button>
    </th>
  );
}

function getSortDirection(
  ordering: Ordering,
  field: "name" | "quantity_on_hand",
): "ascending" | "descending" | "none" {
  if (ordering === field) {
    return "ascending";
  }
  if (ordering === `-${field}`) {
    return "descending";
  }
  return "none";
}

function formatPrice(price: string | null): string {
  if (price === null) {
    return "-";
  }
  const [whole, fraction = ""] = price.split(".");
  return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

function readNotice(state: unknown): string | undefined {
  if (
    typeof state === "object" &&
    state !== null &&
    "notice" in state &&
    typeof state.notice === "string"
  ) {
    return state.notice;
  }
  return undefined;
}
