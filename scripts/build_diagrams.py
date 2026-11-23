# -*- coding: utf-8 -*-
"""生成 PPT 用的两张图：三层架构图、六步闭环图（16:9，2 倍分辨率）。

改文字或配色后重新运行本脚本即可，输出到 deliverables/assets/。
"""

import math
import os

from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
SCALE = 2

INK = "#1F2937"
MUTED = "#64748B"
LINE = "#CBD5E1"
CARD = "#F8FAFC"
ACCENT = "#D97706"
SKY = "#0369A1"
GREEN = "#047857"
WHITE = "#FFFFFF"

FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_B = "C:/Windows/Fonts/msyhbd.ttc"

OUT_DIR = r"D:\AIGC\deliverables\assets"


def font(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size * SCALE)


def new_canvas():
    img = Image.new("RGB", (W * SCALE, H * SCALE), WHITE)
    return img, ImageDraw.Draw(img)


def rrect(draw, box, radius, fill=None, outline=None, width=2):
    x1, y1, x2, y2 = [v * SCALE for v in box]
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius * SCALE, fill=fill, outline=outline, width=width * SCALE)


def text(draw, xy, content, size, color=INK, bold=False, anchor="la"):
    draw.text((xy[0] * SCALE, xy[1] * SCALE), content, font=font(size, bold), fill=color, anchor=anchor)


def head(draw, tip, ang, color, size=16):
    tipx, tipy = tip[0] * SCALE, tip[1] * SCALE
    backx = tipx - math.cos(ang) * size * SCALE
    backy = tipy - math.sin(ang) * size * SCALE
    left = (
        backx - math.cos(ang + math.pi / 2) * size * SCALE * 0.42,
        backy - math.sin(ang + math.pi / 2) * size * SCALE * 0.42,
    )
    right = (
        backx - math.cos(ang - math.pi / 2) * size * SCALE * 0.42,
        backy - math.sin(ang - math.pi / 2) * size * SCALE * 0.42,
    )
    draw.polygon([(tipx, tipy), left, right], fill=color)


def arrow(draw, x1, y1, x2, y2, color=MUTED, width=3, size=16, both=False, dashed=False):
    x1, y1, x2, y2 = [v * SCALE for v in (x1, y1, x2, y2)]
    ang = math.atan2(y2 - y1, x2 - x1)

    if dashed:
        total = math.hypot(x2 - x1, y2 - y1)
        pos = 0.0
        while pos < total:
            end = min(pos + 14 * SCALE, total)
            draw.line(
                [x1 + math.cos(ang) * pos, y1 + math.sin(ang) * pos, x1 + math.cos(ang) * end, y1 + math.sin(ang) * end],
                fill=color,
                width=width * SCALE,
            )
            pos += 24 * SCALE
    else:
        draw.line([x1, y1, x2, y2], fill=color, width=width * SCALE)

    head(draw, (x2 / SCALE, y2 / SCALE), ang, color, size)
    if both:
        head(draw, (x1 / SCALE, y1 / SCALE), ang + math.pi, color, size)


def polyline_arrow(draw, points, color=MUTED, width=3, size=16, dashed=False):
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        last = i == len(points) - 2
        if last:
            arrow(draw, x1, y1, x2, y2, color, width, size, dashed=dashed)
        elif dashed:
            arrow(draw, x1, y1, x2, y2, color, width, 0, dashed=True)
        else:
            draw.line([x1 * SCALE, y1 * SCALE, x2 * SCALE, y2 * SCALE], fill=color, width=width * SCALE)


