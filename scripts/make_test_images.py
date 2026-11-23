# -*- coding: utf-8 -*-
"""造两张假截图，用来测试识图链路（群通知、课表）。"""

import os

from PIL import Image, ImageDraw, ImageFont

OUT = r"D:\AIGC\deliverables\assets\test"
FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_B = "C:/Windows/Fonts/msyhbd.ttc"


def f(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)


def chat_shot(path):
    W, H = 828, 1100
    img = Image.new("RGB", (W, H), "#EDEDED")
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, W, 96], fill="#F7F7F7")
    d.text((28, 26), "2026级软工1班 通知群(128)", font=f(30, True), fill="#111111")
    d.text((28, 66), "今天 10:02", font=f(20), fill="#888888")

    def bubble(x, y, w, text, color="#FFFFFF", head=None):
        lines, cur = [], ""
        for ch in text:
            cur += ch
            if d.textlength(cur, font=f(26)) > w - 40:
                lines.append(cur)
                cur = ""
        if cur:
            lines.append(cur)
        h = 20 + len(lines) * 38
        d.rounded_rectangle([x, y, x + w, y + h], radius=12, fill=color)
        if head:
            d.text((x + 18, y + 10), head, font=f(20), fill="#666666")
            ty = y + 36
        else:
            ty = y + 14
        for line in lines:
            d.text((x + 18, ty), line, font=f(26), fill="#1a1a1a")
            ty += 38
        return y + h + 22

    y = 130
    y = bubble(40, y, 620, "下周三（11月25日）晚上7点半在教学楼A305开班会，所有人必须到，不能请假。", "#FFFFFF", "班长")
    y = bubble(40, y, 640, "大学物理实验报告这周五下午5点前交到学习通，逾期不候。", "#FFFFFF", "学习委员")
    y = bubble(520, y, 260, "收到", "#95EC69")
    y = bubble(520, y, 260, "收到", "#95EC69")
    y = bubble(40, y, 600, "另外提醒：12月12日上午9点四级考试，记得带准考证。", "#FFFFFF", "学委")

    img.save(path)


def timetable_shot(path):
    W, H = 1200, 760
    img = Image.new("RGB", (W, H), "#FFFFFF")
    d = ImageDraw.Draw(img)

    d.text((40, 26), "2026-2027学年第一学期课表", font=f(30, True), fill="#111111")

    left, top = 40, 90
    col_w = (W - left - 40) / 6
    row_h = 120
    heads = ["节次", "周一", "周二", "周三", "周四", "周五"]
    for i, h in enumerate(heads):
        d.rectangle([left + i * col_w, top, left + (i + 1) * col_w, top + 56], fill="#F3F4F6", outline="#D1D5DB")
        d.text((left + i * col_w + 18, top + 14), h, font=f(22, True), fill="#374151")

    rows = [
        ("1-2节\n08:00-09:40", {1: "高等数学", 3: "程序设计基础", 4: "大学英语"}),
        ("3-4节\n10:00-11:40", {1: "大学英语", 3: "高等数学", 5: "大学物理"}),
        ("5-6节\n13:30-15:10", {2: "大学物理", 4: "程序设计实验"}),
        ("7-8节\n15:30-17:10", {2: "体育", 5: "形势与政策"}),
    ]

    for r, (label, cells) in enumerate(rows):
        y1 = top + 56 + r * row_h
        y2 = y1 + row_h
        d.rectangle([left, y1, left + col_w, y2], fill="#FAFAFA", outline="#D1D5DB")
        for k, line in enumerate(label.split("\n")):
            d.text((left + 12, y1 + 24 + k * 30), line, font=f(19), fill="#4B5563")
        for c in range(1, 6):
            x1 = left + c * col_w
            d.rectangle([x1, y1, x1 + col_w, y2], outline="#D1D5DB")
            name = cells.get(c)
            if name:
                d.rounded_rectangle([x1 + 8, y1 + 12, x1 + col_w - 8, y2 - 12], radius=6, fill="#E0F2FE")
                d.text((x1 + 18, y1 + 40), name, font=f(21), fill="#0C4A6E")

    img.save(path)


os.makedirs(OUT, exist_ok=True)
chat_shot(os.path.join(OUT, "chat.png"))
timetable_shot(os.path.join(OUT, "timetable.png"))
print("ok")
