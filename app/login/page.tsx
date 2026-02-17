import Link from "next/link";

type Props = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const resolved = (await searchParams) ?? {};
  const error = resolved.error;

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>Sign in</h1>
        <p className="small">Use your Supabase email/password account to access the job board.</p>

        <form action="/api/auth/login" method="post">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="auth-input" autoComplete="email" />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="auth-input"
            autoComplete="current-password"
          />

          <button type="submit" className="auth-button">
            Sign in
          </button>
        </form>

        {error ? <p className="error-line">{decodeURIComponent(error)}</p> : null}

        <p className="switch-line">
          Need an account?{" "}
          <Link className="inline-button" href="/signup">
            Create one
          </Link>
        </p>

        <p className="small">
          <Link href="/dashboard">Back to dashboard</Link>
        </p>
      </section>
    </main>
  );
}
