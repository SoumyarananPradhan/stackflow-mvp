import { Link } from "react-router";

import { PlaceholderPage } from "./PlaceholderPage";

export function LoginPage() {
  return (
    <>
      <PlaceholderPage title="Log in" />
      <p className="mt-6 text-sm text-slate-600">
        New to StockFlow?{" "}
        <Link className="font-medium text-blue-700 hover:text-blue-800" to="/signup">
          Create an account
        </Link>
      </p>
    </>
  );
}
