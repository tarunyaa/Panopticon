import { useRef, useEffect } from "react";
import { createGame } from "./phaser/game";
import { Sidebar } from "./components/Sidebar";

export default function App() {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameRef.current && !gameInstance.current) {
      gameInstance.current = createGame(gameRef.current);
    }
    return () => {
      gameInstance.current?.destroy(true);
      gameInstance.current = null;
    };
  }, []);

  return (
    <div className="h-screen w-screen flex bg-floor overflow-hidden">
      {/* Game area — ref div fills the space so Phaser RESIZE mode tracks it */}
      <div ref={gameRef} className="flex-1 min-w-0 pixelated" />
      {/* Sidebar */}
      <Sidebar />
    </div>
  );
}
