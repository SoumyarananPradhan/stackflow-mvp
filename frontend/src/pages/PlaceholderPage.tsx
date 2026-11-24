export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
        StockFlow
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        This page is a placeholder. Inventory workflows will be added in a later step.
      </p>
    </section>
  );
}
