import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, Input, Spinner } from "../components/ui";
import { apiRequest } from "../lib/api";
import { getApiFieldError } from "../lib/formErrors";
import type { Product } from "../lib/products";

export function AdjustStockDialog({
  onAdjusted,
  onClose,
  product,
}: {
  onAdjusted: () => void;
  onClose: () => void;
  product: Product;
}) {
  const [deltaText, setDeltaText] = useState("");
  const [note, setNote] = useState("");
  const [clientError, setClientError] = useState<string>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ delta, note: adjustmentNote }: { delta: number; note: string }) =>
      apiRequest<Product>(`/api/products/${product.id}/adjust/`, {
        method: "POST",
        body: adjustmentNote ? { delta, note: adjustmentNote } : { delta },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      onAdjusted();
    },
  });

  const serverDeltaError = getApiFieldError(mutation.error, "delta");
  const deltaError = clientError ?? serverDeltaError;
  const serverNoteError = getApiFieldError(mutation.error, "note");
  const nonFieldError = getApiFieldError(mutation.error, "non_field_errors");
  const formError =
    nonFieldError ??
    (mutation.error && !serverDeltaError && !serverNoteError
      ? mutation.error.message
      : undefined);
  const parsedDelta = parseDelta(deltaText);
  const resultingQuantity =
    parsedDelta === null ? null : product.quantity_on_hand + parsedDelta;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  useEffect(() => {
    if (serverDeltaError) {
      document.getElementById("adjust-delta")?.focus();
    } else if (serverNoteError) {
      document.getElementById("adjust-note")?.focus();
    } else if (formError) {
      formErrorRef.current?.focus();
    }
  }, [formError, serverDeltaError, serverNoteError]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.reset();

    const delta = parseDelta(deltaText);
    if (delta === null) {
      setClientError("Enter a non-zero whole number, such as +5 or -2.");
      document.getElementById("adjust-delta")?.focus();
      return;
    }

    setClientError(undefined);
    mutation.mutate({ delta, note: note.trim() });
  }

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="w-[min(100%-2rem,30rem)] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40"
      onCancel={(event) => {
        event.preventDefault();
        if (!mutation.isPending) {
          onClose();
        }
      }}
      ref={dialogRef}
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold" id={titleId}>
          Adjust stock
        </h2>
        <p className="mt-1 text-sm text-slate-600" id={descriptionId}>
          {product.name} · Current quantity: {product.quantity_on_hand}
        </p>

        <form
          className="mt-5 grid gap-4"
          noValidate
          onSubmit={handleSubmit}
        >
          {formError && (
            <div
              aria-live="assertive"
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
              ref={formErrorRef}
              role="alert"
              tabIndex={-1}
            >
              {formError}
            </div>
          )}
          <Input
            data-autofocus
            error={deltaError}
            id="adjust-delta"
            inputMode="text"
            label="Quantity change"
            name="delta"
            onChange={(event) => {
              mutation.reset();
              setClientError(undefined);
              setDeltaText(event.target.value);
            }}
            placeholder="e.g. +5 or -2"
            required
            type="text"
            value={deltaText}
          />
          <Input
            error={serverNoteError}
            id="adjust-note"
            label="Note (optional)"
            maxLength={255}
            name="note"
            onChange={(event) => {
              mutation.reset();
              setNote(event.target.value);
            }}
            value={note}
          />
          {resultingQuantity !== null && (
            <p aria-live="polite" className="text-sm text-slate-700" role="status">
              Resulting quantity:{" "}
              <span className="font-semibold tabular-nums">{resultingQuantity}</span>
              {resultingQuantity < 0 && (
                <span className="ml-1 text-red-700"> (cannot be below zero)</span>
              )}
            </p>
          )}
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              disabled={mutation.isPending}
              onClick={onClose}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? (
                <Spinner label="Adjusting stock…" />
              ) : (
                "Adjust stock"
              )}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

function parseDelta(value: string): number | null {
  if (!/^[+-]?\d+$/.test(value.trim())) {
    return null;
  }
  const delta = Number(value);
  return Number.isSafeInteger(delta) && delta !== 0 ? delta : null;
}
