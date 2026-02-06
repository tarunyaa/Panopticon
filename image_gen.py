from PIL import Image, ImageDraw
import os, zipfile, random

repo_root = os.path.dirname(os.path.abspath(__file__))
base_dir = os.path.join(repo_root, "generated", "panopticon_assets")
paths = [
    "src/assets/tiles",
    "src/assets/props",
    "src/assets/buildings",
    "src/assets/characters",
    "src/assets/ui",
]
for p in paths:
    os.makedirs(os.path.join(base_dir, p), exist_ok=True)

def save(img, rel):
    out = os.path.join(base_dir, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out, "PNG")
    return out

PAL = {
    "grass1": (120, 200, 120, 255),
    "grass2": (110, 190, 110, 255),
    "tan1": (230, 215, 175, 255),
    "tan2": (220, 205, 165, 255),
    "water1": (90, 160, 220, 255),
    "water2": (80, 150, 210, 255),
    "shadow": (0, 0, 0, 40),
    "outline": (60, 60, 60, 255),
    "white": (250, 250, 250, 255),
    "yellow": (245, 220, 90, 255),
    "gray": (190, 190, 190, 255),
    "glass": (170, 210, 230, 255),
    "purple": (170, 140, 210, 255),
    "purple_dark": (120, 90, 160, 255),
    "steel": (120, 150, 190, 255),
    "steel_dark": (80, 110, 150, 255),
    "wood": (170, 130, 90, 255),
    "wood_dark": (130, 95, 65, 255),
}

def pixel_noise(draw, w, h, pct=0.06, alt=(0,0,0,0), seed=0):
    rng = random.Random(seed)
    n = int(w*h*pct)
    for _ in range(n):
        draw.point((rng.randrange(w), rng.randrange(h)), fill=alt)

def make_tile(base, alt=None, seed=0):
    img = Image.new("RGBA", (16,16), base)
    d = ImageDraw.Draw(img)
    if alt:
        pixel_noise(d, 16, 16, pct=0.10, alt=alt, seed=seed)
    d.rectangle([0,0,15,15], outline=(0,0,0,18))
    return img

# Tiles
save(make_tile(PAL["grass1"], PAL["grass2"], seed=1), "src/assets/tiles/grass_1.png")
save(make_tile(PAL["grass2"], PAL["grass1"], seed=2), "src/assets/tiles/grass_2.png")

def make_path(seed=0, cracked=False):
    img = Image.new("RGBA",(16,16), PAL["tan1"])
    d=ImageDraw.Draw(img)
    pixel_noise(d,16,16,pct=0.12, alt=PAL["tan2"], seed=seed)
    if cracked:
        rng = random.Random(seed+99)
        for _ in range(2):
            x=rng.randrange(2,14); y=rng.randrange(2,14)
            d.line([(x,y),(x+rng.randrange(-4,5), y+rng.randrange(-4,5))], fill=(120,110,90,120), width=1)
    d.rectangle([0,0,15,15], outline=(0,0,0,18))
    return img

save(make_path(seed=3,cracked=False), "src/assets/tiles/path_1.png")
save(make_path(seed=4,cracked=True), "src/assets/tiles/path_2.png")

def make_path_edge():
    img = Image.new("RGBA",(16,16), PAL["tan1"])
    d=ImageDraw.Draw(img)
    d.rectangle([0,0,5,15], fill=PAL["grass1"])
    pixel_noise(d,6,16,pct=0.12, alt=PAL["grass2"], seed=5)
    pixel_noise(d,16,16,pct=0.08, alt=PAL["tan2"], seed=6)
    d.rectangle([0,0,15,15], outline=(0,0,0,18))
    for y in range(0,16,2):
        d.point((5,y), fill=(0,0,0,20))
    return img

save(make_path_edge(), "src/assets/tiles/path_edge.png")

