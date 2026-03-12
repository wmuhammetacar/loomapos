import type { ReactNode } from "react";

export function StatCard(props: { title: string; value: ReactNode; subtitle?: string }) {
  return (
    <article
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        background: "#ffffff"
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{props.title}</p>
      <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 600, color: "#0f172a" }}>
        {props.value}
      </p>
      {props.subtitle ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b" }}>{props.subtitle}</p>
      ) : null}
    </article>
  );
}
