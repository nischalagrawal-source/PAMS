"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
              Something went wrong
            </h2>
            <p style={{ color: "#666", marginBottom: "1.5rem" }}>
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
