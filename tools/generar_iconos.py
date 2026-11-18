"""Genera los iconos PNG de la app (sin dependencias externas).
Mismo generador que SaveyCustom, con otro dibujo: un calendario con una marca de "hecho"
sobre fondo azul marino, para no confundirlo con Savey en la pantalla de inicio.
Uso: python tools/generar_iconos.py
"""
import math, struct, zlib, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "app" / "icons"
BG = (31, 42, 68)          # --navy
WHITE = (251, 248, 246)    # --card
PINK = (232, 115, 122)     # --accent
GREEN = (93, 170, 98)      # --income

# Todo en coordenadas relativas (0..1). El dibujo queda dentro de la zona segura de los iconos "maskable".
BODY = (.24, .28, .76, .78, .06)            # x0, y0, x1, y1, radio
HEADER_BOTTOM = .40
RINGS = [(.36, .21, .40, .34), (.60, .21, .64, .34)]
CHECK = [(.36, .585), (.465, .685), (.645, .505)]
CHECK_W = .045


def in_round_rect(u, v, x0, y0, x1, y1, r):
    if not (x0 <= u <= x1 and y0 <= v <= y1):
        return False
    cx = min(max(u, x0 + r), x1 - r)
    cy = min(max(v, y0 + r), y1 - r)
    return math.hypot(u - cx, v - cy) <= r


def dist_seg(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def pixel(x, y, n):
    u, v = (x + .5) / n, (y + .5) / n
    for x0, y0, x1, y1 in RINGS:
        if in_round_rect(u, v, x0, y0, x1, y1, .02):
            return WHITE
    if in_round_rect(u, v, *BODY):
        if any(dist_seg(u, v, *CHECK[i], *CHECK[i + 1]) <= CHECK_W / 2 for i in range(len(CHECK) - 1)):
            return GREEN
        return PINK if v <= HEADER_BOTTOM else WHITE
    return BG


def png(n, path):
    raw = bytearray()
    ss = 3  # supersampling para bordes suaves
    for y in range(n):
        raw.append(0)
        for x in range(n):
            acc = [0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    p = pixel(x * ss + sx, y * ss + sy, n * ss)
                    for i in range(3):
                        acc[i] += p[i]
            raw.extend(int(v / ss / ss) for v in acc)
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(data)


OUT.mkdir(parents=True, exist_ok=True)
for n in (180, 192, 512):
    png(n, OUT / f"icon-{n}.png")
    print("ok", n)
