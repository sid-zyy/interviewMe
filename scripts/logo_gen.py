from PIL import Image, ImageDraw
import math

# Token colors (matches theme.css)
CAP_TOP = (140, 158, 255)     # #8C9EFF light blue-violet
CAP_BOTTOM = (145, 104, 192)  # #9168C0 purple
NODE_ROOT = (102, 157, 246)   # #669DF6
NODE_CHILD = (138, 180, 248)  # #8AB4F8
LINE = (95, 99, 104)          # #5F6368
BUTTON = (255, 255, 255)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def draw_gradient_polygon(base_img, points, top_color, bottom_color, bbox):
    # Simple vertical gradient fill by scanline-masking a rectangle gradient
    # to the polygon shape.
    x0, y0, x1, y1 = bbox
    w, h = int(x1 - x0) + 1, int(y1 - y0) + 1
    grad = Image.new("RGBA", (w, h))
    gpix = grad.load()
    for yy in range(h):
        t = yy / max(h - 1, 1)
        col = lerp(top_color, bottom_color, t) + (255,)
        for xx in range(w):
            gpix[xx, yy] = col
    mask = Image.new("L", (w, h), 0)
    mdraw = ImageDraw.Draw(mask)
    shifted = [(px - x0, py - y0) for px, py in points]
    mdraw.polygon(shifted, fill=255)
    base_img.paste(grad, (int(x0), int(y0)), mask)

def render(size, path, simplified=False):
    scale = size / 128
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def pt(x, y):
        return (x * scale, y * scale)

    def circle(center, r, color):
        cx, cy = center
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

    if simplified:
        # At 16px, fine detail (thin lines, small child nodes) turns to mush.
        # Reduce to the two most legible shapes: cap diamond + one root node.
        diamond = [pt(64, 10), pt(118, 40), pt(64, 70), pt(10, 40)]
        bbox = (min(p[0] for p in diamond), min(p[1] for p in diamond),
                max(p[0] for p in diamond), max(p[1] for p in diamond))
        draw_gradient_polygon(img, diamond, CAP_TOP, CAP_BOTTOM, bbox)
        circle(pt(64, 74), 22 * scale, NODE_ROOT)
        img.save(path)
        return

    # --- Graduation cap (mortarboard), drawn first ---
    diamond = [pt(64, 14), pt(112, 36), pt(64, 58), pt(16, 36)]
    bbox = (min(p[0] for p in diamond), min(p[1] for p in diamond),
            max(p[0] for p in diamond), max(p[1] for p in diamond))
    draw_gradient_polygon(img, diamond, CAP_TOP, CAP_BOTTOM, bbox)

    # center button on top of the cap
    circle(pt(64, 14), 3.4 * scale, BUTTON)

    # --- Binary tree, root overlaps the cap's bottom tip for one seamless mark ---
    root = pt(64, 62)
    left = pt(42, 96)
    right = pt(86, 96)
    line_w = max(1, round(3 * scale))

    d.line([root, left], fill=LINE, width=line_w)
    d.line([root, right], fill=LINE, width=line_w)

    circle(root, 15 * scale, NODE_ROOT)
    circle(left, 9 * scale, NODE_CHILD)
    circle(right, 9 * scale, NODE_CHILD)

    img.save(path)

if __name__ == "__main__":
    render(16, "/home/claude/interview-extension/extension/public/icons/icon16.png", simplified=True)
    render(48, "/home/claude/interview-extension/extension/public/icons/icon48.png")
    render(128, "/home/claude/interview-extension/extension/public/icons/icon128.png")
    render(512, "/home/claude/interview-extension/design-preview/logo_preview.png")
    print("done")
