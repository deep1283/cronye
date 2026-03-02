import { ImageResponse } from "next/og";

export const alt = "Cronye local-first cron automation";
export const size = {
  width: 1200,
  height: 630
};
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
          justifyContent: "space-between",
          backgroundColor: "#f7f3eb",
          backgroundImage: "radial-gradient(circle at 84% 10%, #ffd6b5 0%, transparent 35%)",
          padding: "64px",
          color: "#1f1b17",
          fontFamily: "Georgia, serif"
        }}
      >
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 24,
            color: "#5f5448"
          }}
        >
          Cronye
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 72, lineHeight: 1.05, maxWidth: 900 }}>
            Reliable automations on your own machine.
          </div>
          <div
            style={{
              fontSize: 34,
              color: "#5f5448",
              fontFamily: "sans-serif"
            }}
          >
            Local-first cron jobs. Shell + webhook. Free and open source.
          </div>
        </div>
      </div>
    ),
    size
  );
}
