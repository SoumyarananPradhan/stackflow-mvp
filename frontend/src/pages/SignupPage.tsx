import { Link } from "react-router";

import { PlaceholderPage } from "./PlaceholderPage";

export function SignupPage() {
  return (
    <>
      <PlaceholderPage title="Create your account" />
      <p className="mt-6 text-sm text-slate-600">
        Already have an account?{" "}
        <Link className="font-medium text-blue-700 hover:text-blue-800" to="/login">
          Log in
        </Link>
      </p>
    </>
  );
}
