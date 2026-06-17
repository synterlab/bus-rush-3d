export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <iframe
      src={`${base}/game.html`}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none" }}
      title="Bus Rush 3D"
      allow="autoplay"
    />
  );
}
