import math, random, os

W = H = 1080
PAPER = "#F2EBDD"
INK   = "#23201C"
OCHRE = "#B0702A"
MINT  = "#5ED3B3"   # --color-accent, canopy navbar
import base64 as _b64
LOGO_B64 = _b64.b64encode(open(__file__.rsplit("/",1)[0] + "/canopy-wordmark.png","rb").read()).decode()
LOGO_W, LOGO_H = 1298, 303
OUT = os.path.dirname(os.path.abspath(__file__))

# ---------- hand-drawn path machinery ----------

def resample(pts, step=26.0):
    out = [pts[0]]
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        d = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(d / step))
        for k in range(1, n + 1):
            t = k / n
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    return out

def cr(pts, closed=False):
    """Catmull-Rom through points -> cubic bezier path data."""
    p = pts[:]
    if closed:
        p = [pts[-1]] + pts + [pts[0], pts[1]]
    else:
        p = [pts[0]] + pts + [pts[-1]]
    d = "M %.1f %.1f" % (p[1][0], p[1][1])
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6.0, p1[1] + (p2[1] - p0[1]) / 6.0)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6.0, p2[1] - (p3[1] - p1[1]) / 6.0)
        d += " C %.1f %.1f %.1f %.1f %.1f %.1f" % (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    if closed:
        d += " Z"
    return d

def hd(pts, rng, amp=2.4, step=26.0, closed=False):
    """Jittered smooth path data for a polyline."""
    rs = resample(list(pts) + ([pts[0]] if closed else []), step)
    if closed:
        rs = rs[:-1]
    j = [(x + rng.uniform(-amp, amp), y + rng.uniform(-amp, amp)) for (x, y) in rs]
    return cr(j, closed)

def stroke(pts, rng, w=3.2, amp=2.4, step=26.0, closed=False,
           color=None, passes=2, op=0.9):
    color = color or INK
    s = ""
    for i in range(passes):
        s += ('<path d="%s" fill="none" stroke="%s" stroke-width="%.2f" '
              'stroke-linecap="round" stroke-linejoin="round" opacity="%.2f"/>\n'
              % (hd(pts, rng, amp + i * 0.5, step, closed), color,
                 w * (1.0 - i * 0.22), op * (1.0 - i * 0.32)))
    return s

def hatch(rng, x0, y0, x1, y1, spacing=13, angle=58, w=1.25, op=0.5, jitter=3):
    """Diagonal cross-hatch clipped to a box."""
    s = ""
    a = math.radians(angle)
    dx, dy = math.cos(a), math.sin(a)
    diag = math.hypot(x1 - x0, y1 - y0)
    n = int(diag * 2 / spacing)
    for i in range(-n, n):
        px = x0 + i * spacing * -dy
        py = y0 + i * spacing * dx
        seg = []
        for t in (-diag, diag):
            seg.append((px + dx * t, py + dy * t))
        # clip to box
        cl = clip_seg(seg[0], seg[1], x0, y0, x1, y1)
        if not cl:
            continue
        (ax, ay), (bx, by) = cl
        if math.hypot(bx - ax, by - ay) < 6:
            continue
        s += stroke([(ax, ay), (bx, by)], rng, w=w, amp=jitter * 0.4,
                    step=40, passes=1, op=op)
    return s

def clip_seg(p, q, x0, y0, x1, y1):
    """Liang-Barsky."""
    t0, t1 = 0.0, 1.0
    dx, dy = q[0] - p[0], q[1] - p[1]
    for pc, qc in ((-dx, p[0] - x0), (dx, x1 - p[0]), (-dy, p[1] - y0), (dy, y1 - p[1])):
        if pc == 0:
            if qc < 0:
                return None
            continue
        r = qc / pc
        if pc < 0:
            if r > t1: return None
            if r > t0: t0 = r
        else:
            if r < t0: return None
            if r < t1: t1 = r
    return ((p[0] + t0 * dx, p[1] + t0 * dy), (p[0] + t1 * dx, p[1] + t1 * dy))

# ---------- the column motif ----------

def column(rng, cx, y_top, y_bot, w, flutes=4, weather=0.0, hatch_side=True,
           capital=True, base=True, cap_style="plain", drums=0,
           broken_top=False):
    """Returns svg for one drawn stone column."""
    s = ""
    cap_h = 26 if capital else 0
    base_h = 34 if base else 0
    sy0 = y_top + cap_h
    sy1 = y_bot - base_h
    wt = w * 0.86           # taper at top
    hw0, hw1 = wt / 2, w / 2

    def edge(sign):
        pts = []
        n = 7
        for i in range(n + 1):
            t = i / n
            y = sy0 + (sy1 - sy0) * t
            hw = hw0 + (hw1 - hw0) * t
            bow = math.sin(t * math.pi) * w * 0.035   # entasis
            ch = 0.0
            if weather > 0 and rng.random() < weather * 0.75:
                ch = rng.uniform(-1, 1) * w * 0.22 * weather
            pts.append((cx + sign * (hw + bow + ch), y))
        return pts

    s += stroke(edge(-1), rng, w=3.3, amp=1.9 + weather * 2.2)
    s += stroke(edge(+1), rng, w=3.3, amp=1.9 + weather * 2.2)

    # fluting
    nf = max(0, int(flutes * (1 - weather * 0.6)))
    for i in range(nf):
        t = (i + 1) / (nf + 1)
        fx = cx + (t - 0.5) * wt * 0.78
        s += stroke([(fx, sy0 + 14), (fx + rng.uniform(-3, 3), sy1 - 14)],
                    rng, w=1.5, amp=2.0, step=46, passes=1, op=0.55)

    # a top broken clean off, and cracks through the shaft
    if broken_top:
        jag = [(cx - hw0 - 4, sy0 + 6)]
        for k in range(1, 7):
            jag.append((cx - hw0 + (2 * hw0) * k / 6.0,
                        sy0 + rng.uniform(-16, 26)))
        jag.append((cx + hw0 + 4, sy0 + 4))
        s += stroke(jag, rng, w=3.2, amp=2.2, step=16)
    for i in range(int(weather * 4)):
        cy = sy0 + (sy1 - sy0) * rng.uniform(0.15, 0.85)
        cw = w * rng.uniform(0.3, 0.7)
        x0 = cx + rng.uniform(-0.4, 0.0) * w
        s += stroke([(x0, cy), (x0 + cw * 0.4, cy + 16), (x0 + cw * 0.7, cy + 6),
                     (x0 + cw, cy + 24)], rng, w=1.7, amp=1.6, step=12, passes=1, op=0.65)

    # capital
    if capital:
        aw = w * 1.34
        if cap_style == "blade":
            bw2 = w * 1.05
            tip_y = y_top - 96
            # asymmetric chisel: long ground bevel up to a single keen point
            s += stroke([(cx - bw2, y_top + cap_h), (cx - bw2 + 10, y_top + 10),
                         (cx + bw2 * 0.62, tip_y), (cx + bw2, y_top + 14),
                         (cx + bw2, y_top + cap_h)], rng, w=3.3, amp=1.8, step=22)
            s += stroke([(cx - bw2, y_top + cap_h), (cx + bw2, y_top + cap_h)],
                        rng, w=3.0, amp=1.6)
            # the keen edge itself, inked in ochre
            s += stroke([(cx - bw2 + 14, y_top + 14), (cx + bw2 * 0.60, tip_y + 4)],
                        rng, w=4.0, amp=1.0, step=44, passes=1, color=OCHRE, op=0.95)
            # bevel facets
            for t in (0.30, 0.52, 0.74):
                x0 = cx - bw2 + 14 + (bw2 * 1.60) * t
                y0 = y_top + 14 - (y_top + 10 - tip_y) * t
                s += stroke([(x0, y0 + 10), (x0 - 6, y_top + cap_h - 4)],
                            rng, w=1.3, amp=1.2, step=30, passes=1, op=0.45)
        else:
            s += stroke([(cx - aw / 2, y_top), (cx + aw / 2, y_top),
                         (cx + aw / 2, y_top + cap_h), (cx - aw / 2, y_top + cap_h)],
                        rng, w=3.2, amp=1.7, closed=True, step=22)
            s += stroke([(cx - aw / 2 + 8, y_top + cap_h - 8),
                         (cx + aw / 2 - 8, y_top + cap_h - 8)],
                        rng, w=1.4, amp=1.4, step=40, passes=1, op=0.5)

    # base
    if base:
        bw = w * 1.42
        s += stroke([(cx - bw / 2, y_bot - base_h), (cx + bw / 2, y_bot - base_h),
                     (cx + bw / 2, y_bot), (cx - bw / 2, y_bot)],
                    rng, w=3.2, amp=1.7, closed=True, step=22)
        s += stroke([(cx - bw / 2 + 9, y_bot - base_h + 11),
                     (cx + bw / 2 - 9, y_bot - base_h + 11)],
                    rng, w=1.4, amp=1.4, step=40, passes=1, op=0.5)

    # drum joints (construction)
    for i in range(drums):
        t = (i + 1) / (drums + 1)
        y = sy0 + (sy1 - sy0) * t
        hw = hw0 + (hw1 - hw0) * t
        s += stroke([(cx - hw - 2, y), (cx + hw + 2, y)], rng, w=1.9, amp=1.6,
                    step=30, passes=1, op=0.7)

    # shadow hatching on the right flank
    if hatch_side:
        s += hatch(rng, cx + hw1 * 0.22, sy0 + 16, cx + hw1 * 0.94, sy1 - 16,
                   spacing=12, angle=62, w=1.2, op=0.34)
    return s

def ground(rng, y, x0=90, x1=990, wob=6):
    pts = [(x0, y)]
    x = x0
    while x < x1:
        x += 70
        pts.append((min(x, x1), y + rng.uniform(-wob, wob)))
    return stroke(pts, rng, w=2.6, amp=2.0, op=0.8)

# ---------- text lockup ----------

def lockup(word, sub=None, italic=None, title_lines=None):
    s = ""
    if title_lines:
        y = 886
        for ln in title_lines:
            s += ('<text x="88" y="%d" font-family="Georgia, serif" font-size="74" '
                  'letter-spacing="5" fill="%s">%s</text>\n' % (y, INK, ln))
            y += 68
    if word:
        s += ('<text x="88" y="908" font-family="Georgia, \'Times New Roman\', serif" '
              'font-size="88" letter-spacing="7" fill="%s">%s</text>\n' % (INK, word))
    if italic:
        s += ('<text x="88" y="900" font-family="Georgia, \'Times New Roman\', serif" '
              'font-style="italic" font-size="40" fill="%s" opacity="0.86">%s</text>\n'
              % (INK, italic))
    if sub:
        s += ('<text x="92" y="948" font-family="Georgia, serif" font-size="25" '
              'letter-spacing="3" fill="%s" opacity="0.75">%s</text>\n' % (INK, sub))
    # the real canopy wordmark, bottom-left
    lh = 40
    lw = lh * LOGO_W / float(LOGO_H)
    s += ('<image x="%.1f" y="946" width="%.1f" height="%d" '
          'href="data:image/png;base64,%s"/>\n' % (992 - lw, lw, lh, LOGO_B64))
    return s


def page(body, word=None, sub=None, italic=None, num=None, title_lines=None):
    s  = '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">\n' % (W, H, W, H)
    s += ('<defs><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" '
          'numOctaves="4" seed="7"/><feColorMatrix type="saturate" values="0"/></filter>\n'
          '<radialGradient id="v" cx="50%" cy="46%" r="72%">'
          '<stop offset="60%" stop-color="#000" stop-opacity="0"/>'
          '<stop offset="100%" stop-color="#5a4a33" stop-opacity="0.15"/></radialGradient></defs>\n')
    s += '<rect width="%d" height="%d" fill="%s"/>\n' % (W, H, PAPER)
    s += body
    s += '<rect width="%d" height="%d" fill="url(#v)"/>\n' % (W, H)
    s += ('<rect width="%d" height="%d" filter="url(#g)" opacity="0.16" '
          'style="mix-blend-mode:multiply"/>\n' % (W, H))
    s += lockup(word, sub, italic, title_lines)
    if num:
        s += ('<text x="992" y="112" text-anchor="end" font-family="Georgia, serif" '
              'font-size="23" letter-spacing="3" fill="%s" opacity="0.42">%s</text>\n' % (INK, num))
    s += '</svg>\n'
    return s


# ---------- slides ----------
# ---------- slides ----------

def slide_cover():
    r = random.Random(11); s = ""
    heights = [(250, 800), (196, 800), (286, 800), (168, 800), (232, 800), (208, 800)]
    xs = [175, 320, 465, 610, 755, 900]
    for (x, (yt, yb)) in zip(xs, heights):
        s += column(r, x, yt, yb, 84, flutes=3, weather=0.15)
    s += ground(r, 790)
    s += hatch(r, 120, 792, 960, 828, spacing=15, angle=66, w=1.2, op=0.3)
    return page(s, title_lines=["THE PILLARS", "OF TRADING"])


def slide_edge():
    r = random.Random(21); s = ""
    s += column(r, 540, 288, 782, 148, flutes=4, cap_style="blade")
    s += ground(r, 788)
    s += hatch(r, 350, 790, 740, 826, spacing=15, angle=64, w=1.2, op=0.32)
    return page(s, word="EDGE", num="01 / 06")

def slide_risk():
    r = random.Random(32); s = ""
    cx = 470
    s += column(r, cx, 258, 780, 124, flutes=4, weather=0.12)
    # cliff: solid ground on the left, sheer drop just past the column
    s += stroke([(80, 786), (250, 780), (400, 788), (540, 782), (620, 788)], r, w=2.9, amp=2.4)
    s += stroke([(620, 788), (650, 856), (634, 928), (662, 1010)], r, w=2.9, amp=3.4, step=34)
    s += hatch(r, 100, 792, 615, 844, spacing=16, angle=68, w=1.2, op=0.3)
    # a chunk broken clean out of the base - it still stands
    bx0, bx1, by0, by1 = cx - 92, cx - 10, 742, 784
    s += ('<path d="M %d %d L %d %d L %d %d L %d %d Z" fill="%s" stroke="none"/>\n'
          % (bx0 - 4, by0 - 2, bx1, by0 - 2, bx1, by1 + 4, bx0 - 4, by1 + 4, PAPER))
    s += stroke([(bx0 - 2, by0 - 1), (bx0 + 18, by0 + 16), (bx0 + 4, by0 + 26),
                 (bx0 + 30, by1 - 2), (bx1 - 6, by1 + 2)], r, w=2.8, amp=2.0, step=15)
    # the piece that came off, and its rubble, falling into the void
    for (rx, ry, rs) in ((690, 892, 22), (742, 958, 14), (676, 986, 10), (766, 872, 11)):
        s += stroke([(rx, ry), (rx + rs, ry - rs * 0.62), (rx + rs * 1.3, ry + rs * 0.55),
                     (rx + rs * 0.35, ry + rs * 0.85)], r, w=2.2, amp=1.8, step=14,
                    closed=True, passes=1, op=0.8)
    return page(s, word="RISK", num="02 / 06")


def slide_patience():
    r = random.Random(43); s = ""
    s += column(r, 400, 250, 782, 122, flutes=4, weather=0.2)
    s += column(r, 830, 300, 786, 96, flutes=3, weather=0.25, hatch_side=False)
    s += ground(r, 792)
    # ivy climbing the main column, hugging the shaft
    import math as _m
    vine = [(400, 782)]
    y = 782
    while y > 296:
        y -= 38
        vine.append((400 + _m.sin((790 - y) / 58.0) * 50, y))
    s += stroke(vine, r, w=2.3, amp=2.2, step=28, op=0.85)
    for i in range(2, len(vine) - 1, 1):
        vx, vy = vine[i]
        for sgn in (-1, 1):
            tx, ty = vx + sgn * 34, vy - 20
            mx, my = (vx + tx) / 2.0, (vy + ty) / 2.0
            dx, dy = tx - vx, ty - vy
            L = _m.hypot(dx, dy) or 1.0
            px, py = -dy / L, dx / L
            b = 11
            s += ('<path d="M %.1f %.1f Q %.1f %.1f %.1f %.1f Q %.1f %.1f %.1f %.1f Z" '
                  'fill="none" stroke="%s" stroke-width="1.7" stroke-linejoin="round" '
                  'opacity="0.72"/>\n'
                  % (vx, vy, mx + px * b, my + py * b, tx, ty,
                     mx - px * b, my - py * b, vx, vy, INK))
    # spider web strung between the columns
    ax, ay = 470, 318
    for k in range(6):
        a = math.radians(6 + k * 17)
        s += stroke([(ax, ay), (ax + math.cos(a) * 300, ay + math.sin(a) * 300)],
                    r, w=1.1, amp=1.4, step=48, passes=1, op=0.45)
    for rad in (86, 148, 210, 268):
        arc = []
        for k in range(9):
            a = math.radians(6 + k * 11.5)
            arc.append((ax + math.cos(a) * rad, ay + math.sin(a) * rad))
        s += stroke(arc, r, w=1.1, amp=2.0, step=30, passes=1, op=0.45)
    return page(s, word="PATIENCE", num="03 / 06")

def slide_discipline():
    r = random.Random(54); s = ""
    s += column(r, 540, 246, 786, 132, flutes=4)
    s += ground(r, 792)
    # taut rope wrapped in even turns
    for i in range(9):
        y = 350 + i * 42
        hw = 60 + i * 1.4
        s += stroke([(540 - hw - 5, y - 9), (540, y + 11), (540 + hw + 5, y - 9)],
                    r, w=2.6, amp=1.5, step=22, passes=1, op=0.9)
        s += stroke([(540 - hw - 5, y - 9), (540, y - 3), (540 + hw + 5, y - 9)],
                    r, w=1.3, amp=1.3, step=26, passes=1, op=0.4)
    s += stroke([(540 + 74, 728), (620, 762), (656, 742)], r, w=2.6, amp=2.0, step=22, op=0.85)
    s += stroke([(648, 736), (668, 756), (646, 764)], r, w=2.0, amp=1.4, step=14,
                closed=True, passes=1, color=OCHRE, op=0.9)
    return page(s, word="DISCIPLINE", num="04 / 06")

def slide_process():
    r = random.Random(65); s = ""
    s += column(r, 500, 300, 786, 128, flutes=2, capital=False, drums=4)
    s += ground(r, 792)
    # top drum set slightly askew, waiting
    s += stroke([(460.6, 214.1), (607.8, 242.7), (599.4, 285.9), (452.2, 257.3)],
                r, w=3.0, amp=1.8, closed=True, step=22)
    s += stroke([(468, 232), (592, 256)], r, w=1.4, amp=1.3, step=34, passes=1, op=0.45)
    # plumb line
    s += stroke([(760, 214), (760, 700)], r, w=1.5, amp=1.3, step=60, passes=1, op=0.75)
    s += stroke([(742, 214), (784, 210)], r, w=2.6, amp=1.6, step=20)
    s += stroke([(760, 700), (776, 736), (760, 762), (744, 736), (760, 700)],
                r, w=2.4, amp=1.4, step=14, closed=True, color=OCHRE, op=0.95)
    # measurement ticks
    for i in range(11):
        y = 300 + i * 44
        s += stroke([(806, y), (806 + (22 if i % 2 == 0 else 12), y)],
                    r, w=1.4, amp=1.0, step=24, passes=1, op=0.55)
    s += stroke([(806, 296), (806, 744)], r, w=1.3, amp=1.2, step=60, passes=1, op=0.5)
    return page(s, word="PROCESS", num="05 / 06")

def slide_time():
    r = random.Random(76); s = ""
    arc = [(300 + i * 24, 250 - math.sin(i / 20.0 * math.pi) * 78) for i in range(21)]
    s += stroke(arc, r, w=2.4, amp=2.0, step=34, passes=1, color=OCHRE, op=0.85)
    # crisp -> worn -> a ruin with its top broken clean off
    s += column(r, 250, 330, 786, 108, flutes=4, weather=0.0)
    s += column(r, 540, 372, 786, 108, flutes=2, weather=0.5)
    s += column(r, 830, 470, 786, 108, flutes=1, weather=0.62,
                capital=False, broken_top=True, hatch_side=False)
    # moss creeping over the oldest
    for (mx, my) in ((790, 560), (866, 606), (798, 664), (858, 700), (786, 740), (872, 526)):
        s += stroke([(mx, my), (mx + 20, my - 10), (mx + 34, my + 8), (mx + 12, my + 16)],
                    r, w=1.9, amp=2.4, step=12, closed=True, passes=1, op=0.6)
    s += ground(r, 792)
    s += hatch(r, 120, 794, 960, 830, spacing=15, angle=64, w=1.2, op=0.3)
    return page(s, word="TIME", num="06 / 06")


def slide_close():
    r = random.Random(87); s = ""
    xs = [175, 320, 465, 610, 755, 900]
    for x in xs:
        s += column(r, x, 330, 790, 84, flutes=3, weather=0.1)
    # single unbroken lintel
    s += stroke([(112, 250), (966, 244), (968, 322), (114, 328)], r, w=3.4, amp=2.0,
                closed=True, step=30)
    s += hatch(r, 120, 254, 960, 318, spacing=17, angle=60, w=1.2, op=0.26)
    s += ground(r, 796)
    return page(s, word=None,
                italic="Remove one and the roof comes down.", num=None)

SLIDES = [
    ("01-cover",      slide_cover),
    ("02-edge",       slide_edge),
    ("03-risk",       slide_risk),
    ("04-patience",   slide_patience),
    ("05-discipline", slide_discipline),
    ("06-process",    slide_process),
    ("07-time",       slide_time),
    ("08-close",      slide_close),
]

for name, fn in SLIDES:
    svg = fn()
    open(os.path.join(OUT, name + ".svg"), "w").write(svg)
    open(os.path.join(OUT, name + ".html"), "w").write(
        "<html><head><style>html,body{margin:0;padding:0;background:%s}"
        "svg{display:block}</style></head><body>%s</body></html>" % (PAPER, svg))
print("wrote %d slides" % len(SLIDES))