def make_water(seed=0):
    img = Image.new("RGBA",(16,16), PAL["water1"])
    d=ImageDraw.Draw(img)
    pixel_noise(d,16,16,pct=0.10, alt=PAL["water2"], seed=seed)
    for x in range(2,14,3):
        d.point((x,4), fill=(255,255,255,60))
        d.point((x+1,5), fill=(255,255,255,45))
    d.rectangle([0,0,15,15], outline=(0,0,0,18))
    return img

save(make_water(seed=7), "src/assets/tiles/water_1.png")

def make_flower_tile(color_main, seed=0):
    img = make_tile(PAL["grass1"], PAL["grass2"], seed=seed)
    d=ImageDraw.Draw(img)
    rng=random.Random(seed)
    for _ in range(4):
        x=rng.randrange(2,14); y=rng.randrange(2,14)
        d.point((x,y), fill=color_main)
        d.point((min(15,x+1),y), fill=(255,255,255,120))
    return img

save(make_flower_tile(PAL["yellow"], seed=11), "src/assets/tiles/flower_1.png")
save(make_flower_tile(PAL["white"], seed=12), "src/assets/tiles/flower_2.png")

# Helpers
def outline_rect(d, xy, fill, outline=PAL["outline"]):
    d.rectangle(xy, fill=fill, outline=outline)

