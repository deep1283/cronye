export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                ink: "#151a20",
                mist: "#eff4f8",
                panel: "#ffffff",
                slate: "#5e6a76",
                edge: "#cfd9e2",
                accent: "#0f7b70",
                accentStrong: "#085f56",
                danger: "#9c2f2f"
            },
            boxShadow: {
                card: "0 12px 30px rgba(15, 43, 59, 0.08)"
            },
            fontFamily: {
                sans: ["Space Grotesk", "IBM Plex Sans", "Segoe UI", "sans-serif"],
                display: ["Fraunces", "Iowan Old Style", "serif"]
            }
        }
    },
    plugins: []
};
