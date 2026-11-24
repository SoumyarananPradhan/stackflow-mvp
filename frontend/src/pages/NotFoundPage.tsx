import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-sm font-semibold text-blue-700">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        Page not found
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        The page you requested does not exist.
      </p>
      <Link
        className="mt-6 inline-flex rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        to="/dashboard"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
