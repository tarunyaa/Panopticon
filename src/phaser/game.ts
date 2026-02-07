import Phaser from "phaser";
import { VillageScene } from "./scenes/VillageScene";

let gameInstance: Phaser.Game | null = null;

export function createGame(
  parent: HTMLElement,
  sceneData?: Record<string, unknown>,
): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth,
      height: parent.clientHeight,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 } },
    },
    scene: [VillageScene],
  });

  if (sceneData) {
    for (const [key, value] of Object.entries(sceneData)) {
      game.registry.set(key, value);
    }
  }

  gameInstance = game;
  return game;
}

export function getGame(): Phaser.Game | null {
  return gameInstance;
}
