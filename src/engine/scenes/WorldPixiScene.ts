import { Container } from 'pixi.js';
import { BaseScene } from './BaseScene';
import type { GameBridge } from '../GameBridge';
import type { WorldState } from '../../types';
import { buildings, worldNPCs } from '../../data/mockData';
import { BuildingSprite } from '../sprites/BuildingSprite';
import { PropSprite } from '../sprites/PropSprite';
import type { CharacterSprite } from '../sprites/CharacterSprite';
import { createCharacter } from '../sprites/CharacterFactory';
import { AmbientEffects } from '../effects/AmbientEffects';
import { TilemapLayer } from '../tiles/TilemapLayer';
import { buildWorldLayout, WORLD_HEIGHT, WORLD_TILE_SIZE, WORLD_WIDTH } from '../../data/worldLayout';

const WORLD_LAYOUT = buildWorldLayout();

// Tree positions
const TREES = [
  { x: 80, y: 140, size: 'tree_small' as const },
  { x: 120, y: 470, size: 'tree_medium' as const },
  { x: 760, y: 150, size: 'tree_large' as const },
  { x: 740, y: 480, size: 'tree_medium' as const },
  { x: 340, y: 520, size: 'tree_small' as const },
  { x: 560, y: 110, size: 'tree_small' as const },
];

const WORLD_PROPS = [
  { x: 210, y: 250, type: 'bench' as const },
  { x: 80, y: 250, type: 'lamp' as const },
  { x: 140, y: 420, type: 'lamp' as const },
  { x: 160, y: 440, type: 'fence' as const },
  { x: 192, y: 440, type: 'fence' as const },
  { x: 230, y: 440, type: 'fence' as const },
  { x: 170, y: 460, type: 'fence' as const },
  { x: 210, y: 460, type: 'fence' as const },
  { x: 250, y: 460, type: 'fence' as const },
  { x: 130, y: 380, type: 'fountain' as const },
  { x: 300, y: 300, type: 'bush_1' as const },
  { x: 340, y: 320, type: 'bush_2' as const },
  { x: 610, y: 260, type: 'bush_1' as const },
  { x: 650, y: 240, type: 'bush_2' as const },
  { x: 420, y: 340, type: 'flowers_patch' as const },
  { x: 460, y: 360, type: 'flowers_patch' as const },
];

export class WorldPixiScene extends BaseScene {
  private groundLayer = new Container();
  private pathLayer = new Container();
  private entityLayer = new Container();
  private effectsLayer = new Container();
  private ambientEffects: AmbientEffects | null = null;
  private characters: Map<string, CharacterSprite> = new Map();
  private playerSprite: CharacterSprite | null = null;
  private unsubPlayerMove: (() => void) | null = null;

  constructor(bridge: GameBridge) {
    super(bridge);
  }

  async setup(): Promise<void> {
    this.container.addChild(this.groundLayer);
    this.container.addChild(this.pathLayer);
    this.container.addChild(this.entityLayer);
    this.container.addChild(this.effectsLayer);

    // Ground tiles
    const ground = new TilemapLayer(WORLD_LAYOUT, WORLD_TILE_SIZE);
    this.groundLayer.addChild(ground);

    // Trees
    for (const tree of TREES) {
      const prop = new PropSprite(tree.size);
      prop.x = tree.x;
      prop.y = tree.y;
      this.entityLayer.addChild(prop);
    }

    // World props
    for (const propData of WORLD_PROPS) {
      const prop = new PropSprite(propData.type);
      prop.x = propData.x;
      prop.y = propData.y;
      this.entityLayer.addChild(prop);
    }

    // Buildings
    for (const building of buildings) {
      const sprite = new BuildingSprite(building.type);
      sprite.x = building.position.x;
      sprite.y = building.position.y;
      sprite.on('pointerdown', () => {
        this.bridge.emit('entityClicked', { id: building.id, entityType: 'building' });
      });
      this.entityLayer.addChild(sprite);
    }

    // World NPCs
    for (const npc of worldNPCs) {
      const sprite = createCharacter(npc.id, { scale: 1.2 });
      sprite.x = npc.position.x;
      sprite.y = npc.position.y;
      sprite.setStatus(npc.status);
      this.entityLayer.addChild(sprite);
      this.characters.set(npc.id, sprite);
    }

    // Ambient effects (clouds)
    this.ambientEffects = new AmbientEffects(this.effectsLayer, WORLD_WIDTH, WORLD_HEIGHT);

    // Listen for player teleport
    this.unsubPlayerMove = this.bridge.on('playerMoved', (pos) => {
      if (this.playerSprite) {
        this.playerSprite.x = pos.x;
        this.playerSprite.y = pos.y;
      }
    });
  }

  update(dt: number): void {
    // Y-sort entity layer
    this.entityLayer.children.sort((a, b) => a.y - b.y);

    // Update character animations
    for (const char of this.characters.values()) {
      char.updateAnimation(dt);
    }
    this.playerSprite?.updateAnimation(dt);

    // Update ambient effects
    this.ambientEffects?.update(dt);
  }

  syncState(state: WorldState): void {
    // Create/update player sprite
    if (state.user && !this.playerSprite) {
      this.playerSprite = createCharacter(`user-${state.user.email}`, { scale: 1.8 });
      this.playerSprite.x = 400;
      this.playerSprite.y = 320;
      this.entityLayer.addChild(this.playerSprite);
    }
  }

  getSceneSize(): { width: number; height: number } {
    return { width: WORLD_WIDTH, height: WORLD_HEIGHT };
  }

  override teardown(): void {
    this.unsubPlayerMove?.();
    this.characters.clear();
    this.playerSprite = null;
    super.teardown();
  }
}
