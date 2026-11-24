import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router";

import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SignupPage } from "./pages/SignupPage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route element={<LoginPage />} path="/login" />
              <Route element={<SignupPage />} path="/signup" />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<Navigate replace to="/dashboard" />} path="/" />
              <Route
                element={<PlaceholderPage title="Dashboard" />}
                path="/dashboard"
              />
              <Route element={<PlaceholderPage title="Products" />} path="/products" />
              <Route
                element={<PlaceholderPage title="New product" />}
                path="/products/new"
              />
              <Route
                element={<PlaceholderPage title="Edit product" />}
                path="/products/:id/edit"
              />
              <Route element={<PlaceholderPage title="Settings" />} path="/settings" />
            </Route>
            <Route element={<NotFoundPage />} path="*" />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function ProtectedRoute() {
  const { user, isLoading, error } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoading />;
  }
  if (error) {
    return <AuthError message={error.message} />;
  }
  if (!user) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }
  return <AppShell />;
}

function PublicOnlyRoute() {
  const { user, isLoading, error } = useAuth();

  if (isLoading) {
    return <AuthLoading />;
  }
  if (error) {
    return <AuthError message={error.message} />;
  }
  return user ? <Navigate replace to="/dashboard" /> : <Outlet />;
}

function AuthLoading() {
  return (
    <main aria-live="polite" className="p-8 text-sm text-slate-600" role="status">
      Checking your session…
    </main>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <main className="p-8" role="alert">
      <h1 className="text-lg font-semibold text-slate-900">Unable to check your session</h1>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
    </main>
  );
}
