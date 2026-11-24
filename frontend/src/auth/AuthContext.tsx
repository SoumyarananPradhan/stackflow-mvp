import { useCallback, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiRequest, onUnauthorized } from "../lib/api";
import { AuthContext, type AuthContextValue, type AuthUser } from "./context";

const authQueryKey = ["auth", "me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const authQuery = useQuery<AuthUser | null>({
    queryKey: authQueryKey,
    queryFn: async () => {
      try {
        return await apiRequest<AuthUser>("/api/auth/me/");
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  useEffect(
    () => onUnauthorized(() => queryClient.setQueryData(authQueryKey, null)),
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>("/api/auth/logout/", { method: "POST" });
    } catch (error) {
      if (!(error instanceof ApiError && (error.status === 401 || error.status === 403))) {
        throw error;
      }
    }
    queryClient.setQueryData(authQueryKey, null);
  }, [queryClient]);

  const value: AuthContextValue = {
    user: authQuery.data ?? null,
    isLoading: authQuery.isPending,
    error: authQuery.error instanceof Error ? authQuery.error : null,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