# ---------------------------------------------------------------- 架构图
def build_architecture():
    img, d = new_canvas()

    layers = [
        ("01", "浏览器端", "React 单页 · 用户看到的全部界面", SKY,
         ["录入与解析", "三天计划视图", "打卡与提醒", "localStorage"]),
        ("02", "本地 Node 中间件", "Vite 插件挂载 · 四十行代码", ACCENT,
         ["POST /api/chat", "校验层 · 补齐归一", "从 .env 注入密钥", "写调用日志"]),
        ("03", "DeepSeek API", "deepseek-chat · 国内直连", GREEN,
         ["P1 抽取活动", "P2 解释计划", "P3 重排顺序", "结构化 JSON"]),
    ]

    top, card_h, gap = 90, 210, 95
    x1, x2 = 230, 1690

    for i, (no, title, sub, color, items) in enumerate(layers):
        y = top + i * (card_h + gap)
        rrect(d, (x1, y, x2, y + card_h), 18, fill=CARD, outline=LINE, width=2)
        rrect(d, (x1 + 2, y + 18, x1 + 9, y + card_h - 18), 4, fill=color)

        text(d, (x1 + 48, y + 42), no, 24, color, bold=True)
        text(d, (x1 + 48, y + 80), title, 36, INK, bold=True)
        text(d, (x1 + 48, y + 138), sub, 21, MUTED)

        for j, item in enumerate(items):
            ix = x1 + 480 + j * 245
            d.ellipse([ix * SCALE, (y + 97) * SCALE, (ix + 9) * SCALE, (y + 106) * SCALE], fill=color)
            text(d, (ix + 20, y + 89), item, 22, INK)

    for i in range(2):
        y_from = top + i * (card_h + gap) + card_h + 14
        y_to = top + (i + 1) * (card_h + gap) - 14
        arrow(d, 700, y_from, 700, y_to, MUTED, width=3, size=14, both=True)
        label = "只发消息，不带密钥" if i == 0 else "带 Authorization 头"
        text(d, (735, (y_from + y_to) / 2 - 15), label, 20, MUTED)

    text(d, (230, 962), "密钥只存在于第 02 层：前端构建产物里搜不到 sk- 开头的字符串", 21, MUTED)

    path = os.path.join(OUT_DIR, "架构图.png")
    img.save(path, "PNG")
    print("saved", path)


# ---------------------------------------------------------------- 闭环图
def build_loop():
    img, d = new_canvas()

    card_w, card_h = 400, 175
    cols = [150, 760, 1380]
    row1, row2 = 195, 615

    steps = [
        (cols[0], row1, "01", "粘贴一段文字", "群通知、DDL、课表", SKY),
        (cols[1], row1, "02", "AI 解析", "拆成活动，识别固定日程", ACCENT),
        (cols[2], row1, "03", "规则排期", "避开课程与饭点", GREEN),
        (cols[2], row2, "04", "到点提醒", "通知 + 页面卡片", GREEN),
        (cols[1], row2, "05", "打卡", "连续天数不中断", ACCENT),
        (cols[0], row2, "06", "一键重排", "只改顺序，不改时间", SKY),
    ]

    for x, y, no, title, sub, color in steps:
        rrect(d, (x, y, x + card_w, y + card_h), 16, fill=WHITE, outline=LINE, width=2)
        rrect(d, (x + 2, y + 18, x + 8, y + card_h - 18), 3, fill=color)
        text(d, (x + 34, y + 28), no, 20, color, bold=True)
        text(d, (x + 34, y + 60), title, 30, INK, bold=True)
        text(d, (x + 34, y + 116), sub, 20, MUTED)

    mid1 = row1 + card_h / 2
    mid2 = row2 + card_h / 2

    arrow(d, cols[0] + card_w, mid1, cols[1], mid1, MUTED, 3, 15)
    arrow(d, cols[1] + card_w, mid1, cols[2], mid1, MUTED, 3, 15)
    arrow(d, cols[2] + card_w / 2, row1 + card_h, cols[2] + card_w / 2, row2, MUTED, 3, 15)
    arrow(d, cols[2], mid2, cols[1] + card_w, mid2, MUTED, 3, 15)
    arrow(d, cols[1], mid2, cols[0] + card_w, mid2, MUTED, 3, 15)

    # 闭环回线：06 → 下方 → 右侧上行 → 回到 03
    polyline_arrow(
        d,
        [
            (cols[0] + card_w / 2, row2 + card_h),
            (cols[0] + card_w / 2, 880),
            (1840, 880),
            (1840, mid1),
            (cols[2] + card_w, mid1),
        ],
        color=ACCENT,
        width=2,
        size=15,
        dashed=True,
    )
    text(d, (1150, 922), "重排之后，重新进入排期", 21, ACCENT, anchor="mm")

    text(d, (960, 1012), "六步缺一步，产品就不成立：没有重排，计划只是一张纸", 21, MUTED, anchor="mm")

    path = os.path.join(OUT_DIR, "闭环图.png")
    img.save(path, "PNG")
    print("saved", path)


os.makedirs(OUT_DIR, exist_ok=True)
build_architecture()
build_loop()
