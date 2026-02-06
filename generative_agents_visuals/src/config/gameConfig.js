/* global Phaser */
import VillageScene from "../scenes/VillageScene.js";

const gameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: "game-container",
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 }
    }
  },
  scene: [VillageScene]
};

export default gameConfig;
