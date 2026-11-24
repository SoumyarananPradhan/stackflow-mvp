import type { ReactNode } from "react";

import { Button } from "./Button";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span aria-label={label} className="inline-flex items-center gap-2" role="status">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
      />
      <span className="text-sm text-slate-600">{label}</span>
    </span>
  );
}

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  );
}

export function ErrorState({
  action,
  message = "Something went wrong. Please try again.",
  onRetry,
  title = "Unable to load this page",
}: {
  action?: ReactNode;
  message?: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <section
      aria-live="assertive"
      className="rounded-xl border border-red-200 bg-red-50 px-5 py-4"
      role="alert"
    >
      <h2 className="font-semibold text-red-900">{title}</h2>
      <p className="mt-1 text-sm text-red-800">{message}</p>
      {(action || onRetry) && (
        <div className="mt-4">
          {action ?? (
            <Button onClick={onRetry} variant="secondary">
              Try again
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-900",
    danger: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
}) {
  const tones = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-green-200 bg-green-50 text-green-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm ${tones[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
