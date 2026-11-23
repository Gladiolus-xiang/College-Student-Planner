# -*- coding: utf-8 -*-
"""把「P1 长周期目标拆解」这一行移到 P2 之前，让优先级顺序连续。"""

import sys

from docx import Document

PATH = r"D:\AIGC\deliverables\项目文档-初稿.docx"

try:
    stream = open(PATH, "r+b")
    stream.close()
except OSError:
    print("LOCKED", file=sys.stderr)
    sys.exit(2)

doc = Document(PATH)
table = next((t for t in doc.tables if t.rows[0].cells[0].text.strip() == "优先级"), None)
if table is None:
    print("没找到功能范围表", file=sys.stderr)
    sys.exit(1)

target = next((r for r in table.rows if "长周期目标拆解" in r.cells[1].text), None)
anchor = next((r for r in table.rows if r.cells[0].text.strip() == "P2"), None)

if target is None or anchor is None:
    print("行没找到，跳过")
    sys.exit(0)

anchor._tr.addprevious(target._tr)

tmp = PATH + ".tmp"
doc.save(tmp)
import shutil

shutil.move(tmp, PATH)
print("顺序已调整")
