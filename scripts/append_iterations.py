# -*- coding: utf-8 -*-
"""在已有文档的「附录 D 迭代优化记录」表格末尾追加三行。

只做追加，不改动用户已经手动编辑过的其他内容：
复制最后一行的 XML，替换文字，因此字体、列宽、边框都与原表一致。
"""

import copy
import shutil
import sys

from docx import Document

PATH = r"D:\AIGC\deliverables\项目文档-初稿.docx"

ROWS = [
    [
        "计划里出现 23:59–23:00 的时间倒挂",
        "只有日期的活动被填成 23:59，又被判为固定日程",
        "提示词增加“无法确定时刻则 fixed=false”；引擎对 23:59 的固定日程退回普通任务",
        "时间倒挂消失，考试被正常排进当晚空档",
    ],
    [
        "社团培训没有出现在排期里",
        "一次性活动被解析成 course，而排期把 course 整体排除",
        "只排除“没有截止时间的 course”，有截止时间的一次性活动参与排期",
        "三类活动都能进计划",
    ],
    [
        "任务被排到当天已经过去的时间",
        "排期起点固定为 08:00，没有考虑当前时刻",
        "当天的可用区间从当前时间向上取整 15 分钟开始",
        "刷新后不会出现“早八点写作业”",
    ],
]


def main() -> int:
    doc = Document(PATH)

    table = None
    for t in doc.tables:
        header = [c.text.strip() for c in t.rows[0].cells]
        if header[:2] == ["问题", "原因"]:
            table = t
            break

    if table is None:
        print("没找到「问题 / 原因」表", file=sys.stderr)
        return 1

    existing = [c.text.strip() for c in table.rows[-1].cells]
    if existing[0].startswith("任务被排到当天"):
        print("三行已经存在，跳过")
        return 0

    template = table.rows[-1]
    for data in ROWS:
        new_tr = copy.deepcopy(template._tr)
        table._tbl.append(new_tr)
        row = table.rows[-1]
        for cell, text in zip(row.cells, data):
            paragraphs = cell.paragraphs
            for extra in paragraphs[1:]:
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
    print(f"已追加 {len(ROWS)} 行，表格现有 {len(table.rows) - 1} 条记录")
    return 0


sys.exit(main())
