import { useState } from "react";
import type { GateRequestedEvent } from "../types/events";
import { API_BASE } from "../config";

interface GateModalProps {
  gate: GateRequestedEvent;
  onResolved: () => void;
}

export function GateModal({ gate, onResolved }: GateModalProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (action: "approve" | "reject") => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/runs/${gate.runId}/gates/${gate.gateId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, note }),
        },
      );
      if (!res.ok) {
        console.error("Gate resolve failed:", await res.text());
      }
      onResolved();
    } catch (err) {
      console.error("Gate resolve error:", err);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="pixel-panel p-6 w-[400px] flex flex-col gap-3">
        <h3 className="font-pixel text-[10px] text-ink tracking-widest uppercase text-center">
          Checkpoint
        </h3>

        <div className="flex items-center gap-2">
          <span className="font-pixel text-[9px] text-ink font-bold">
            {gate.agentName}
          </span>
          <span className="font-pixel text-[8px] text-wood">
            finished their task
          </span>
        </div>

        <p className="font-pixel text-[8px] text-wood-dark leading-snug">
          {gate.question}
        </p>

        {gate.context && (
          <div className="pixel-inset px-3 py-2 max-h-24 overflow-y-auto">
            <span className="font-pixel text-[7px] text-wood-dark break-words">
              {gate.context}
            </span>
          </div>
        )}

        <label className="font-pixel text-[8px] text-wood uppercase">
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add feedback for the next task..."
          rows={2}
          className="pixel-inset px-3 py-2 font-pixel text-[10px] text-ink w-full outline-none resize-none"
        />

        <div className="flex gap-2 mt-2">
          <button
            className="pixel-btn font-pixel text-[10px] px-4 py-2 text-accent-coral flex-1"
            disabled={submitting}
            onClick={() => submit("reject")}
          >
            Reject
          </button>
          <button
            className="pixel-btn font-pixel text-[10px] px-4 py-2 text-ink flex-1"
            disabled={submitting}
            onClick={() => submit("approve")}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
