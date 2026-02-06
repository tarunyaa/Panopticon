import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene } from './BaseScene';
import type { GameBridge } from '../GameBridge';
import type { WorldState } from '../../types';
import { getBuilding, getRoom } from '../../data/mockData';
import { createCharacter } from '../sprites/CharacterFactory';
import { CharacterSprite } from '../sprites/CharacterSprite';
import { PropSprite } from '../sprites/PropSprite';
import { TilemapLayer } from '../tiles/TilemapLayer';
import type { TileId } from '../assets/PixelTextures';

// Building themes
const BUILDING_THEMES: Record<string, { wall: number; floor: number; accent: number }> = {
  hub:        { wall: 0xF0D8B0, floor: 0xF0E8D8, accent: 0xFF9060 },
  workshop:   { wall: 0xC0D0E0, floor: 0xE0E8F0, accent: 0x5088C0 },
  library:    { wall: 0xD8C8E8, floor: 0xF0E8F8, accent: 0xA070C0 },
  cafe:       { wall: 0xF0D0C0, floor: 0xF8E8E0, accent: 0xE07050 },
  greenhouse: { wall: 0xC0D8C0, floor: 0xE0F0E0, accent: 0x60A060 },
  postoffice: { wall: 0xC0D8D8, floor: 0xE0F0F0, accent: 0x50B8B8 },
};

const BUILDING_WIDTH = 600;
const BUILDING_HEIGHT = 450;
const ROOM_WIDTH = 500;
const ROOM_HEIGHT = 400;

type InteriorMode = 'building' | 'room';

export class InteriorPixiScene extends BaseScene {
  private mode: InteriorMode;
  private targetId: string | null;
  private characters: Map<string, CharacterSprite> = new Map();
  private playerSprite: CharacterSprite | null = null;
  private entityLayer = new Container();

  constructor(bridge: GameBridge, mode: InteriorMode, targetId: string | null) {
    super(bridge);
    this.mode = mode;
    this.targetId = targetId;
  }

  async setup(): Promise<void> {
    if (this.mode === 'building') {
      this.setupBuilding();
    } else {
      this.setupRoom();
    }
  }

