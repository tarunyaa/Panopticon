import { useState } from "react";
import type { GateRequestedEvent } from "../types/events";
import { API_BASE } from "../config";
import { wsClient } from "../ws/client";

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
      wsClient.emitGateResponse({ agentName: gate.agentName, action, note });
      onResolved();
    } catch (err) {
      console.error("Gate resolve error:", err);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="pixel-panel p-3 w-[480px] max-h-[80vh] flex flex-col gap-1.5 overflow-hidden">
        <div className="flex items-center justify-between">
          <h3 className="font-pixel text-[9px] text-ink tracking-widest uppercase">
            Checkpoint
          </h3>
          <span className="font-pixel text-[7px] text-wood">{gate.agentName}</span>
        </div>

        <p className="font-pixel text-[8px] text-wood-dark leading-tight">
          {gate.question}
          {gate.reason && (
            <span className="text-accent-blue ml-1">({gate.reason})</span>
          )}
        </p>

        {gate.context && (
          <div className="pixel-inset px-2 py-1.5 flex-1 min-h-0 overflow-y-scroll overflow-x-hidden">
            <pre className="font-mono text-[10px] text-wood-dark whitespace-pre-wrap break-words leading-tight m-0">{gate.context}</pre>
          </div>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional feedback..."
          rows={1}
          className="pixel-inset px-2 py-1.5 font-pixel text-[8px] text-ink w-full outline-none resize-none shrink-0"
        />

        <div className="flex gap-2 shrink-0">
          <button
            className="pixel-btn font-pixel text-[8px] px-3 py-1.5 text-accent-coral flex-1"
            disabled={submitting}
            onClick={() => submit("reject")}
          >
            Reject
          </button>
          <button
            className="pixel-btn font-pixel text-[8px] px-3 py-1.5 text-ink flex-1"
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
