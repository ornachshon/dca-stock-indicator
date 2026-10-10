import { StockExplorer } from "../components/StockExplorer";

export default function Home() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "48px 20px 64px",
      }}
    >
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