  private setupBuilding(): void {
    const building = this.targetId ? getBuilding(this.targetId) : null;
    if (!building) return;

    const theme = BUILDING_THEMES[building.type] ?? BUILDING_THEMES.hub;
    const w = BUILDING_WIDTH;
    const h = BUILDING_HEIGHT;

    // Floor tiles
    const floorTiles = createInteriorFloorTiles(w, h);
    const floorLayer = new TilemapLayer(floorTiles, 16);
    this.container.addChild(floorLayer);

    // Walls
    const walls = new Graphics();
    walls.rect(30, 30, w - 60, h - 60);
    walls.fill(theme.wall);
    walls.stroke({ color: 0xB0A898, width: 1 });
    this.container.addChild(walls);

    // Wall trim
    const trim = new Graphics();
    trim.rect(40, 40, w - 80, h - 80);
    trim.stroke({ color: theme.accent, alpha: 0.25, width: 1 });
    this.container.addChild(trim);

    // Central area
    const center = new Graphics();
    center.rect(w / 2 - 60, h / 2 - 40, 120, 80);
    center.fill({ color: theme.accent, alpha: 0.08 });
    this.container.addChild(center);

    // Corner plants
    const plantPositions = [
      { x: 70, y: 100 },
      { x: w - 70, y: 100 },
      { x: 70, y: h - 50 },
      { x: w - 70, y: h - 50 },
    ];
    for (const pos of plantPositions) {
      const plant = new PropSprite('tree_small');
      plant.x = pos.x;
      plant.y = pos.y;
      this.container.addChild(plant);
    }

    // Shelving + bookshelf
    const bookshelf = new PropSprite('bookshelf');
    bookshelf.x = 120;
    bookshelf.y = h - 80;
    this.container.addChild(bookshelf);

    const shelf = new PropSprite('shelf');
    shelf.x = w - 120;
    shelf.y = h - 90;
    this.container.addChild(shelf);

    // Building icon indicator
    const iconBg = new Graphics();
    iconBg.rect(w / 2 - 20, 10, 40, 28);
    iconBg.fill({ color: theme.accent, alpha: 0.2 });
    iconBg.stroke({ color: theme.accent, alpha: 0.4, width: 1 });
    this.container.addChild(iconBg);

    const iconLabel = new Text({
      text: building.type.charAt(0).toUpperCase(),
      style: new TextStyle({ fontSize: 14, fontFamily: 'system-ui', fontWeight: 'bold', fill: theme.accent }),
    });
    iconLabel.anchor.set(0.5);
    iconLabel.x = w / 2;
    iconLabel.y = 24;
    this.container.addChild(iconLabel);

    // Entity layer for depth sorting
    this.container.addChild(this.entityLayer);

    // Room doors
    const roomCount = building.rooms.length;
    const roomPositions = this.getRoomPositions(roomCount, w, h);

    building.rooms.forEach((room, index) => {
      const pos = roomPositions[index];
      if (!pos) return;

      const door = new Container();
      door.x = pos.x;
      door.y = pos.y;

      // Door frame
      const frame = new Graphics();
      frame.rect(-20, -30, 40, 40);
      frame.fill(theme.accent);
      frame.stroke({ color: 0x2b2b2b, width: 1 });
      door.addChild(frame);

      // Door panel
      const panel = new Graphics();
      panel.rect(-14, -24, 28, 28);
      panel.fill({ color: theme.accent, alpha: 0.7 });
      door.addChild(panel);

      // Character count badge
      const count = room.characters.length;
      if (count > 0) {
        const badge = new Graphics();
        badge.rect(10, -32, 14, 14);
        badge.fill(0x2b2b2b);
        door.addChild(badge);

        const countText = new Text({
          text: String(count),
          style: new TextStyle({ fontSize: 9, fill: '#ffffff', fontFamily: 'system-ui' }),
        });
        countText.anchor.set(0.5);
        countText.x = 17;
        countText.y = -25;
        door.addChild(countText);
      }

      // Hover outline
      const hoverOutline = new Graphics();
      hoverOutline.rect(-23, -33, 46, 46);
      hoverOutline.stroke({ color: 0xffd050, width: 2 });
      hoverOutline.visible = false;
      door.addChild(hoverOutline);

      door.eventMode = 'static';
      door.cursor = 'pointer';
      door.on('pointerenter', () => { hoverOutline.visible = true; });
      door.on('pointerleave', () => { hoverOutline.visible = false; });
      door.on('pointerdown', () => {
        this.bridge.emit('entityClicked', { id: room.id, entityType: 'door' });
      });

      this.entityLayer.addChild(door);
    });
  }

  private setupRoom(): void {
    const roomData = this.targetId ? getRoom(this.targetId) : null;
    if (!roomData) return;

    const { building, room } = roomData;
    const theme = BUILDING_THEMES[building.type] ?? BUILDING_THEMES.hub;
    const w = ROOM_WIDTH;
    const h = ROOM_HEIGHT;

    // Floor tiles
    const floorTiles = createInteriorFloorTiles(w, h);
    const floorLayer = new TilemapLayer(floorTiles, 16);
    this.container.addChild(floorLayer);

    // Walls
    const walls = new Graphics();
    walls.rect(25, 25, w - 50, h - 50);
    walls.fill(theme.wall);
    walls.stroke({ color: 0xB0A898, width: 1 });
    this.container.addChild(walls);

    // Wall trim
    const wallTrim = new Graphics();
    wallTrim.rect(35, 35, w - 70, h - 70);
    wallTrim.stroke({ color: theme.accent, alpha: 0.2, width: 1 });
    this.container.addChild(wallTrim);

    // Whiteboard
    const whiteboard = new PropSprite('whiteboard');
    whiteboard.x = w / 2;
    whiteboard.y = 65;
    this.container.addChild(whiteboard);

    // Entity layer for depth sorting
    this.container.addChild(this.entityLayer);

    // Desk positions
    const charCount = room.characters.length;
    const deskPositions = this.getDeskPositions(charCount, w, h);

    // Place desks and characters
    room.characters.forEach((character, i) => {
      const pos = deskPositions[i];
      if (!pos) return;

      // Desk
      const desk = new PropSprite('desk');
      desk.x = pos.x;
      desk.y = pos.y;
      this.entityLayer.addChild(desk);

      // Computer on desk
      const computer = new PropSprite('computer');
      computer.x = pos.x;
      computer.y = pos.y - 6;
      this.entityLayer.addChild(computer);

      // Character
      const sprite = createCharacter(character.id, { scale: 1.6, interactive: true });
      sprite.x = pos.x;
      sprite.y = pos.y + 35;
      sprite.setStatus(character.status);
      sprite.on('pointerdown', () => {
        this.bridge.emit('entityClicked', { id: character.id, entityType: 'character' });
      });
      this.entityLayer.addChild(sprite);
      this.characters.set(character.id, sprite);
    });

    // Activity indicator
    const isActive = room.characters.some(c => c.status === 'working');
    const indicator = new Graphics();
    indicator.rect(w - 30, 10, 6, 6);
    indicator.fill(isActive ? 0x60A060 : 0xB0A898);
    this.container.addChild(indicator);
  }

