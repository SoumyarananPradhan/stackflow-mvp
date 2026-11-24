import { useEffect, useId, useRef } from "react";

import { Button, type ButtonVariant } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [open]);

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className="w-[min(100%-2rem,30rem)] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold" id={titleId}>
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-sm leading-6 text-slate-600" id={descriptionId}>
            {description}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button data-autofocus onClick={onCancel} variant="secondary">
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} variant={confirmVariant}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
