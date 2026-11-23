# -*- coding: utf-8 -*-
"""按文档中图片的先后顺序，把两张图各自换回正确内容：
   第 1 张 = 闭环图（3.2 节），第 2 张 = 架构图（4.1 节）。
"""

import hashlib
import shutil
import sys

from docx import Document

PATH = r"D:\AIGC\deliverables\项目文档-初稿.docx"
ASSETS = r"D:\AIGC\deliverables\assets"
ORDER = ["闭环图.png", "架构图.png"]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    try:
        stream = open(PATH, "r+b")
        stream.close()
    except OSError:
        print("LOCKED", file=sys.stderr)
        return 2

    doc = Document(PATH)
    if len(doc.inline_shapes) < len(ORDER):
        print("图片数量不足", file=sys.stderr)
        return 1

    changed = 0
    for idx, name in enumerate(ORDER):
        data = open(f"{ASSETS}\\{name}", "rb").read()
        rid = doc.inline_shapes[idx]._inline.graphic.graphicData.pic.blipFill.blip.embed
        part = doc.part.related_parts[rid]
        if sha(part.blob) == sha(data):
            print(f"{idx}: {name} 已是最新")
            continue
        print(f"{idx}: {name} {len(part.blob)} -> {len(data)}")
        part._blob = data
        changed += 1

    if not changed:
        print("无需修改")
        return 0

    tmp = PATH + ".tmp"
    doc.save(tmp)
    shutil.move(tmp, PATH)

    check = Document(PATH)
    for idx, name in enumerate(ORDER):
        data = open(f"{ASSETS}\\{name}", "rb").read()
        rid = check.inline_shapes[idx]._inline.graphic.graphicData.pic.blipFill.blip.embed
        ok = sha(check.part.related_parts[rid].blob) == sha(data)
        print(f"校验 {idx} {name}: {'通过' if ok else '失败'}")
    return 0


sys.exit(main())
