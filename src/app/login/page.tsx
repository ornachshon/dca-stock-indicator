"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={signInWithGoogle}
        style={{
          width: "min(420px, 100%)",
          padding: "28px 24px",
          borderRadius: 16,
          border: "1px solid var(--line)",
          background: "rgba(18, 26, 43, 0.9)",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: "1.6rem" }}>Sign in</h1>
        <p style={{ margin: "0 0 22px", color: "var(--muted)", lineHeight: 1.5 }}>
          Use your Google account. Your email is saved so we know who signed in.
        </p>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            border: "1px solid var(--accent-dim)",
            borderRadius: 999,
            padding: "12px 16px",
            background: "rgba(61, 214, 198, 0.14)",
            color: "var(--accent)",
            fontSize: "1rem",
            fontWeight: 650,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Redirecting…" : "Continue with Google"}
        </button>
        {error && (
          <p style={{ margin: "14px 0 0", color: "#ff7b7b", lineHeight: 1.45 }}>{error}</p>
        )}
      </form>
    </main>
  );
}