  private getRoomPositions(count: number, w: number, h: number): { x: number; y: number }[] {
    if (count === 1) return [{ x: w / 2, y: 200 }];
    if (count === 2) return [{ x: 180, y: 180 }, { x: w - 180, y: 180 }];

    const positions: { x: number; y: number }[] = [];
    const cols = Math.min(3, count);
    const rows = Math.ceil(count / cols);
    const startX = 150;
    const endX = w - 150;
    const startY = 150;
    const endY = h - 150;
    const stepX = cols > 1 ? (endX - startX) / (cols - 1) : 0;
    const stepY = rows > 1 ? (endY - startY) / (rows - 1) : 0;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({ x: startX + col * stepX, y: startY + row * stepY });
    }
    return positions;
  }

  private getDeskPositions(count: number, w: number, h: number): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    const rows = Math.ceil(count / 3);
    const startY = 130;
    const endY = h - 100;
    const rowHeight = rows > 1 ? (endY - startY) / (rows - 1) : 0;

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const colCount = Math.min(3, count - row * 3);
      const startX = (w - colCount * 130) / 2 + 65;

      positions.push({
        x: startX + col * 130,
        y: startY + row * rowHeight,
      });
    }
    return positions;
  }

  update(dt: number): void {
    // Y-sort entity layer
    this.entityLayer.children.sort((a, b) => a.y - b.y);

    // Update character animations
    for (const char of this.characters.values()) {
      char.updateAnimation(dt);
    }
    this.playerSprite?.updateAnimation(dt);
  }

  syncState(state: WorldState): void {
    // Add player sprite if user exists
    if (state.user && !this.playerSprite) {
      const w = this.mode === 'building' ? BUILDING_WIDTH : ROOM_WIDTH;
      const h = this.mode === 'building' ? BUILDING_HEIGHT : ROOM_HEIGHT;
      this.playerSprite = createCharacter(`user-${state.user.email}`, { scale: 1.8 });
      this.playerSprite.x = w / 2;
      this.playerSprite.y = h - 70;
      this.entityLayer.addChild(this.playerSprite);
    }
  }

  getSceneSize(): { width: number; height: number } {
    return this.mode === 'building'
      ? { width: BUILDING_WIDTH, height: BUILDING_HEIGHT }
      : { width: ROOM_WIDTH, height: ROOM_HEIGHT };
  }

  override teardown(): void {
    this.characters.clear();
    this.playerSprite = null;
    super.teardown();
  }
}

function createInteriorFloorTiles(width: number, height: number): TileId[][] {
  const tileSize = 16;
  const cols = Math.ceil(width / tileSize);
  const rows = Math.ceil(height / tileSize);
  const tiles: TileId[][] = [];

  for (let y = 0; y < rows; y += 1) {
    const row: TileId[] = [];
    for (let x = 0; x < cols; x += 1) {
      const alt = (x + y) % 2 === 0;
      row.push(alt ? 'floor' : 'floorAlt');
    }
    tiles.push(row);
  }

  return tiles;
}
