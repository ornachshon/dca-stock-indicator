import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Price Chart",
  description: "Search a stock and view the last year of prices",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
