# -*- coding: utf-8 -*-
"""把「截图识别」同步进项目文档：只改相关段落与表格，其余内容原样保留。"""

import copy
import shutil
import sys

from docx import Document

PATH = r"D:\AIGC\deliverables\项目文档-初稿.docx"


def set_cell(cell, text: str) -> None:
    for extra in cell.paragraphs[1:]:
        extra._element.getparent().remove(extra._element)
    para = cell.paragraphs[0]
    if para.runs:
        para.runs[0].text = text
        for run in para.runs[1:]:
            run.text = ""
    else:
        para.add_run(text)


def set_paragraph(para, text: str) -> None:
    for extra in para.runs[1:]:
        extra.text = ""
    if para.runs:
        para.runs[0].text = text
    else:
        para.add_run(text)


def find_table(doc, first_header: str):
    for t in doc.tables:
        if t.rows[0].cells[0].text.strip() == first_header:
            return t
    return None


def main() -> int:
    try:
        stream = open(PATH, "r+b")
        stream.close()
    except OSError:
        print("LOCKED: 文档正被占用", file=sys.stderr)
        return 2

    shutil.copy(PATH, PATH + ".bak")
    doc = Document(PATH)
    changed = []

    # ① 第七章局限：课表识别已实现
    for para in doc.paragraphs:
        if para.text.startswith("课表为预置示例"):
            set_paragraph(
                para,
                "课表识别已支持截图导入，但只对清晰的电子课表可靠；手写、歪拍、复杂合并单元格仍会出错。"
                "真实落地还需要教务系统导出接口做兜底。",
            )
            changed.append("局限·课表识别")
            break

    # ② 功能范围：补两行截图识别，P2 收窄
    scope = find_table(doc, "优先级")
    if scope is not None:
        p2_index = None
        for idx, row in enumerate(scope.rows):
            if row.cells[0].text.strip() == "P2":
                p2_index = idx
                break
        if p2_index is not None:
            template = scope.rows[p2_index]._tr
            for _ in range(2):
                template.addprevious(copy.deepcopy(template))
            set_cell(scope.rows[p2_index].cells[0], "P0")
            set_cell(scope.rows[p2_index].cells[1], "群通知截图识别（提取事项、时间、截止）")
            set_cell(scope.rows[p2_index].cells[2], "已完成")
            set_cell(scope.rows[p2_index + 1].cells[0], "P1")
            set_cell(scope.rows[p2_index + 1].cells[1], "课表截图识别（节次自动换算成具体时间）")
            set_cell(scope.rows[p2_index + 1].cells[2], "已完成")
            set_cell(scope.rows[p2_index + 2].cells[1], "云同步、多人协作、接入教务系统")
            changed.append("功能范围·截图识别两行")

    # ③ 三次模型调用：补一行视觉识别
    calls = find_table(doc, "调用")
    if calls is not None:
        template = calls.rows[-1]._tr
        template.addprevious(copy.deepcopy(template))
        row = calls.rows[-1]
        set_cell(row.cells[0], "V1/V2 视觉识别")
        set_cell(row.cells[1], "截图 + 当前日期")
        set_cell(row.cells[2], "活动列表 / 课程列表 JSON")
        set_cell(row.cells[3], "看不清不许编造；节次按固定作息换算；只输出 JSON")
        changed.append("技术路径·视觉调用")

    # ④ 技术栈：模型行补视觉模型
    stack = find_table(doc, "层")
    if stack is not None:
        for row in stack.rows:
            if row.cells[0].text.strip() == "模型":
                set_cell(row.cells[1], "DeepSeek V3（deepseek-chat）+ 视觉（deepseek-flash）")
                set_cell(row.cells[2], "国内直连、中文理解好、成本极低；截图识别用同一家的视觉模型，同一个 key")
                changed.append("技术栈·模型行")
                break

    # ⑤ 附录 D：补一条迭代记录
    iterations = find_table(doc, "问题")
    if iterations is not None:
        if not any("截图识别" in c.text for row in iterations.rows for c in row.cells):
            template = iterations.rows[-1]._tr
            template.addprevious(copy.deepcopy(template))
            row = iterations.rows[-1]
            set_cell(row.cells[0], "课表只能靠预置示例，演示不真实")
            set_cell(row.cells[1], "手工录入 10 门课不现实，前期把它划在范围外")
            set_cell(row.cells[2], "接入 deepseek-flash 视觉模型，节次按固定作息换算成时间")
            set_cell(row.cells[3], "10 门课全部识别正确，排期自动避开")
            changed.append("附录D·截图识别")

    tmp = PATH + ".tmp"
    doc.save(tmp)
    shutil.move(tmp, PATH)
    print("已更新：", "；".join(changed) if changed else "无")
    return 0


sys.exit(main())
