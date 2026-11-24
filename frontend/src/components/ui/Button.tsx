import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-blue-700 text-white hover:bg-blue-800 focus-visible:ring-blue-700",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-blue-700",
  danger: "bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-700",
  ghost: "text-slate-700 hover:bg-slate-100 focus-visible:ring-blue-700",
};

export function Button({
  className = "",
  disabled,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      type={type}
      {...props}
    />
  );
}
