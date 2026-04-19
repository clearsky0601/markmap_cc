import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [greeting, setGreeting] = useState<string>("…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<string>("greet", { name: "tommy" })
      .then((msg) => {
        setGreeting(msg);
        console.log("[ipc] greet →", msg);
      })
      .catch((e) => {
        setError(String(e));
        console.error("[ipc] greet failed", e);
      });
  }, []);

  return (
    <main className="phase-a">
      <h1>markmap_cc</h1>
      <p className="tagline">Phase A · skeleton</p>
      <section className="ipc-card">
        <h2>IPC roundtrip</h2>
        {error ? (
          <pre className="error">{error}</pre>
        ) : (
          <pre className="ok">{greeting}</pre>
        )}
      </section>
    </main>
  );
}

export default App;
