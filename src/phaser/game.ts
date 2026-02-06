import Phaser from "phaser";
import { VillageScene } from "./scenes/VillageScene";

export function createGame(parent: HTMLElement): Phaser.Game {
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
  return game;
}
