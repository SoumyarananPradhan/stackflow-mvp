import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";

import { Button, Card, ErrorState, Input, Spinner } from "../components/ui";
import { ApiError, apiRequest } from "../lib/api";
import { getApiFieldError } from "../lib/formErrors";
import type { Product } from "../lib/products";

interface ProductValues {
  name: string;
  sku: string;
  description: string;
  quantity_on_hand: string;
  cost_price: string;
  selling_price: string;
  low_stock_threshold: string;
}

type ProductField = keyof ProductValues;
type ProductErrors = Partial<Record<ProductField, string>>;

const productFields: ProductField[] = [
  "name",
  "sku",
  "description",
  "quantity_on_hand",
  "cost_price",
  "selling_price",
  "low_stock_threshold",
];

export function ProductFormPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const productQuery = useQuery({
    queryKey: ["products", "detail", id],
    queryFn: () => apiRequest<Product>(`/api/products/${id}/`),
    enabled: id !== undefined,
  });

  if (id && productQuery.isPending) {
    return (
      <div className="py-12 text-center">
        <Spinner label="Loading product…" />
      </div>
    );
  }

  if (id && productQuery.isError) {
    if (productQuery.error instanceof ApiError && productQuery.error.status === 404) {
      return (
        <ErrorState
          action={
            <Link
              className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
              to="/products"
            >
              Back to products
            </Link>
          }
          message="This product may have been deleted or is not available to your organization."
          title="Product not found"
        />
      );
    }

    return (
      <ErrorState
        message={productQuery.error.message}
        onRetry={() => void productQuery.refetch()}
      />
    );
  }

  if (id && !productQuery.data) {
    return (
      <div className="py-12 text-center">
        <Spinner label="Loading product…" />
      </div>
    );
  }

  return (
    <ProductEditor
      key={id ?? "new-product"}
      product={id ? (productQuery.data ?? null) : null}
      onSave={async (values) => {
        const url = id ? `/api/products/${id}/` : "/api/products/";
        const savedProduct = await apiRequest<Product>(url, {
          method: id ? "PATCH" : "POST",
          body: values,
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["products"] }),
          queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        ]);
        navigate("/products", {
          replace: true,
          state: { notice: id ? "Product updated." : "Product created." },
        });
        return savedProduct;
      }}
    />
  );
}

function ProductEditor({
  onSave,
  product,
}: {
  onSave: (values: ProductRequest) => Promise<Product>;
  product: Product | null;
}) {
  const [values, setValues] = useState<ProductValues>(() => createInitialValues(product));
  const [clientErrors, setClientErrors] = useState<ProductErrors>({});
  const formErrorRef = useRef<HTMLDivElement>(null);
  const mutation = useMutation({ mutationFn: onSave });

  const serverErrors: ProductErrors = {
    name: getApiFieldError(mutation.error, "name"),
    sku: getApiFieldError(mutation.error, "sku"),
    description: getApiFieldError(mutation.error, "description"),
    quantity_on_hand: getApiFieldError(mutation.error, "quantity_on_hand"),
    cost_price: getApiFieldError(mutation.error, "cost_price"),
    selling_price: getApiFieldError(mutation.error, "selling_price"),
    low_stock_threshold: getApiFieldError(mutation.error, "low_stock_threshold"),
  };
  const fieldErrors: ProductErrors = {
    name: clientErrors.name ?? serverErrors.name,
    sku: clientErrors.sku ?? serverErrors.sku,
    description: clientErrors.description ?? serverErrors.description,
    quantity_on_hand: clientErrors.quantity_on_hand ?? serverErrors.quantity_on_hand,
    cost_price: clientErrors.cost_price ?? serverErrors.cost_price,
    selling_price: clientErrors.selling_price ?? serverErrors.selling_price,
    low_stock_threshold:
      clientErrors.low_stock_threshold ?? serverErrors.low_stock_threshold,
  };
  const hasServerFieldErrors = Object.values(serverErrors).some(Boolean);
  const formError =
    getApiFieldError(mutation.error, "non_field_errors") ??
    (mutation.error && !hasServerFieldErrors ? mutation.error.message : undefined);

  useEffect(() => {
    if (!mutation.error) {
      return;
    }

    const firstInvalidField = productFields.find((field) =>
      getApiFieldError(mutation.error, field),
    );
    if (firstInvalidField) {
      document.getElementById(`product-${firstInvalidField}`)?.focus();
    } else if (formError) {
      formErrorRef.current?.focus();
    }
  }, [formError, mutation.error]);

  function updateField(field: ProductField, value: string) {
    mutation.reset();
    setClientErrors((errors) => ({ ...errors, [field]: undefined }));
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.reset();

    const errors = validateProductValues(values);
    setClientErrors(errors);
    const firstInvalidField = productFields.find((field) => errors[field]);
    if (firstInvalidField) {
      document.getElementById(`product-${firstInvalidField}`)?.focus();
      return;
    }

    mutation.mutate(createProductRequest(values));
  }

  return (
    <section className="max-w-3xl">
      <header className="mb-6">
        <Link
          className="text-sm font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          to="/products"
        >
          &larr; Back to products
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          {product ? "Edit product" : "Add product"}
        </h1>
      </header>

      <Card>
        <form className="grid gap-5" noValidate onSubmit={(event) => void handleSubmit(event)}>
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

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              autoComplete="off"
              error={fieldErrors.name}
              id="product-name"
              label="Name"
              name="name"
              onChange={(event) => updateField("name", event.target.value)}
              required
              value={values.name}
            />
            <Input
              autoComplete="off"
              error={fieldErrors.sku}
              id="product-sku"
              label="SKU"
              name="sku"
              onChange={(event) => updateField("sku", event.target.value)}
              required
              value={values.sku}
            />
          </div>

          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="product-description"
            >
              Description
            </label>
            <textarea
              className="min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="product-description"
              name="description"
              onChange={(event) => updateField("description", event.target.value)}
              value={values.description}
            />
            {fieldErrors.description && (
              <p aria-live="polite" className="text-sm text-red-700">
                {fieldErrors.description}
              </p>
            )}
          </div>

          <Input
            error={fieldErrors.quantity_on_hand}
            id="product-quantity_on_hand"
            label="Quantity on hand"
            min={0}
            name="quantity_on_hand"
            onChange={(event) => updateField("quantity_on_hand", event.target.value)}
            required
            step={1}
            type="number"
            value={values.quantity_on_hand}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              error={fieldErrors.cost_price}
              id="product-cost_price"
              label="Cost price"
              min={0}
              name="cost_price"
              onChange={(event) => updateField("cost_price", event.target.value)}
              step="0.01"
              type="number"
              value={values.cost_price}
            />
            <Input
              error={fieldErrors.selling_price}
              id="product-selling_price"
              label="Selling price"
              min={0}
              name="selling_price"
              onChange={(event) => updateField("selling_price", event.target.value)}
              step="0.01"
              type="number"
              value={values.selling_price}
            />
          </div>

          <Input
            error={fieldErrors.low_stock_threshold}
            id="product-low_stock_threshold"
            label="Low stock threshold"
            min={0}
            name="low_stock_threshold"
            onChange={(event) => updateField("low_stock_threshold", event.target.value)}
            placeholder="Uses organization default"
            step={1}
            type="number"
            value={values.low_stock_threshold}
          />

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
              to="/products"
            >
              Cancel
            </Link>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? (
                <Spinner label={product ? "Saving product…" : "Creating product…"} />
              ) : product ? (
                "Save changes"
              ) : (
                "Create product"
              )}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}

