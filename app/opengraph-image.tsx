import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FinCrime Control Lab: Financial crime, controlled.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#0b0f1a",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "80px 88px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(18,160,106,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(18,160,106,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Accent glow */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 480,
          height: 480,
          background: "radial-gradient(circle, rgba(18,160,106,0.18) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />

      {/* Eyebrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 36,
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#12a06a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <span
          style={{
            color: "#36efa3",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}
        >
          FinCrime Control Lab
        </span>
      </div>

      {/* Headline */}
      <div
        style={{
          fontSize: 68,
          fontWeight: 900,
          color: "#ffffff",
          lineHeight: 1.05,
          marginBottom: 28,
          letterSpacing: "-0.02em",
        }}
      >
        Financial crime,
        <br />
        <span style={{ color: "#36efa3" }}>controlled.</span>
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 22,
          color: "rgba(255,255,255,0.55)",
          maxWidth: 680,
          lineHeight: 1.5,
          marginBottom: 52,
        }}
      >
        Free tools for AML professionals: typology mapping, control design, enforcement intelligence.
      </div>

      {/* Stat pills */}
      <div style={{ display: "flex", gap: 12 }}>
        {["44 FCA cases", "34 typologies", "41 controls"].map((label) => (
          <div
            key={label}
            style={{
              background: "rgba(18,160,106,0.12)",
              color: "#36efa3",
              borderRadius: 999,
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 600,
              border: "1px solid rgba(18,160,106,0.35)",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Domain */}
      <div
        style={{
          position: "absolute",
          bottom: 56,
          right: 88,
          fontSize: 14,
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.05em",
        }}
      >
        fincrime.memaconsultants.com
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
