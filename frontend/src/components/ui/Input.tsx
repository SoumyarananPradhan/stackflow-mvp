import { useId, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({
  "aria-describedby": describedBy,
  className = "",
  error,
  id,
  label,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const descriptionIds = [describedBy, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-slate-700" htmlFor={inputId}>
        {label}
      </label>
      <input
        aria-describedby={descriptionIds || undefined}
        aria-invalid={error ? true : undefined}
        className={`min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 ${className}`}
        id={inputId}
        {...props}
      />
      {error && (
        <p aria-live="polite" className="text-sm text-red-700" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
