#!/usr/bin/env python3
"""把美术给的 1024/2048 大图压成游戏里用的小图。

用法：python tools/prep_weapons.py
输入：弓手武器/弓箭手武器缩略图 {白,绿,蓝,紫,红}.png
输出：
  assets/weapons/archer_{white,...}.png       256×256 卡面（保留原背景色）
  assets/weapons/archer_{white,...}_cut.png   抠掉背景的武器本体（游戏里手持用）
"""
import os
import sys
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '弓手武器')
OUT = os.path.join(ROOT, 'assets', 'weapons')
SIZE = 256
CUT_SIZE = 160
TOL = 30          # 背景色容差（三通道绝对差之和 / 3）

MAP = [
    ('白', 'archer_white.png'),
    ('绿', 'archer_green.png'),
    ('蓝', 'archer_blue.png'),
    ('紫', 'archer_purple.png'),
    ('红', 'archer_red.png'),
]


def cut_background(im, tol=TOL, tol2=16):
    """从四边泛洪去掉连通的背景；再全局清掉被弓身围住的同色背景块。

    tol  = 泛洪宽容度（吃边缘渐变更干净）
    tol2 = 全局清理的严格阈值（只吃与背景色非常接近的像素，避免吃掉武器本身）
    """
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    cs = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = tuple(sum(c[i] for c in cs) // 4 for i in range(3))

    seen = bytearray(w * h)
    dq = deque()
    for x in range(w):
        dq.append((x, 0))
        dq.append((x, h - 1))
    for y in range(h):
        dq.append((0, y))
        dq.append((w - 1, y))

    while dq:
        x, y = dq.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if (abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])) > tol * 3:
            continue
        px[x, y] = (r, g, b, 0)
        dq.append((x + 1, y))
        dq.append((x - 1, y))
        dq.append((x, y + 1))
        dq.append((x, y - 1))

    # 被围住的背景（比如弓弦和弓身之间那块）：只清非常接近背景色的
    limit = tol2 * 3
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if (abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])) <= limit:
                px[x, y] = (r, g, b, 0)
    return im


def trim(im, pad=6):
    box = im.getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(im.width, x1 + pad); y1 = min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for key, name in MAP:
        src = os.path.join(SRC, '弓箭手武器缩略图 %s.png' % key)
        if not os.path.exists(src):
            print('MISS', src)
            continue
        im = Image.open(src).convert('RGBA')

        # 卡面：等比压到 256
        card = im.resize((SIZE, SIZE), Image.LANCZOS)
        dst = os.path.join(OUT, name)
        card.save(dst, 'PNG', optimize=True)
        total += os.path.getsize(dst)
        print('%-22s card %5d²  %6.1f KB' % (name, SIZE, os.path.getsize(dst) / 1024))

        # 手持：抠背景 + 裁边 + 缩到 160 长边
        cut = trim(cut_background(im))
        side = max(cut.width, cut.height)
        scale = CUT_SIZE / side
        cut = cut.resize((max(1, int(cut.width * scale)), max(1, int(cut.height * scale))), Image.LANCZOS)
        dst2 = os.path.join(OUT, name.replace('.png', '_cut.png'))
        cut.save(dst2, 'PNG', optimize=True)
        total += os.path.getsize(dst2)
        print('%-22s cut  %dx%-4d %6.1f KB' % (name.replace('.png', '_cut'), cut.width, cut.height, os.path.getsize(dst2) / 1024))

    print('total %.1f KB' % (total / 1024))


if __name__ == '__main__':
    main()

