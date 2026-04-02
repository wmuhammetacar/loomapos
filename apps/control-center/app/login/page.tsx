type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
    reason?: string;
    error?: string;
  }>;
};

const reasonMessages: Record<string, string> = {
  missing_internal_session: "Internal admin session is required.",
  invalid_or_expired_token: "Session expired. Please sign in again.",
  role_not_allowed: "Your internal role is not authorized for Control Center.",
  auth_validation_unavailable: "Internal auth service is currently unavailable.",
  signed_out: "You have signed out safely."
};

const errorMessages: Record<string, string> = {
  missing_credentials: "Email and password are required.",
  login_failed: "Internal admin login failed. Verify your credentials.",
  invalid_login_response: "Internal admin auth response is invalid.",
  login_unavailable: "Internal admin auth service is unavailable."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = params.next && params.next.startsWith("/") ? params.next : "/dashboard";
  const reasonMessage = params.reason ? reasonMessages[params.reason] : null;
  const errorMessage = params.error ? errorMessages[params.error] : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <section className="w-full rounded-xl border border-line bg-surface p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Internal Access</p>
            <h1 className="mt-1 text-2xl font-semibold">Control Center Sign In</h1>
            <p className="mt-2 text-sm text-gray-600">
              Internal admin identity is required for all Control Center routes.
            </p>

            {reasonMessage ? (
              <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                {reasonMessage}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {errorMessage}
              </div>
            ) : null}

            <form action="/login/submit" method="post" className="mt-5 space-y-4">
              <input type="hidden" name="next" value={nextPath} />

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Email</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="username"
                  className="w-full rounded-md border border-line bg-background px-3 py-2"
                  placeholder="ops@loomapos.com"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Password</span>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-md border border-line bg-background px-3 py-2"
                  placeholder="••••••••"
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Sign in
              </button>
            </form>

            <div className="mt-4 text-xs text-gray-500">
              Need internal access provisioning? Contact platform security.
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Access policy is enforced by backend internal admin authentication and role checks.
            </div>
      </section>
    </main>
  );
}
