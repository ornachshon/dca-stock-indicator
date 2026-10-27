import { StockExplorer } from "../components/StockExplorer";
import { createClient } from "../lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "48px 20px 64px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
          color: "var(--muted)",
          fontSize: "0.9rem",
        }}
      >
        <span>{user?.email}</span>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            style={{
              border: "1px solid var(--line)",
              borderRadius: 999,
              padding: "6px 12px",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </form>
      </div>
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: "2rem",
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        Stock Price Chart
      </h1>
      <p style={{ margin: "0 0 28px", color: "var(--muted)", fontSize: "1.05rem" }}>
        Search any stock and get full analysis
      </p>
      <StockExplorer />
    </main>
  );
}
