import { useState } from "react";
import { wsClient } from "../ws/client";

export function TaskInput() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    const text = prompt.trim();
    if (!text || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      wsClient.connect(data.runId);
      setPrompt("");
    } catch (err) {
      const msg =
        err instanceof TypeError
          ? "Backend offline"
          : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-3 py-2">
      <div className="text-[8px] text-wood uppercase tracking-widest mb-1.5">
        Task
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleRun();
          }
        }}
        placeholder="Describe task..."
        rows={2}
        className="pixel-inset w-full px-2 py-1.5 text-[9px] text-ink resize-none placeholder:text-wood-light font-pixel focus:outline-none"
      />
      <button
        onClick={handleRun}
        disabled={loading || !prompt.trim()}
        className="pixel-btn w-full mt-1.5 py-1 text-[9px] text-ink font-pixel uppercase tracking-widest"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-1.5">
            <span className="inline-block w-2 h-2 border-2 border-wood-light border-t-wood-dark animate-spin" />
            Running
          </span>
        ) : (
          "Run Task"
        )}
      </button>
      {error && (
        <div className="pixel-inset mt-1.5 px-2 py-1 text-[8px] text-accent-coral bg-accent-coral/10">
          ! {error}
        </div>
      )}
    </div>
  );
}
