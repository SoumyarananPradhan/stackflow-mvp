import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { Card, EmptyState, ErrorState, Spinner } from "../components/ui";
import { apiRequest } from "../lib/api";

interface LowStockItem {
  id: number;
  name: string;
  sku: string;
  quantity_on_hand: number;
  effective_threshold: number;
}

interface DashboardData {
  total_products: number;
  total_quantity: number;
  low_stock_items: LowStockItem[];
}

export function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DashboardData>("/api/dashboard/"),
  });

  if (dashboard.isPending) {
    return (
      <div className="py-12 text-center">
        <Spinner label="Loading dashboard…" />
      </div>
    );
  }

  if (dashboard.isError) {
    return (
      <ErrorState
        message={dashboard.error.message}
        onRetry={() => void dashboard.refetch()}
      />
    );
  }

  const { low_stock_items: lowStockItems, total_products, total_quantity } = dashboard.data;

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">A quick overview of your inventory.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-medium text-slate-600">Total products</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
            {total_products}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-600">Total units in stock</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
            {total_quantity}
          </p>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Low stock items</h2>
        {total_products === 0 ? (
          <EmptyState
            action={
              <Link
                className="inline-flex min-h-10 items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
                to="/products/new"
              >
                Add your first product
              </Link>
            }
            description="Add a product to start tracking your inventory."
            title="No products yet"
          />
        ) : lowStockItems.length === 0 ? (
          <EmptyState
            description="Your products are currently above their low-stock thresholds."
            title="Nothing is running low"
          />
        ) : (
          <Card className="overflow-hidden p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-semibold" scope="col">
                      Name
                    </th>
                    <th className="px-5 py-3 font-semibold" scope="col">
                      SKU
                    </th>
                    <th className="px-5 py-3 text-right font-semibold" scope="col">
                      Quantity
                    </th>
                    <th className="px-5 py-3 text-right font-semibold" scope="col">
                      Threshold
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lowStockItems.map((item) => (
                    <tr className="hover:bg-slate-50" key={item.id}>
                      <td className="px-5 py-4 font-medium text-slate-900">
                        <Link
                          className="rounded-sm text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
                          to={`/products/${item.id}/edit`}
                        >
                          {item.name}
                        </Link>
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-600">{item.sku}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-900">
                        {item.quantity_on_hand}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-600">
                        {item.effective_threshold}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </section>
  );
}
