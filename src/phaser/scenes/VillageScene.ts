import Phaser from "phaser";
import { AgentRegistry } from "../registry/AgentRegistry";
import { updateMovement } from "../systems/movement";
import { wsClient } from "../../ws/client";
import type { AgentIntentEvent, WSEvent, ZoneId } from "../../types/events";

export class VillageScene extends Phaser.Scene {
  agentRegistry!: AgentRegistry;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super("VillageScene");
  }

  preload(): void {
    // Tilemap
    this.load.tilemapTiledJSON("village", "assets/maps/the_ville_jan7.json");

    // Collision blocks
    this.load.image("blocks_1", "assets/maps/map_assets/blocks/blocks_1.png");
    this.load.image("blocks_2", "assets/maps/map_assets/blocks/blocks_2.png");
    this.load.image("blocks_3", "assets/maps/map_assets/blocks/blocks_3.png");

    // Interior tilesets
    this.load.image("Room_Builder_32x32", "assets/maps/map_assets/v1/Room_Builder_32x32.png");
    this.load.image("interiors_pt1", "assets/maps/map_assets/v1/interiors_pt1.png");
    this.load.image("interiors_pt2", "assets/maps/map_assets/v1/interiors_pt2.png");
    this.load.image("interiors_pt3", "assets/maps/map_assets/v1/interiors_pt3.png");
    this.load.image("interiors_pt4", "assets/maps/map_assets/v1/interiors_pt4.png");
    this.load.image("interiors_pt5", "assets/maps/map_assets/v1/interiors_pt5.png");

    // CuteRPG tilesets
    this.load.image("CuteRPG_Field_B", "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_B.png");
    this.load.image("CuteRPG_Field_C", "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_C.png");
    this.load.image("CuteRPG_Harbor_C", "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Harbor_C.png");
    this.load.image("CuteRPG_Village_B", "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Village_B.png");
    this.load.image("CuteRPG_Forest_B", "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_B.png");
    this.load.image("CuteRPG_Desert_C", "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_C.png");
    this.load.image("CuteRPG_Mountains_B", "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Mountains_B.png");
    this.load.image("CuteRPG_Desert_B", "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_B.png");
    this.load.image("CuteRPG_Forest_C", "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_C.png");

    // Character spritesheets (one per agent)
    AgentRegistry.preload(this);
  }

  create(): void {
    const map = this.make.tilemap({ key: "village" });

    const collisions = map.addTilesetImage("blocks", "blocks_1")!;
    const walls = map.addTilesetImage("Room_Builder_32x32", "Room_Builder_32x32")!;
    const interiorsPt1 = map.addTilesetImage("interiors_pt1", "interiors_pt1")!;
    const interiorsPt2 = map.addTilesetImage("interiors_pt2", "interiors_pt2")!;
    const interiorsPt3 = map.addTilesetImage("interiors_pt3", "interiors_pt3")!;
    const interiorsPt4 = map.addTilesetImage("interiors_pt4", "interiors_pt4")!;
    const interiorsPt5 = map.addTilesetImage("interiors_pt5", "interiors_pt5")!;
    const fieldB = map.addTilesetImage("CuteRPG_Field_B", "CuteRPG_Field_B")!;
    const fieldC = map.addTilesetImage("CuteRPG_Field_C", "CuteRPG_Field_C")!;
    const harborC = map.addTilesetImage("CuteRPG_Harbor_C", "CuteRPG_Harbor_C")!;
    const villageB = map.addTilesetImage("CuteRPG_Village_B", "CuteRPG_Village_B")!;
    const forestB = map.addTilesetImage("CuteRPG_Forest_B", "CuteRPG_Forest_B")!;
    const desertC = map.addTilesetImage("CuteRPG_Desert_C", "CuteRPG_Desert_C")!;
    const mountainsB = map.addTilesetImage("CuteRPG_Mountains_B", "CuteRPG_Mountains_B")!;
    const desertB = map.addTilesetImage("CuteRPG_Desert_B", "CuteRPG_Desert_B")!;
    const forestC = map.addTilesetImage("CuteRPG_Forest_C", "CuteRPG_Forest_C")!;

    const tilesetGroup = [
      fieldB, fieldC, harborC, villageB, forestB, desertC,
      mountainsB, desertB, forestC,
      interiorsPt1, interiorsPt2, interiorsPt3, interiorsPt4, interiorsPt5,
      walls,
    ];

    map.createLayer("Bottom Ground", tilesetGroup, 0, 0);
    map.createLayer("Exterior Ground", tilesetGroup, 0, 0);
    map.createLayer("Exterior Decoration L1", tilesetGroup, 0, 0);
    map.createLayer("Exterior Decoration L2", tilesetGroup, 0, 0);
    map.createLayer("Interior Ground", tilesetGroup, 0, 0);
    map.createLayer("Wall", [fieldC, walls], 0, 0);
    map.createLayer("Interior Furniture L1", tilesetGroup, 0, 0);
    map.createLayer("Interior Furniture L2 ", tilesetGroup, 0, 0);

    const foregroundL1 = map.createLayer("Foreground L1", tilesetGroup, 0, 0);
    const foregroundL2 = map.createLayer("Foreground L2", tilesetGroup, 0, 0);
    foregroundL1?.setDepth(2);
    foregroundL2?.setDepth(2);

    const collisionsLayer = map.createLayer("Collisions", collisions, 0, 0);
    collisionsLayer?.setCollisionByProperty({ collide: true });
    collisionsLayer?.setDepth(-1);

    // Spawn agents (also creates per-character animations)
    this.agentRegistry = new AgentRegistry(this);
    this.agentRegistry.spawn("PARK");

    // Idle bob is handled inside updateMovement() via a sine offset
    // so it doesn't conflict with physics-driven Y positioning.

    // Camera setup — center on PARK zone where agents spawn
    const camera = this.cameras.main;
    camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    camera.setZoom(0.5);
    camera.centerOn(2912, 1056);

    // Zoom controls: - to zoom out, = to zoom in
    this.input.keyboard!.on("keydown-MINUS", () => {
      camera.setZoom(Math.max(0.25, camera.zoom - 0.1));
    });
    this.input.keyboard!.on("keydown-PLUS", () => {
      camera.setZoom(Math.min(2, camera.zoom + 0.1));
    });
    this.input.keyboard!.on("keydown-EQUAL", () => {
      camera.setZoom(Math.min(2, camera.zoom + 0.1));
    });

    // Listen for agent intent events → move sprite + set progress
    const intentHandler = (ev: AgentIntentEvent) => {
      this.agentRegistry.setTarget(ev.agentName, ev.zone as ZoneId);
      this.agentRegistry.setProgress(ev.agentName, 0.15);
    };
    wsClient.on("intent", intentHandler);

    // Listen for all events → update progress on task completion
    const eventHandler = (ev: WSEvent) => {
      if (ev.type === "TASK_SUMMARY") {
        this.agentRegistry.setProgress(ev.agentName, 1);
      }
    };
    wsClient.on("event", eventHandler);

    this.cursors = this.input.keyboard!.createCursorKeys();

    // Stop Phaser from calling preventDefault on key events
    // so that typing in HTML inputs/textareas works (e.g. spacebar)
    this.input.keyboard!.disableGlobalCapture();

    this.events.on("shutdown", () => {
      wsClient.off("intent", intentHandler);
      wsClient.off("event", eventHandler);
    });
  }

  update(): void {
    updateMovement(this.agentRegistry);
    this.agentRegistry.tickProgress();

    // Arrow-key panning
    const panSpeed = 8;
    if (this.cursors.left.isDown) {
      this.cameras.main.scrollX -= panSpeed;
    } else if (this.cursors.right.isDown) {
      this.cameras.main.scrollX += panSpeed;
    }
    if (this.cursors.up.isDown) {
      this.cameras.main.scrollY -= panSpeed;
    } else if (this.cursors.down.isDown) {
      this.cameras.main.scrollY += panSpeed;
    }
  }
}
