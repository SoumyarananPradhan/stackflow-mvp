import { ApiError } from "./api";

export function getApiFieldError(error: unknown, field: string): string | undefined {
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
