import { useState } from "react";
import { NavLink, Outlet } from "react-router";

import { useAuth } from "../auth/useAuth";
import { Button } from "./ui";

const navigation = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Products", to: "/products" },
  { label: "Settings", to: "/settings" },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setLogoutError(null);
    try {
      await logout();
    } catch {
      setLogoutError("Unable to log out. Please try again.");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-6">
            <NavLink
              className="text-xl font-bold tracking-tight text-slate-900"
              to="/dashboard"
            >
              StockFlow
            </NavLink>
            <div className="text-right lg:hidden">
              <p className="text-sm font-medium text-slate-800">
                {user?.organization.name}
              </p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>

          <nav aria-label="Main navigation" className="flex flex-wrap gap-2">
            {navigation.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">
                {user?.organization.name}
              </p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <Button onClick={handleLogout} variant="secondary">
              Log out
            </Button>
          </div>
          <Button
            className="self-start lg:hidden"
            onClick={handleLogout}
            variant="secondary"
          >
            Log out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {logoutError && (
          <p
            aria-live="assertive"
            className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {logoutError}
          </p>
        )}
        <Outlet />
      </main>
    </div>
  );
}
