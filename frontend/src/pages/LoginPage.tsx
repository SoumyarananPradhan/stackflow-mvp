import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";

import type { AuthUser } from "../auth/context";
import { Button, Card, Input, Spinner } from "../components/ui";
import { apiRequest } from "../lib/api";

interface LoginValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const errorRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (loginValues: LoginValues) =>
      apiRequest<AuthUser>("/api/auth/login/", {
        method: "POST",
        body: loginValues,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/dashboard", { replace: true });
    },
  });

  useEffect(() => {
    if (mutation.error) {
      errorRef.current?.focus();
    }
  }, [mutation.error]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(values);
  }

  const errorMessage =
    mutation.error instanceof Error
      ? mutation.error.message
      : mutation.error
        ? "Unable to log in. Please try again."
        : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
      <header className="mb-6">
        <Link
          className="rounded-sm text-2xl font-bold tracking-tight text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          to="/login"
        >
          StockFlow
        </Link>
        <p className="mt-2 text-sm text-slate-600">Sign in to manage your inventory.</p>
      </header>

      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Log in</h1>
        <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
          {errorMessage && (
            <div
              aria-live="assertive"
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
              ref={errorRef}
              role="alert"
              tabIndex={-1}
            >
              {errorMessage}
            </div>
          )}
          <Input
            autoComplete="username"
            label="Email"
            name="email"
            onChange={(event) =>
              setValues((current) => ({ ...current, email: event.target.value }))
            }
            required
            type="email"
            value={values.email}
          />
          <Input
            autoComplete="current-password"
            label="Password"
            name="password"
            onChange={(event) =>
              setValues((current) => ({ ...current, password: event.target.value }))
            }
            required
            type="password"
            value={values.password}
          />
          <Button className="w-full" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? <Spinner label="Signing in…" /> : "Log in"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-slate-600">
        New to StockFlow?{" "}
        <Link
          className="rounded-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          to="/signup"
        >
          Create an account
        </Link>
      </p>
    </main>
  );
}
