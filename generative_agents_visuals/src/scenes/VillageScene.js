/* global Phaser */
export default class VillageScene extends Phaser.Scene {
  constructor() {
    super("VillageScene");
    this.player = null;
    this.cursors = null;
  }

  preload() {
    this.load.tilemapTiledJSON(
      "village",
      "assets/maps/the_ville_jan7.json"
    );

    this.load.image(
      "blocks_1",
      "assets/maps/map_assets/blocks/blocks_1.png"
    );
    this.load.image(
      "blocks_2",
      "assets/maps/map_assets/blocks/blocks_2.png"
    );
    this.load.image(
      "blocks_3",
      "assets/maps/map_assets/blocks/blocks_3.png"
    );

    this.load.image(
      "Room_Builder_32x32",
      "assets/maps/map_assets/v1/Room_Builder_32x32.png"
    );
    this.load.image(
      "interiors_pt1",
      "assets/maps/map_assets/v1/interiors_pt1.png"
    );
    this.load.image(
      "interiors_pt2",
      "assets/maps/map_assets/v1/interiors_pt2.png"
    );
    this.load.image(
      "interiors_pt3",
      "assets/maps/map_assets/v1/interiors_pt3.png"
    );
    this.load.image(
      "interiors_pt4",
      "assets/maps/map_assets/v1/interiors_pt4.png"
    );
    this.load.image(
      "interiors_pt5",
      "assets/maps/map_assets/v1/interiors_pt5.png"
    );

    this.load.image(
      "CuteRPG_Field_B",
      "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_B.png"
    );
    this.load.image(
      "CuteRPG_Field_C",
      "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_C.png"
    );
    this.load.image(
      "CuteRPG_Harbor_C",
      "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Harbor_C.png"
    );
    this.load.image(
      "CuteRPG_Village_B",
      "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Village_B.png"
    );
    this.load.image(
      "CuteRPG_Forest_B",
      "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_B.png"
    );
    this.load.image(
      "CuteRPG_Desert_C",
      "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_C.png"
    );
    this.load.image(
      "CuteRPG_Mountains_B",
      "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Mountains_B.png"
    );
    this.load.image(
      "CuteRPG_Desert_B",
      "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_B.png"
    );
    this.load.image(
      "CuteRPG_Forest_C",
      "assets/maps/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_C.png"
    );

    this.load.atlas(
      "avatar",
      "assets/sprites/atlas.png",
      "assets/sprites/atlas.json"
    );
  }

  create() {
    const map = this.make.tilemap({ key: "village" });

    const collisions = map.addTilesetImage("blocks", "blocks_1");
    const walls = map.addTilesetImage("Room_Builder_32x32", "Room_Builder_32x32");
    const interiorsPt1 = map.addTilesetImage("interiors_pt1", "interiors_pt1");
    const interiorsPt2 = map.addTilesetImage("interiors_pt2", "interiors_pt2");
    const interiorsPt3 = map.addTilesetImage("interiors_pt3", "interiors_pt3");
    const interiorsPt4 = map.addTilesetImage("interiors_pt4", "interiors_pt4");
    const interiorsPt5 = map.addTilesetImage("interiors_pt5", "interiors_pt5");
    const fieldB = map.addTilesetImage("CuteRPG_Field_B", "CuteRPG_Field_B");
    const fieldC = map.addTilesetImage("CuteRPG_Field_C", "CuteRPG_Field_C");
    const harborC = map.addTilesetImage("CuteRPG_Harbor_C", "CuteRPG_Harbor_C");
    const villageB = map.addTilesetImage("CuteRPG_Village_B", "CuteRPG_Village_B");
    const forestB = map.addTilesetImage("CuteRPG_Forest_B", "CuteRPG_Forest_B");
    const desertC = map.addTilesetImage("CuteRPG_Desert_C", "CuteRPG_Desert_C");
    const mountainsB = map.addTilesetImage("CuteRPG_Mountains_B", "CuteRPG_Mountains_B");
    const desertB = map.addTilesetImage("CuteRPG_Desert_B", "CuteRPG_Desert_B");
    const forestC = map.addTilesetImage("CuteRPG_Forest_C", "CuteRPG_Forest_C");

    const tilesetGroup = [
      fieldB,
      fieldC,
      harborC,
      villageB,
      forestB,
      desertC,
      mountainsB,
      desertB,
      forestC,
      interiorsPt1,
      interiorsPt2,
      interiorsPt3,
      interiorsPt4,
      interiorsPt5,
      walls
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
    foregroundL1.setDepth(2);
    foregroundL2.setDepth(2);

    const collisionsLayer = map.createLayer("Collisions", collisions, 0, 0);
    collisionsLayer.setCollisionByProperty({ collide: true });
    collisionsLayer.setDepth(-1);

    this.player = this.physics.add
      .sprite(800, 288, "avatar", "down")
      .setSize(28, 28)
      .setOffset(2, 2);

    const camera = this.cameras.main;
    camera.startFollow(this.player);
    camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.cursors = this.input.keyboard.createCursorKeys();

    this.anims.create({
      key: "walk-left",
      frames: this.anims.generateFrameNames("avatar", {
        prefix: "left-walk.",
        start: 0,
        end: 3,
        zeroPad: 3
      }),
      frameRate: 6,
      repeat: -1
    });
    this.anims.create({
      key: "walk-right",
      frames: this.anims.generateFrameNames("avatar", {
        prefix: "right-walk.",
        start: 0,
        end: 3,
        zeroPad: 3
      }),
      frameRate: 6,
      repeat: -1
    });
    this.anims.create({
      key: "walk-up",
      frames: this.anims.generateFrameNames("avatar", {
        prefix: "up-walk.",
        start: 0,
        end: 3,
        zeroPad: 3
      }),
      frameRate: 6,
      repeat: -1
    });
    this.anims.create({
      key: "walk-down",
      frames: this.anims.generateFrameNames("avatar", {
        prefix: "down-walk.",
        start: 0,
        end: 3,
        zeroPad: 3
      }),
      frameRate: 6,
      repeat: -1
    });
  }

  update() {
    const speed = 200;
    const body = this.player.body;

    body.setVelocity(0);

    if (this.cursors.left.isDown) {
      body.setVelocityX(-speed);
      this.player.anims.play("walk-left", true);
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(speed);
      this.player.anims.play("walk-right", true);
    } else if (this.cursors.up.isDown) {
      body.setVelocityY(-speed);
      this.player.anims.play("walk-up", true);
    } else if (this.cursors.down.isDown) {
      body.setVelocityY(speed);
      this.player.anims.play("walk-down", true);
    } else {
      this.player.anims.stop();
      if (this.player.texture.key === "avatar") {
        this.player.setTexture("avatar", "down");
      }
    }
  }
}
