import { useEffect, useRef, useState } from "react";
import { wsClient } from "../../ws/client";
import type { WSEvent } from "../../types/events";

export function OutputLog() {
  const [finalOutput, setFinalOutput] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (ev: WSEvent) => {
      if (ev.type === "RUN_STARTED") {
        setFinalOutput(null);
        return;
      }
      if (ev.type === "FINAL_OUTPUT") {
        setFinalOutput(ev.output);
      }
    };
    wsClient.on("event", handler);
    return () => wsClient.off("event", handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [finalOutput]);

  return (
    <div className="flex flex-col">
      <div className="px-3 pt-2 pb-1">
        <span className="text-[8px] text-wood uppercase tracking-widest">
          Final Output
        </span>
      </div>
      <div className="overflow-y-auto max-h-[300px] px-3 pb-2">
        {!finalOutput && (
          <div className="text-[8px] text-wood-light italic py-1">
            No output yet
          </div>
        )}
        {finalOutput && (
          <div className="bg-parchment-light/50 border border-text-dark/[0.06] rounded px-3 py-2 text-[8px]">
            <pre className="text-wood-dark whitespace-pre-wrap break-words leading-snug">
              {finalOutput}
            </pre>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
