# -*- coding: utf-8 -*-
"""在附录 E 的「脚本 / 验证内容 / 结果」表格末尾追加一行 smoke-edge。

只追加，不改动其他内容：复制最后一行 XML 再替换文字，字体与列宽保持一致。
"""

import copy
import shutil
import sys

from docx import Document

PATH = r"D:\AIGC\deliverables\项目文档-初稿.docx"

ROW = [
    "smoke-edge.mjs",
    "边界：23:59 的假固定日程、一次性课程活动、已过去的时间不被排期",
    "无时间倒挂、无漏排",
]


def main() -> int:
    try:
        stream = open(PATH, "r+b")
        stream.close()
    except OSError:
        print("LOCKED: 文档正被 Word 打开，关掉后再运行", file=sys.stderr)
        return 2

    doc = Document(PATH)

    table = None
    for t in doc.tables:
        if [c.text.strip() for c in t.rows[0].cells][:1] == ["脚本"]:
            table = t
            break

    if table is None:
        print("没找到「脚本」表", file=sys.stderr)
        return 1

    if any("smoke-edge" in c.text for row in table.rows for c in row.cells):
        print("已经存在，跳过")
        return 0

    template = table.rows[-1]
    new_tr = copy.deepcopy(template._tr)
    table._tbl.append(new_tr)

    row = table.rows[-1]
    for cell, text in zip(row.cells, ROW):
        for extra in cell.paragraphs[1:]:
            extra._element.getparent().remove(extra._element)
        para = cell.paragraphs[0]
        if para.runs:
            para.runs[0].text = text
            for run in para.runs[1:]:
                run.text = ""
        else:
            para.add_run(text)

    tmp = PATH + ".tmp"
    doc.save(tmp)
    shutil.move(tmp, PATH)
    print(f"已追加，表格现有 {len(table.rows) - 1} 行数据")
    return 0


sys.exit(main())