interface ProductRequest {
  name: string;
  sku: string;
  description: string;
  quantity_on_hand: number;
  cost_price: string | null;
  selling_price: string | null;
  low_stock_threshold: number | null;
}

function createInitialValues(product: Product | null): ProductValues {
  if (!product) {
    return {
      name: "",
      sku: "",
      description: "",
      quantity_on_hand: "0",
      cost_price: "",
      selling_price: "",
      low_stock_threshold: "",
    };
  }

  return {
    name: product.name,
    sku: product.sku,
    description: product.description,
    quantity_on_hand: String(product.quantity_on_hand),
    cost_price: product.cost_price ?? "",
    selling_price: product.selling_price ?? "",
    low_stock_threshold:
      product.low_stock_threshold === null ? "" : String(product.low_stock_threshold),
  };
}

function validateProductValues(values: ProductValues): ProductErrors {
  const errors: ProductErrors = {};
  if (!values.name.trim()) {
    errors.name = "Name is required.";
  }
  if (!values.sku.trim()) {
    errors.sku = "SKU is required.";
  }
  if (!isNonNegativeInteger(values.quantity_on_hand)) {
    errors.quantity_on_hand = "Enter a whole number greater than or equal to 0.";
  }
  if (!isOptionalPrice(values.cost_price)) {
    errors.cost_price = "Enter a non-negative price with up to 2 decimal places.";
  }
  if (!isOptionalPrice(values.selling_price)) {
    errors.selling_price = "Enter a non-negative price with up to 2 decimal places.";
  }
  if (!isOptionalNonNegativeInteger(values.low_stock_threshold)) {
    errors.low_stock_threshold = "Enter a whole number greater than or equal to 0.";
  }
  return errors;
}

function createProductRequest(values: ProductValues): ProductRequest {
  return {
    name: values.name.trim(),
    sku: values.sku.trim(),
    description: values.description,
    quantity_on_hand: Number(values.quantity_on_hand),
    cost_price: values.cost_price.trim() || null,
    selling_price: values.selling_price.trim() || null,
    low_stock_threshold: values.low_stock_threshold.trim()
      ? Number(values.low_stock_threshold)
      : null,
  };
}

function isNonNegativeInteger(value: string): boolean {
  if (!/^\d+$/.test(value)) {
    return false;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0;
}

function isOptionalNonNegativeInteger(value: string): boolean {
  return value.trim() === "" || isNonNegativeInteger(value);
}

function isOptionalPrice(value: string): boolean {
  const price = value.trim();
  if (price === "") {
    return true;
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(price)) {
    return false;
  }
  return price.split(".")[0].length <= 10;
}