# Props: trees/bushes etc.
def make_tree(w,h, trunk_h, crown, seed=0):
    img=Image.new("RGBA",(w,h),(0,0,0,0))
    d=ImageDraw.Draw(img)
    d.ellipse([w//2-10, h-10, w//2+10, h-2], fill=PAL["shadow"])
    trunk_w=max(6,w//6)
    tx0=w//2-trunk_w//2
    outline_rect(d,[tx0,h-trunk_h,tx0+trunk_w,h-10], fill=PAL["wood_dark"])
    rng=random.Random(seed)
    for _ in range(10):
        cx=rng.randrange(8,w-8); cy=rng.randrange(6,h-trunk_h-4); r=rng.randrange(8,14)
        d.ellipse([cx-r,cy-r,cx+r,cy+r], fill=crown)
    d.rectangle([1,1,w-2,h-12], outline=(0,0,0,20))
    return img

save(make_tree(32,48,18,(110,180,120,255),1), "src/assets/props/tree_small.png")
save(make_tree(40,56,22,(95,170,110,255),2), "src/assets/props/tree_medium.png")
save(make_tree(48,64,26,(85,160,100,255),3), "src/assets/props/tree_large.png")

def make_bush(w,h, seed=0):
    img=Image.new("RGBA",(w,h),(0,0,0,0))
    d=ImageDraw.Draw(img)
    d.ellipse([2, h//3, w-2, h-2], fill=(105,175,115,255))
    rng=random.Random(seed)
    for _ in range(25):
        d.point((rng.randrange(3,w-3), rng.randrange(h//3,h-3)), fill=(90,160,100,255))
    d.ellipse([2, h//3, w-2, h-2], outline=PAL["outline"])
    return img

save(make_bush(32,24,4), "src/assets/props/bush_1.png")
save(make_bush(40,28,5), "src/assets/props/bush_2.png")

def make_flowers_patch():
    img=Image.new("RGBA",(32,16),(0,0,0,0))
    d=ImageDraw.Draw(img)
    d.rectangle([0,8,31,15], fill=PAL["grass1"])
    pixel_noise(d,32,8,pct=0.12, alt=PAL["grass2"], seed=9)
    for x in range(2,30,5):
        d.point((x,9), fill=PAL["yellow"])
        d.point((x+2,11), fill=PAL["white"])
    d.rectangle([0,8,31,15], outline=PAL["outline"])
    return img

save(make_flowers_patch(), "src/assets/props/flowers_patch.png")

def make_bench():
    img=Image.new("RGBA",(32,16),(0,0,0,0))
    d=ImageDraw.Draw(img)
    outline_rect(d,[6,10,9,15], fill=PAL["wood_dark"])
    outline_rect(d,[22,10,25,15], fill=PAL["wood_dark"])
    outline_rect(d,[4,6,27,10], fill=PAL["wood"])
    outline_rect(d,[4,2,27,6], fill=PAL["wood"])
    return img

save(make_bench(), "src/assets/props/bench.png")

def make_lamp():
    img=Image.new("RGBA",(16,32),(0,0,0,0))
    d=ImageDraw.Draw(img)
    outline_rect(d,[7,10,9,28], fill=(110,110,120,255))
    d.ellipse([3,4,12,12], fill=(235,230,180,255), outline=PAL["outline"])
    d.ellipse([5,6,10,11], fill=(255,255,255,120))
    d.ellipse([5,27,11,31], fill=PAL["shadow"])
    return img

save(make_lamp(), "src/assets/props/lamp.png")

def make_fountain():
    img=Image.new("RGBA",(64,48),(0,0,0,0))
    d=ImageDraw.Draw(img)
    d.ellipse([10,30,54,46], fill=PAL["shadow"])
    d.ellipse([8,22,56,44], fill=PAL["gray"], outline=PAL["outline"])
    d.ellipse([14,26,50,40], fill=PAL["water1"], outline=(0,0,0,35))
    outline_rect(d,[30,14,34,24], fill=PAL["gray"])
    d.ellipse([28,10,36,18], fill=PAL["gray"], outline=PAL["outline"])
    for i in range(4):
        d.ellipse([31-i, 8-2*i, 33+i, 10-2*i], fill=(255,255,255,70))
    return img

save(make_fountain(), "src/assets/props/fountain.png")

def make_fence():
    img=Image.new("RGBA",(32,16),(0,0,0,0))
    d=ImageDraw.Draw(img)
    for x in range(2,32,6):
        outline_rect(d,[x,3,x+2,13], fill=(160,150,140,255))
    outline_rect(d,[0,6,31,8], fill=(175,165,155,255))
    outline_rect(d,[0,10,31,12], fill=(175,165,155,255))
    return img

save(make_fence(), "src/assets/props/fence.png")

# Interior props
def make_desk():
    img=Image.new("RGBA",(48,32),(0,0,0,0))
    d=ImageDraw.Draw(img)
    d.ellipse([10,24,38,31], fill=PAL["shadow"])
    outline_rect(d,[6,10,41,26], fill=PAL["wood"])
    outline_rect(d,[6,10,41,14], fill=PAL["wood_dark"])
    outline_rect(d,[10,26,14,31], fill=PAL["wood_dark"])
    outline_rect(d,[33,26,37,31], fill=PAL["wood_dark"])
    return img

save(make_desk(), "src/assets/props/desk.png")

def make_computer():
    img=Image.new("RGBA",(16,16),(0,0,0,0))
    d=ImageDraw.Draw(img)
    outline_rect(d,[2,2,13,10], fill=(40,60,80,255))
    d.rectangle([3,3,12,9], fill=(120,200,230,200))
    outline_rect(d,[6,11,10,13], fill=(90,90,90,255))
    d.rectangle([5,13,11,14], fill=(70,70,70,255))
    return img

save(make_computer(), "src/assets/props/computer.png")

def make_whiteboard():
    img=Image.new("RGBA",(64,40),(0,0,0,0))
    d=ImageDraw.Draw(img)
    outline_rect(d,[2,2,61,33], fill=(245,245,245,255))
    for x in range(8,56,10):
        d.line([(x,10),(x+6,10)], fill=(120,140,160,140), width=1)
        d.line([(x,16),(x+10,16)], fill=(120,140,160,110), width=1)
    outline_rect(d,[10,33,54,37], fill=(160,150,140,255))
    return img

save(make_whiteboard(), "src/assets/props/whiteboard.png")

def make_bookshelf():
    img=Image.new("RGBA",(48,48),(0,0,0,0))
    d=ImageDraw.Draw(img)
    outline_rect(d,[4,4,43,43], fill=(175,140,105,255))
    for y in (14,24,34):
        d.line([(6,y),(41,y)], fill=PAL["wood_dark"], width=2)
    rng=random.Random(10)
    for y0 in (6,16,26,36):
        x=7
        while x<40:
            w=rng.randrange(3,6)
            color=(rng.randrange(120,230),rng.randrange(120,230),rng.randrange(120,230),255)
            d.rectangle([x,y0,x+w,y0+6], fill=color, outline=(0,0,0,35))
            x+=w+1
    return img

save(make_bookshelf(), "src/assets/props/bookshelf.png")

def make_shelf():
    img=Image.new("RGBA",(48,32),(0,0,0,0))
    d=ImageDraw.Draw(img)
    outline_rect(d,[4,8,43,25], fill=(175,140,105,255))
    d.line([(6,16),(41,16)], fill=PAL["wood_dark"], width=2)
    d.rectangle([9,10,14,15], fill=(200,120,130,255), outline=(0,0,0,35))
    d.rectangle([16,10,22,15], fill=(120,170,220,255), outline=(0,0,0,35))
    d.rectangle([24,10,29,15], fill=(140,220,170,255), outline=(0,0,0,35))
    d.rectangle([31,10,37,15], fill=(220,210,140,255), outline=(0,0,0,35))
    return img

save(make_shelf(), "src/assets/props/shelf.png")

# Buildings
def make_building_glass():
    w=h=96
    img=Image.new("RGBA",(w,h),(0,0,0,0))
    d=ImageDraw.Draw(img)
    d.ellipse([20,80,76,94], fill=PAL["shadow"])
    outline_rect(d,[18,18,78,86], fill=PAL["glass"])
    outline_rect(d,[14,12,82,22], fill=(150,190,210,255))
    for y in range(28,80,12):
        for x in range(26,76,12):
            d.rectangle([x,y,x+8,y+8], fill=(235,245,250,180), outline=(0,0,0,25))
    outline_rect(d,[45,70,55,86], fill=(80,110,140,255))
    d.point((48,78), fill=(255,255,255,200))
    return img

save(make_building_glass(), "src/assets/buildings/building_glass.png")

def make_building_industrial():
    w=96; h=80
    img=Image.new("RGBA",(w,h),(0,0,0,0))
    d=ImageDraw.Draw(img)
    d.ellipse([18,68,78,79], fill=PAL["shadow"])
    outline_rect(d,[16,16,80,70], fill=PAL["steel"])
    outline_rect(d,[12,10,84,18], fill=PAL["steel_dark"])
    outline_rect(d,[34,36,62,70], fill=(90,100,110,255))
    for y in range(40,68,6):
        d.line([(35,y),(61,y)], fill=(255,255,255,35))
    outline_rect(d,[22,28,30,36], fill=(220,235,245,180))
    return img

save(make_building_industrial(), "src/assets/buildings/building_industrial.png")

def make_building_purple():
    w=88; h=96
    img=Image.new("RGBA",(w,h),(0,0,0,0))
    d=ImageDraw.Draw(img)
    d.ellipse([14,82,74,95], fill=PAL["shadow"])
    outline_rect(d,[14,18,74,86], fill=PAL["purple"])
    d.pieslice([18,2,70,38], start=180, end=360, fill=PAL["purple_dark"], outline=PAL["outline"])
    for x in (22,32,56,66):
        outline_rect(d,[x,28,x+4,84], fill=(210,200,230,255))
    outline_rect(d,[40,70,48,86], fill=(70,60,90,255))
    d.point((46,78), fill=(255,255,255,200))
    return img

save(make_building_purple(), "src/assets/buildings/building_purple.png")

# Characters (individual avatars + sheet)
def make_avatar(color_body, color_hat):
    img=Image.new("RGBA",(32,32),(0,0,0,0))
    d=ImageDraw.Draw(img)
    d.ellipse([10,26,22,31], fill=PAL["shadow"])
    outline_rect(d,[10,14,22,26], fill=color_body)
    d.ellipse([10,6,22,16], fill=(245,225,200,255), outline=PAL["outline"])
    d.point((14,11), fill=(30,30,30,255))
    d.point((18,11), fill=(30,30,30,255))
    outline_rect(d,[10,4,22,7], fill=color_hat)
    return img

avatar_colors = [
    ((120,170,220,255),(200,200,220,255)),
    ((240,170,180,255),(220,200,160,255)),
    ((150,220,170,255),(160,140,210,255)),
    ((230,210,140,255),(140,170,120,255)),
    ((180,140,220,255),(220,170,120,255)),
    ((120,200,160,255),(120,140,160,255)),
]
for i,(b,h) in enumerate(avatar_colors, start=1):
    save(make_avatar(b,h), f"src/assets/characters/avatar_{i}.png")

def make_sheet():
    frame_w=32; frame_h=32; cols=4; rows=2
    sheet=Image.new("RGBA",(frame_w*cols, frame_h*rows),(0,0,0,0))
    base = make_avatar((150,220,170,255),(160,140,210,255))
    for c in range(cols):
        f = base.copy()
        if c in (1,3):
            f2=Image.new("RGBA",(32,32),(0,0,0,0))
            f2.paste(f,(0,1))
            f=f2
        sheet.paste(f,(c*frame_w,0))
    for c in range(cols):
        f = base.copy()
        d=ImageDraw.Draw(f)
        # blink
        d.line([(13,11),(14,11)], fill=(30,30,30,255), width=1)
        d.line([(17,11),(18,11)], fill=(30,30,30,255), width=1)
        sheet.paste(f,(c*frame_w,frame_h))
    return sheet

save(make_sheet(), "src/assets/characters/avatar_sheet.png")

# UI icons
def icon_base():
    return Image.new("RGBA",(16,16),(0,0,0,0))

def draw_icon_home():
    img=icon_base(); d=ImageDraw.Draw(img)
    d.polygon([(8,2),(2,7),(2,8),(4,8),(4,13),(12,13),(12,8),(14,8),(14,7)], fill=(80,80,80,255))
    d.rectangle([6,10,10,13], fill=PAL["white"])
    return img

def draw_icon_people():
    img=icon_base(); d=ImageDraw.Draw(img)
    d.ellipse([2,5,7,10], fill=(80,80,80,255))
    d.ellipse([8,4,14,10], fill=(80,80,80,255))
    d.rectangle([1,10,7,14], fill=(80,80,80,255))
    d.rectangle([8,10,15,14], fill=(80,80,80,255))
    return img

def draw_icon_close():
    img=icon_base(); d=ImageDraw.Draw(img)
    d.line([(4,4),(11,11)], fill=(80,80,80,255), width=2)
    d.line([(11,4),(4,11)], fill=(80,80,80,255), width=2)
    return img

def draw_icon_dot(color):
    img=icon_base(); d=ImageDraw.Draw(img)
    d.ellipse([3,3,12,12], fill=color, outline=(60,60,60,255))
    return img

save(draw_icon_home(), "src/assets/ui/icon_home.png")
save(draw_icon_people(), "src/assets/ui/icon_people.png")
save(draw_icon_close(), "src/assets/ui/icon_close.png")
save(draw_icon_dot((110,200,120,255)), "src/assets/ui/icon_running.png")
save(draw_icon_dot((235,110,110,255)), "src/assets/ui/icon_blocked.png")
save(draw_icon_dot((245,220,90,255)), "src/assets/ui/icon_approval.png")

# Zip
zip_path = os.path.join(repo_root, "generated", "panopticon_assets_minimal.zip")
with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(base_dir):
        for f in files:
            fp = os.path.join(root,f)
            z.write(fp, os.path.relpath(fp, base_dir))

print(f"Wrote assets to: {base_dir}")
print(f"Wrote zip to: {zip_path}")

