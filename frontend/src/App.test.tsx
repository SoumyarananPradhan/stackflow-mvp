import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "./App";
import { AuthContext, type AuthContextValue } from "./auth/context";

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to login", () => {
    const auth: AuthContextValue = {
      user: null,
      isLoading: false,
      error: null,
      logout: vi.fn(),
    };

    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/products"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route element={<p>Private products</p>} path="/products" />
            </Route>
            <Route element={<p>Login page</p>} path="/login" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Private products")).not.toBeInTheDocument();
  });
});
