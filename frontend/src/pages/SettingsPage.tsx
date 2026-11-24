import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, Card, ErrorState, Input, Notice, Spinner } from "../components/ui";
import { ApiError, apiRequest } from "../lib/api";

interface OrganizationSettings {
  default_low_stock_threshold: number;
}

const settingsQueryKey = ["settings"] as const;
const maximumThreshold = 1_000_000;

export function SettingsPage() {
  const [threshold, setThreshold] = useState<string>();
  const [clientError, setClientError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: settingsQueryKey,
    queryFn: () => apiRequest<OrganizationSettings>("/api/settings/"),
  });
  const mutation = useMutation({
    mutationFn: (defaultThreshold: number) =>
      apiRequest<OrganizationSettings>("/api/settings/", {
        method: "PATCH",
        body: { default_low_stock_threshold: defaultThreshold },
      }),
    onSuccess: async (updatedSettings) => {
      queryClient.setQueryData(settingsQueryKey, updatedSettings);
        setThreshold(String(updatedSettings.default_low_stock_threshold));
      setSaved(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
  });

  const serverFieldError = readFieldError(
    mutation.error,
    "default_low_stock_threshold",
  );
  const fieldError = clientError ?? serverFieldError;
  const nonFieldError = readFieldError(mutation.error, "non_field_errors");
  const formError =
    nonFieldError ??
    (mutation.error && !serverFieldError ? mutation.error.message : undefined);

  useEffect(() => {
    if (fieldError) {
      document.getElementById("default-low-stock-threshold")?.focus();
    } else if (formError) {
      formErrorRef.current?.focus();
    }
  }, [fieldError, formError]);

  if (settings.isPending) {
    return (
      <div className="py-12 text-center">
        <Spinner label="Loading settings…" />
      </div>
    );
  }

  if (settings.isError) {
    return (
      <ErrorState
        message={settings.error.message}
        onRetry={() => void settings.refetch()}
      />
    );
  }

  const currentThreshold =
    threshold ?? String(settings.data.default_low_stock_threshold);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.reset();
    setSaved(false);

    const parsedThreshold = Number(currentThreshold);
    if (
      currentThreshold.trim() === "" ||
      !Number.isInteger(parsedThreshold) ||
      parsedThreshold < 0 ||
      parsedThreshold > maximumThreshold
    ) {
      setClientError(
        `Enter a whole number between 0 and ${maximumThreshold.toLocaleString()}.`,
      );
      return;
    }

    setClientError(undefined);
    mutation.mutate(parsedThreshold);
  }

  return (
    <section className="max-w-2xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Configure the default low-stock threshold for your organization.
        </p>
      </header>

      <Card>
        <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Inventory</h2>
            <p className="mt-1 text-sm text-slate-600">
              This value applies to products without their own threshold.
            </p>
          </div>
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
          {saved && <Notice tone="success">Settings saved.</Notice>}
          <Input
            error={fieldError}
            id="default-low-stock-threshold"
            label="Default low stock threshold"
            max={maximumThreshold}
            min={0}
            name="default_low_stock_threshold"
            onChange={(event) => {
              mutation.reset();
              setSaved(false);
              setClientError(undefined);
              setThreshold(event.target.value);
            }}
            required
            step={1}
            type="number"
            value={currentThreshold}
          />
          <div>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? (
                <Spinner label="Saving settings…" />
              ) : (
                "Save settings"
              )}
            </Button>
          </div>
        </form>
      </Card>
    </section>
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
