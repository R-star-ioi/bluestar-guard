#!/usr/bin/env python3
"""把美术给的 1024/2048 大图压成游戏里用的小图。

用法：python tools/prep_weapons.py
输入：弓手武器/弓箭手武器缩略图 {白,绿,蓝,紫,红}.png
输出：assets/weapons/archer_{white,green,blue,purple,red}.png（256×256，带透明通道）
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '弓手武器')
OUT = os.path.join(ROOT, 'assets', 'weapons')
SIZE = 256

MAP = [
    ('白', 'archer_white.png'),
    ('绿', 'archer_green.png'),
    ('蓝', 'archer_blue.png'),
    ('紫', 'archer_purple.png'),
    ('红', 'archer_red.png'),
]

os.makedirs(OUT, exist_ok=True)
total = 0
for key, name in MAP:
    src = os.path.join(SRC, '弓箭手武器缩略图 %s.png' % key)
    if not os.path.exists(src):
        print('MISS', src)
        continue
    im = Image.open(src).convert('RGBA')
    im = im.resize((SIZE, SIZE), Image.LANCZOS)
    dst = os.path.join(OUT, name)
    im.save(dst, 'PNG', optimize=True)
    sz = os.path.getsize(dst)
    total += sz
    print('%-22s %5d x %-5d -> %6.1f KB' % (name, im.width, im.height, sz / 1024))
print('total %.1f KB' % (total / 1024))
