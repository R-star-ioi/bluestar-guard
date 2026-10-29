#!/usr/bin/env python3
"""把美术给的 1024/2048 大图压成游戏里用的小图。

用法：python tools/prep_weapons.py [职业]
  python tools/prep_weapons.py            # 全部职业
  python tools/prep_weapons.py cannon     # 只跑炮手

输入（按职业）：
  弓手武器/弓箭手武器缩略图 {白,绿,蓝,紫,红}.png
  武器/炮手武器/炮手武器缩略图 {白,绿,蓝,紫,红}.png
输出：
  assets/weapons/{job}_{white,...}.png       256×256 卡面（保留原背景色）
  assets/weapons/{job}_{white,...}_cut.png   抠掉背景的武器本体（游戏里手持用）
"""
import os
import sys
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'weapons')
SIZE = 256
CUT_SIZE = 160
TOL = 30          # 背景色容差（三通道绝对差之和 / 3）

# 职业 → 素材目录 / 文件名模板 / 输出名模板
JOBS = {
    'archer': {
        'src': os.path.join(ROOT, '弓手武器'),
        'tpl': '弓箭手武器缩略图 %s.png',
        'out': 'archer_%s.png',
    },
    'cannon': {
        'src': os.path.join(ROOT, '武器', '炮手武器'),
        'tpl': '炮手武器缩略图 %s.png',
        'out': 'cannon_%s.png',
    },
}

KEYS = [('白', 'white'), ('绿', 'green'), ('蓝', 'blue'), ('紫', 'purple'), ('红', 'red')]


def cut_background(im, tol=TOL, tol2=16):
    """从四边泛洪去掉连通的背景；再全局清掉被武器围住的同色背景块。

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


def process(job):
    cfg = JOBS[job]
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for key, en in KEYS:
        src = os.path.join(cfg['src'], cfg['tpl'] % key)
        if not os.path.exists(src):
            print('MISS', src)
            continue
        im = Image.open(src).convert('RGBA')

        # 卡面：等比压到 256
        card = im.resize((SIZE, SIZE), Image.LANCZOS)
        dst = os.path.join(OUT, cfg['out'] % en)
        card.save(dst, 'PNG', optimize=True)
        total += os.path.getsize(dst)
        print('%-22s card %5d²  %6.1f KB' % (cfg['out'] % en, SIZE, os.path.getsize(dst) / 1024))

        # 手持：抠背景 + 裁边 + 缩到 160 长边
        cut = trim(cut_background(im))
        side = max(cut.width, cut.height)
        scale = CUT_SIZE / side
        cut = cut.resize((max(1, int(cut.width * scale)), max(1, int(cut.height * scale))), Image.LANCZOS)
        dst2 = os.path.join(OUT, (cfg['out'] % en).replace('.png', '_cut.png'))
        cut.save(dst2, 'PNG', optimize=True)
        total += os.path.getsize(dst2)
        print('%-22s cut  %dx%-4d %6.1f KB' % ((cfg['out'] % en).replace('.png', '_cut'), cut.width, cut.height, os.path.getsize(dst2) / 1024))

    print('[%s] total %.1f KB' % (job, total / 1024))


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = sys.argv[1:] or list(JOBS.keys())
    for job in jobs:
        if job not in JOBS:
            print('UNKNOWN JOB', job, '（可选：', ', '.join(JOBS.keys()), '）')
            continue
        process(job)


if __name__ == '__main__':
    main()
