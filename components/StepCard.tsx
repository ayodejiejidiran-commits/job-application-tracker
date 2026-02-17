import React from "react";

type StepCardProps = {
  step: number;
  title: string;
  children: React.ReactNode;
  subtitle?: string;
};

export function StepCard({ step, title, subtitle, children }: StepCardProps) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "var(--brand)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 700
          }}
        >
          {step}
        </div>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {subtitle ? (
            <p className="small" style={{ margin: 0 }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
