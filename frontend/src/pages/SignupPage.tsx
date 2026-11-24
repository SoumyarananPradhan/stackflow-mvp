import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";

import { ApiError, apiRequest } from "../lib/api";
import { Button, Card, Input, Spinner } from "../components/ui";
import type { AuthUser } from "../auth/context";

interface SignupValues {
  email: string;
  password: string;
  confirm_password: string;
  organization_name: string;
}

type SignupField = keyof SignupValues;
type SignupErrors = Partial<Record<SignupField, string>>;

const signupFields: SignupField[] = [
  "email",
  "password",
  "confirm_password",
  "organization_name",
];

export function SignupPage() {
  const [values, setValues] = useState<SignupValues>({
    email: "",
    password: "",
    confirm_password: "",
    organization_name: "",
  });
  const [clientErrors, setClientErrors] = useState<SignupErrors>({});
  const formErrorRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (signupValues: SignupValues) =>
      apiRequest<AuthUser>("/api/auth/signup/", {
        method: "POST",
        body: signupValues,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/dashboard", { replace: true });
    },
  });

  const serverErrors: SignupErrors = {
    email: readFieldError(mutation.error, "email"),
    password: readFieldError(mutation.error, "password"),
    confirm_password: readFieldError(mutation.error, "confirm_password"),
    organization_name: readFieldError(mutation.error, "organization_name"),
  };
  const fieldErrors: SignupErrors = {
    email: clientErrors.email ?? serverErrors.email,
    password: clientErrors.password ?? serverErrors.password,
    confirm_password: clientErrors.confirm_password ?? serverErrors.confirm_password,
    organization_name: clientErrors.organization_name ?? serverErrors.organization_name,
  };
  const firstInvalidField = signupFields.find((field) => fieldErrors[field]);
  const hasServerFieldErrors = Object.values(serverErrors).some(Boolean);
  const formError =
    readFieldError(mutation.error, "non_field_errors") ??
    (mutation.error && !hasServerFieldErrors ? mutation.error.message : undefined);

  useEffect(() => {
    if (firstInvalidField) {
      document.getElementById(`signup-${firstInvalidField}`)?.focus();
    } else if (formError) {
      formErrorRef.current?.focus();
    }
  }, [firstInvalidField, formError]);

  function updateField(field: SignupField, value: string) {
    mutation.reset();
    setClientErrors((errors) => ({
      ...errors,
      [field]: undefined,
      ...(field === "password" ? { confirm_password: undefined } : {}),
    }));
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.reset();
    const errors: SignupErrors = {};

    if (!values.email.trim()) {
      errors.email = "Email is required.";
    }
    if (!values.password) {
      errors.password = "Password is required.";
    }
    if (!values.confirm_password) {
      errors.confirm_password = "Please confirm your password.";
    } else if (values.password !== values.confirm_password) {
      errors.confirm_password = "Passwords do not match.";
    }
    if (!values.organization_name.trim()) {
      errors.organization_name = "Organization name is required.";
    }

    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    mutation.mutate(values);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
      <header className="mb-6">
        <Link
          className="rounded-sm text-2xl font-bold tracking-tight text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          to="/login"
        >
          StockFlow
        </Link>
        <p className="mt-2 text-sm text-slate-600">Create an account for your organization.</p>
      </header>

      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
        <form className="mt-6 grid gap-5" noValidate onSubmit={handleSubmit}>
          {formError && (
            <div
              aria-live="assertive"
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              ref={formErrorRef}
              role="alert"
              tabIndex={-1}
            >
              {formError}
            </div>
          )}
          <Input
            autoComplete="email"
            error={fieldErrors.email}
            id="signup-email"
            label="Email"
            name="email"
            onChange={(event) => updateField("email", event.target.value)}
            required
            type="email"
            value={values.email}
          />
          <Input
            autoComplete="new-password"
            error={fieldErrors.password}
            id="signup-password"
            label="Password"
            name="password"
            onChange={(event) => updateField("password", event.target.value)}
            required
            type="password"
            value={values.password}
          />
          <Input
            autoComplete="new-password"
            error={fieldErrors.confirm_password}
            id="signup-confirm_password"
            label="Confirm password"
            name="confirm_password"
            onChange={(event) => updateField("confirm_password", event.target.value)}
            required
            type="password"
            value={values.confirm_password}
          />
          <Input
            autoComplete="organization"
            error={fieldErrors.organization_name}
            id="signup-organization_name"
            label="Organization name"
            name="organization_name"
            onChange={(event) => updateField("organization_name", event.target.value)}
            required
            value={values.organization_name}
          />
          <Button className="w-full" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? <Spinner label="Creating account…" /> : "Create account"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          className="rounded-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          to="/login"
        >
          Log in
        </Link>
      </p>
    </main>
  );
}

function readFieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError)) {
    return undefined;
  }

  const value = error.fieldErrors[field];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter((message): message is string => typeof message === "string").join(" ");
  }
  return undefined;
}
