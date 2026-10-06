import { ImageResponse } from "next/og";

// The card WhatsApp and other apps show when someone pastes a link to the
// app. Drawn once at build time.

export const alt = "Hormuud Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#171717",
        }}
      >
        {/* The graduation cap from icon.svg. */}
        <svg width="160" height="160" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="7" fill="#171717" />
          <g
            transform="translate(4 4)"
            fill="none"
            stroke="#fafafa"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
            <path d="M22 10v6" />
            <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
          </g>
        </svg>
        <div style={{ marginTop: 48, fontSize: 76 }}>Hormuud Academy</div>
        <div style={{ marginTop: 16, fontSize: 34, color: "#737373" }}>
          Student registration and skills for every branch
        </div>
      </div>
    ),
    size,
  );
}
