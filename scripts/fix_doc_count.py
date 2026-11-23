# -*- coding: utf-8 -*-
"""把附录 E 里的「五个回归脚本」改成「六个」。只改这一处，不碰其他内容。"""

import shutil
import sys

from docx import Document

PATH = r"D:\AIGC\deliverables\项目文档-初稿.docx"


def main() -> int:
    try:
        stream = open(PATH, "r+b")
        stream.close()
    except OSError:
        print("LOCKED: 文档正被 Word 打开，关掉后再运行", file=sys.stderr)
        return 2

    doc = Document(PATH)
    changed = 0

    for para in doc.paragraphs:
        if "回归脚本" not in para.text or "五个" not in para.text:
            continue
        for run in para.runs:
            if "五个" in run.text:
                run.text = run.text.replace("五个", "六个")
                changed += 1
        if changed == 0 and para.runs:
            # 文字被拆在多个 run 里时，合并到第一个 run，保留其字体
            merged = para.text.replace("五个", "六个")
            para.runs[0].text = merged
            for run in para.runs[1:]:
                run.text = ""
            changed += 1

    if not changed:
        print("没找到需要修改的句子（可能已经改过）")
        return 0

    tmp = PATH + ".tmp"
    doc.save(tmp)
    shutil.move(tmp, PATH)
    print(f"已修改 {changed} 处")
    return 0


sys.exit(main())
