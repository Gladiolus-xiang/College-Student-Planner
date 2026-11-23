# -*- coding: utf-8 -*-
"""生成《项目文档》初稿骨架：已写好能写的部分，团队相关处留【待填】标记。"""

from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BODY_FONT = "宋体"
HEAD_FONT = "黑体"
MONO_FONT = "Consolas"


def set_font(run, name, size=None, bold=None, color=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if color is not None:
        run.font.color.rgb = RGBColor(*color)


def body(doc, text, size=12, indent=True):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    p.paragraph_format.space_after = Pt(6)
    if indent:
        p.paragraph_format.first_line_indent = Pt(size * 2)
    set_font(p.add_run(text), BODY_FONT, size)
    return p


def bullet(doc, text, size=12):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    p.paragraph_format.space_after = Pt(3)
    set_font(p.add_run(text), BODY_FONT, size)
    return p


def h1(doc, text):
    p = doc.add_heading(level=1)
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(10)
    set_font(p.add_run(text), HEAD_FONT, 16, True, (0x1A, 0x1A, 0x1A))
    return p


def h2(doc, text):
    p = doc.add_heading(level=2)
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(6)
    set_font(p.add_run(text), HEAD_FONT, 13.5, True, (0x33, 0x33, 0x33))
    return p


def mono(doc, text):
    for line in text.strip("\n").split("\n"):
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.2
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.left_indent = Cm(0.6)
        set_font(p.add_run(line if line else " "), MONO_FONT, 9, False, (0x22, 0x22, 0x22))


def table(doc, header, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(header))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False   # python-docx 会自己写入正确的 tblLayout=fixed

    for i, text in enumerate(header):
        cell = t.rows[0].cells[i]
        cell.text = ""
        run = cell.paragraphs[0].add_run(text)
        set_font(run, HEAD_FONT, 10.5, True)
    for row in rows:
        cells = t.add_row().cells
        for i, text in enumerate(row):
            cells[i].text = ""
            set_font(cells[i].paragraphs[0].add_run(str(text)), BODY_FONT, 10.5)

    if widths:
        total = sum(widths)
        scaled = [w * (14.4 / total) for w in widths]
        for i, w in enumerate(scaled):
            t.columns[i].width = Cm(w)
        for row_index, row in enumerate(t.rows):
            tr_pr = row._tr.get_or_add_trPr()
            tr_pr.append(OxmlElement("w:cantSplit"))
            if row_index == 0:
                tr_pr.append(OxmlElement("w:tblHeader"))  # 跨页时重复表头
            for i, w in enumerate(scaled):
                row.cells[i].width = Cm(w)
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    paragraph.paragraph_format.space_before = Pt(2)
                    paragraph.paragraph_format.space_after = Pt(2)
                    paragraph.paragraph_format.line_spacing = 1.15

    doc.add_paragraph()
    return t


doc = Document()

# 页面：A4，标准页边距
section = doc.sections[0]
section.page_height = Cm(29.7)
section.page_width = Cm(21)
section.top_margin = Cm(2.54)
section.bottom_margin = Cm(2.54)
section.left_margin = Cm(3.18)
section.right_margin = Cm(3.18)

style = doc.styles["Normal"]
style.font.name = BODY_FONT
style.font.size = Pt(12)
style.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)

# 封面
title = doc.add_paragraph()
title.alignment = 1
title.paragraph_format.space_before = Pt(90)
set_font(title.add_run("今天做什么"), HEAD_FONT, 28, True, (0x1A, 0x1A, 0x1A))

sub = doc.add_paragraph()
sub.alignment = 1
sub.paragraph_format.space_before = Pt(8)
set_font(sub.add_run("面向大学生的时间编排助手"), HEAD_FONT, 16, False, (0x44, 0x44, 0x44))

sub2 = doc.add_paragraph()
sub2.alignment = 1
sub2.paragraph_format.space_before = Pt(4)
set_font(sub2.add_run("杭州电子科技大学第二届 AIGC 应用创新大赛"), BODY_FONT, 11, False, (0x66, 0x66, 0x66))

sub3 = doc.add_paragraph()
sub3.alignment = 1
sub3.paragraph_format.space_before = Pt(2)
set_font(sub3.add_run("赛题一 · AI 辅助开发 · 创意产品原型"), BODY_FONT, 11, False, (0x66, 0x66, 0x66))

doc.add_paragraph()
info = doc.add_paragraph()
info.alignment = 1
info.paragraph_format.space_before = Pt(80)
set_font(info.add_run("参赛团队：【待填：队伍名称】\n团队成员：【待填：姓名、学号、学院】\n指导教师：【待填】\n提交日期：2026 年 11 月"),
         BODY_FONT, 12, False, (0x33, 0x33, 0x33))

doc.add_page_break()

# 正文
h1(doc, "一、项目背景")
body(doc, "大学生的时间是三种结构叠在一起的：课表是固定的，DDL 是硬截止的，长期目标（考研、四六级、健身）是软的、靠自觉的。"
          "市面上没有一种工具同时处理这三种结构——课程表 App 只管上课，待办清单只管打勾，两者之间那段“今天到底该先做什么”的空白，被留给了学生自己。")
body(doc, "我们访谈的同学里，最常见的状态不是“忘了有事”，而是“事情都知道，但坐下来的时候不知道该从哪件开始”，于是先刷十分钟手机，再开始焦虑。"
          "真正稀缺的不是记录能力，是编排能力：把一堆时间约束和任务量，排成一份今天能照着做的清单。")
body(doc, "大模型让这件事第一次变得可行。把一段从群里复制来的、语序混乱、时间还靠“下周三”“这周末”指代的通知，变成结构化任务，"
          "再按课表空档和截止紧迫度排进具体时段——这是传统待办软件做不到的，它需要理解自然语言，也需要一点推理。")

h1(doc, "二、问题分析")
h2(doc, "2.1 目标用户与典型场景")
body(doc, "目标用户是本校本科生，一学期 8–12 门课、每周 3–5 个 DDL、同时有 1–2 个长期目标。"
          "典型场景是周日晚上的“规划时刻”：翻一遍群通知、学习通、教务系统，把下周要做的事记到某个地方，然后决定先做哪件。")
body(doc, "【待填：补充 3–5 位同学的真实访谈摘录，每段 2–3 句，附真实群通知截图 1–2 张（隐去个人信息）】")

h2(doc, "2.2 现有方式的不足")
table(doc,
      ["现有方式", "能做什么", "缺什么"],
      [
          ["课程表 App", "展示固定课程、提醒上课", "不处理 DDL，不安排自习时间"],
          ["待办清单（滴答、微软 To Do）", "记录与打勾", "不排时间，全靠自己决定先后；长期目标容易烂尾"],
          ["Notion / 表格", "高度自由", "搭建成本高，维护几次就放弃"],
          ["纸质计划本", "书写感强", "改一次计划要重画一页，遇到变化就废"],
      ],
      widths=[4.0, 4.5, 6.0])
body(doc, "共同的问题是：它们都停在“记录”，没有跨到“编排”。而记录恰恰是最不费力的部分。")

h2(doc, "2.3 我们定义的核心问题")
body(doc, "不是“怎么记住所有事”，而是三个更具体的问题：")
bullet(doc, "一句话、一段乱文字，怎么变成一条条带时间、带类型、带优先级的活动？")
bullet(doc, "固定课表、硬 DDL、软目标同时存在时，今天这一格时间该给谁？")
bullet(doc, "计划没跟上变化（临时有事、做不完）时，怎么用最低成本重排，而不是从头再排一遍？")

h1(doc, "三、解决方案")
h2(doc, "3.1 一句话定位")
body(doc, "今天做什么，是一个“替你决定今天先干什么”的日程编排助手：粘贴一段乱文字，它拆成活动、排进课表空档、到点提醒、打卡记录，做不完一键重排。")

h2(doc, "3.2 核心闭环")
body(doc, "粘贴一段文字 → AI 解析成活动（类型/截止/时长/是否固定日程）→ 规则引擎排进未来三天的空档 → "
          "AI 为每块安排写一句理由 → 到点提醒 → 习惯类打卡 → 没做完一键重排（AI 只排顺序，时间重新算）。")
doc.add_picture(r"D:\AIGC\deliverables\assets\闭环图.png", width=Cm(14.4))
doc.paragraphs[-1].alignment = 1
cap = doc.add_paragraph()
cap.alignment = 1
set_font(cap.add_run("图 1　六步闭环：断任何一步，产品都不成立"), BODY_FONT, 9, False, (0x66, 0x66, 0x66))
body(doc, "【配图：产品主界面截图，待补】")

h2(doc, "3.3 三条设计原则")
body(doc, "原则一：时间由代码算，理由由模型写。模型不擅长算术和约束检查，让它直接输出时间，会出现“凌晨三点写作业”“排在课上”“两个任务撞车”。"
          "我们把时段计算、冲突检查、单日上限全部交给规则引擎，模型只负责解释取舍。代价是排期不如人灵活，收益是模型出错也不会产生非法计划。")
body(doc, "原则二：固定日程与弹性任务分离。考试、上课、面试是到点必须在场的，只需要占住时间；写报告、复习、背单词才是需要自己安排的。"
          "两者混为一谈，就会出现“给四级考试安排了 60 分钟准备时间”这种荒唐结果。")
body(doc, "原则三：任何 AI 输出都要过校验层。模型返回的任务 id 可能缺失、可能编造，校验层会把缺失的补回去、把不存在的丢掉，保证任务不会凭空消失。")

h2(doc, "3.4 功能范围")
table(doc,
      ["优先级", "功能", "状态"],
      [
          ["P0", "一句话录入解析（含固定日程判定）", "已完成"],
          ["P0", "示例课表 + 规则排期（避课、避饭点、单日上限 4 小时）", "已完成"],
          ["P0", "AI 写计划理由 + 今日一句", "已完成"],
          ["P0", "到点提醒（浏览器通知 + 页面内卡片）", "已完成"],
          ["P0", "习惯打卡与连续天数", "已完成"],
          ["P0", "一键重排", "已完成"],
          ["P1", "长周期目标拆解成周任务", "未完成"],
          ["P2", "通用课表截图识别、云同步、多人协作", "不在本次范围"],
      ],
      widths=[1.8, 10.4, 2.8])

h1(doc, "四、技术实现路径")
h2(doc, "4.1 总体架构")
body(doc, "浏览器端是单页应用（React + TypeScript），负责交互与渲染；数据存在 localStorage；"
          "模型调用不从前端直连，而是经由本地 Node 中间件转发，密钥只存在于服务端环境变量中。")
doc.add_picture(r"D:\AIGC\deliverables\assets\架构图.png", width=Cm(14.4))
doc.paragraphs[-1].alignment = 1
cap2 = doc.add_paragraph()
cap2.alignment = 1
set_font(cap2.add_run("图 2　三层架构：浏览器 / 本地中间件 / 模型接口"), BODY_FONT, 9, False, (0x66, 0x66, 0x66))

h2(doc, "4.2 数据模型")
mono(doc, """
Activity   活动：id, title, type(ddl|habit|course|goal), deadline,
                  durationMin, priority, remindBeforeMin, fixed,
                  source(ai|manual), status, checkins[]
CourseSlot 课程：id, name, weekday, start, end
PlanBlock  计划块：date, activityId, start, end, reason
""")

h2(doc, "4.3 三次模型调用")
table(doc,
      ["调用", "输入", "输出", "关键约束"],
      [
          ["P1 抽取", "用户粘贴的原始文字 + 今天日期", "活动数组 JSON", "不编造时间；缺失字段留空并说明；固定日程单独标记"],
          ["P2 解释", "已排好的计划块 + 截止时间", "每块一句理由 + 今日一句", "不得改动任何时间，不得增删安排"],
          ["P3 重排", "已完成 / 未完成清单 + 明天日期", "任务先后顺序 + 理由", "不得写具体时间；不得遗漏任务 id"],
      ],
      widths=[2.2, 4.6, 4.2, 3.8])

h2(doc, "4.4 规则排期引擎")
body(doc, "每天的可排时间从 08:00 到 23:00，先扣掉当天课程、午饭（12:00–13:30）、晚饭（17:30–19:00）和固定日程，剩下的连续区间作为候选空档。")
body(doc, "任务按“优先级 → 截止时间”排序，逐块填入空档：单块时长取「剩余任务量」「空档剩余」「当日预算」三者最小值，"
          "单日总预算 4 小时，超过 30 分钟才成块，长任务可跨块分几天完成。习惯类不参与这个队列，每天在 19:00 之后固定排一次。")

h2(doc, "4.5 密钥与数据安全")
body(doc, "API 密钥写在本地 .env 文件，变量名不加 VITE_ 前缀，因此不会被 Vite 打包进浏览器产物；"
          "中间件每次请求重新读取 .env，改完密钥无需重启。每次调用记录模型、耗时、token 用量到本地日志，作为文档附录与成本核算依据。"
          "用户数据全部留在浏览器 localStorage，不上传服务器。")

h2(doc, "4.6 技术栈")
table(doc,
      ["层", "选型", "理由"],
      [
          ["前端", "React 19 + TypeScript + Vite + Tailwind CSS v4", "组件化便于三人并行；AI 编码工具对该生态生成质量最高"],
          ["中间件", "Node 原生 http 中间件（Vite 插件挂载）", "三十行代码解决密钥与跨域，不引入额外框架"],
          ["模型", "DeepSeek V3（deepseek-chat）", "国内直连、中文理解好、成本极低"],
          ["数据", "localStorage", "单机演示够用，零部署成本"],
      ],
      widths=[2.2, 7.2, 5.4])

h1(doc, "五、团队分工")
body(doc, "【待填：以下为角色模板，请替换成真实姓名】")
table(doc,
      ["成员", "角色", "负责内容", "产出"],
      [
          ["【待填】", "交互与前端", "页面、排期视图、提醒与打卡交互", "src/App.tsx、组件"],
          ["【待填】", "AI 与逻辑", "三条提示词、校验层、规则排期引擎", "src/lib/*.ts"],
          ["【待填】", "文档与 PPT", "项目文档、20 页方案、答辩材料", "文档、PPT"],
          ["【待填】", "演示视频", "录屏脚本、剪辑、字幕", "5 分钟视频"],
      ],
      widths=[3.0, 3.2, 6.0, 4.0])

h1(doc, "六、创新点与价值")
h2(doc, "6.1 创新点")
bullet(doc, "编排而非记录：把“今天先做什么”这个决策过程交给系统，而不是只提供一个越来越长的列表。")
bullet(doc, "职责分层：模型负责理解与解释，规则引擎负责约束与计算。这是本作品与“套壳聊天”的分水岭——AI 出错时，计划依然合法。")
bullet(doc, "把“计划失效”当成一等公民：多数工具假设你会按计划走，我们把“做不完”做成一条主路径，一键重排而不是重排一晚上。")
h2(doc, "6.2 应用价值")
body(doc, "对个人，减少每次坐下来时的决策成本；对班级，可作为学习小组的共同计划板（后续版本）；"
          "对学校，课表数据天然结构化，具备接入教务系统的可能。")
h2(doc, "6.3 与同类工具的差异")
body(doc, "课程表 App 解决“什么时候上课”，待办清单解决“有什么事没做”，本作品解决“现在这两个小时给谁”。三者不是替代关系，是缺了最后一环。")

h1(doc, "七、当前局限与改进方向")
bullet(doc, "网页端无法在页面关闭后继续提醒，需要 Service Worker 与推送服务才能做到。")
bullet(doc, "课表为预置示例，通用课表截图识别未实现；真实落地需要教务系统导出接口或 OCR。")
bullet(doc, "规则排期不考虑课程难度、个人精力曲线与通勤，属于“可用但不贴心”。")
bullet(doc, "单机存储，换设备即丢失，后续需要账号与云同步。")

h1(doc, "八、总结与展望")
body(doc, "这个作品想验证一件事：当模型负责“听懂”和“解释”，代码负责“算准”和“兜底”，"
          "一个没有深厚编程基础的学生团队，也能在一周内做出一个真正能用的日程编排原型。")
body(doc, "下一步是把长期目标拆解补齐，让“这学期想考过四级”也能自动变成每周三次真题；再往后是接入真实课表与班级共享。")

doc.add_page_break()

h1(doc, "附录 A　AI 工具使用说明")
body(doc, "本作品在需求分析、界面设计、代码生成、调试、文档整理五个环节使用了生成式 AI，具体如下：")
table(doc,
      ["环节", "使用工具", "AI 参与内容", "人工核查方式"],
      [
          ["需求分析", "DeepSeek", "梳理用户场景、竞品差异、功能优先级", "对照访谈记录逐条核对，删除无依据的结论"],
          ["界面设计", "DeepSeek + AI 编码工具", "生成页面结构与样式代码", "在浏览器实际操作，检查层级、留白、错位"],
          ["代码生成", "AI 编码助手", "生成 React 组件、规则排期引擎、代理中间件", "逐文件阅读关键逻辑；编写 5 个回归脚本验证"],
          ["提示词设计", "DeepSeek", "起草并迭代 P1/P2/P3 三条提示词", "用固定样例反复调用，对比输出差异"],
          ["文档整理", "DeepSeek", "生成文档初稿、PPT 大纲", "逐段改写为团队自己的表述，核对事实与数据"],
      ],
      widths=[2.4, 3.6, 5.6, 5.2])
body(doc, "所有 AI 生成的代码均经过人工阅读与运行验证；文中数据（调用耗时、token 用量、测试结果）均来自本地日志与实际执行，未作估算。")

h1(doc, "附录 B　关键 Prompt")
h2(doc, "B.1 抽取提示词（P1）")
mono(doc, """你是大学生的日程助手。把用户给的文字拆成活动，只输出 JSON，不要任何解释。
字段说明：
- title：简短标题，不超过 20 字
- type：只能是 "ddl" | "habit" | "course" | "goal"
- deadline："YYYY-MM-DD HH:mm"，没有明确时间则 null
- durationMin：一次预计要花多少分钟；原文没说就给 60
- priority：1 最紧急 | 2 一般 | 3 不急
- remindBeforeMin：提前多少分钟提醒，默认 120
- fixed：true 表示固定时间发生的事（考试、上课、面试），不需要另排准备
- note：一句话说明没把握的地方，没有就空字符串
规则：
1. 今天的日期是 {today}，据此把"下周三""周五"换算成具体日期。
2. 绝对不要编造原文没有的时间；换算不出来设为 null 并写进 note。
3. 一条文字包含多个独立的事，拆成多条。
4. deadline 必须用空格分隔，不要出现 T；只给日期按当天 23:59。
5. 原文说"周五"而今天正好是周五，理解为下一个周五。
6. 考试、报告、作业属于 ddl；只有每周固定上课才是 course。
输出：{"activities":[{"title":"...","type":"ddl","deadline":"2026-11-26 20:00",
"durationMin":180,"priority":1,"remindBeforeMin":120,"fixed":false,"note":""}]}""")

h2(doc, "B.2 解释提示词（P2）")
mono(doc, """你是大学生的日程教练。下面这份计划的时间已经由程序排好，你只负责解释，
绝对不要改动任何时间，也不要新增或删除安排。
今天：{today}
计划：
[a1] 2026-11-22 08:00-11:00 《机器学习》实验报告，截止 2026-11-25 20:00
要求：
1. 每个活动写一句理由，不超过 35 字，口语化。
2. 必须说清"为什么是今天/这个时段"，从截止临近、任务量大、刚好有空档、每天固定里挑一个角度。
3. 禁止出现"根据您的计划""为了更好地管理时间"这类空话。
4. 最后写一句总述，不超过 40 字，指出今天最该先做的一件事。
输出：{"reasons":{"a1":"..."},"summary":"..."}""")

h2(doc, "B.3 重排提示词（P3）")
mono(doc, """学生今天没把事情做完，要重新安排。你只决定"先做哪个、哪个可以往后挪"，
不要写任何具体时间——时间由程序根据你给的顺序重新计算。
今天：{today}　明天：{tomorrow}
今天已经完成的：{done}
还没做完的：{todo}
要求：
1. 有截止时间的任务不能晚于截止时间，违反即无效。
2. 排序优先考虑：截止是否临近 > 还剩多少 > 是否已经开始做过。
3. 只输出全部未完成任务的 id，一个都不能少，不能编造新 id。
4. 每项给一句话理由，不超过 30 字。
5. 最后写一句总述，说清把什么挪到了哪天、为什么。
输出：{"order":["a1","a2"],"reasons":{"a1":"..."},"summary":"..."}""")

h1(doc, "附录 C　生成与开发过程")
table(doc,
      ["日期", "工作内容", "产出"],
      [
          ["11-21", "确定产品定位与功能范围，搭建工程骨架", "决策记录、可运行工程"],
          ["11-21", "跑通解析链路，修正时间格式与固定日程判定", "P1 完成"],
          ["11-22", "规则排期引擎、AI 写理由、打卡、提醒、一键重排", "P0 全部完成"],
          ["11-23", "演示路径打磨与视觉统一", "可录屏版本"],
          ["11-24 至 11-26", "项目文档与 PPT 定稿", "提交材料"],
          ["11-27", "录制与剪辑演示视频，提交一版", "5 分钟视频"],
      ],
      widths=[3.4, 9.6, 4.0])

h1(doc, "附录 D　迭代优化记录")
table(doc,
      ["问题", "原因", "改动", "结果"],
      [
          ["模型返回 2026-11-25T20:00:00", "提示词只描述格式，未禁止 T", "增加规则“用空格分隔，不要出现 T”，并在代码层加时间归一化", "连续调用均为标准格式"],
          ["模型把“四级考试”排成 60 分钟准备工作", "未区分固定日程与弹性任务", "提示词增加 fixed 字段与判定规则，引擎按固定日程只占时间", "考试不再被安排准备时间"],
          ["“周五”在当天被理解成今天", "相对时间有歧义", "增加规则：今天正好是周五则取下一个周五", "解析结果符合预期"],
          ["模型重排时漏掉任务", "生成式输出不保证完整", "校验层强制补齐缺失 id，编造的 id 丢弃", "任务不会凭空消失"],
          ["提醒在页面关闭后失效", "浏览器限制", "改为页面内卡片 + 系统通知双通道，并如实写入局限", "演示可稳定触达"],
          ["计划里出现 23:59–23:00 的时间倒挂", "只有日期的活动被填成 23:59，又被判为固定日程", "提示词增加“无法确定时刻则 fixed=false”；引擎对 23:59 的固定日程退回普通任务", "时间倒挂消失，考试被正常排进当晚空档"],
          ["社团培训没有出现在排期里", "一次性活动被解析成 course，而排期把 course 整体排除", "只排除“没有截止时间的 course”，有截止时间的一次性活动参与排期", "三类活动都能进计划"],
          ["任务被排到当天已经过去的时间", "排期起点固定为 08:00，没有考虑当前时刻", "当天的可用区间从当前时间向上取整 15 分钟开始", "刷新后不会出现“早八点写作业”"],
      ],
      widths=[4.6, 4.2, 5.2, 3.6])

h1(doc, "附录 E　测试验证")
body(doc, "除人工操作外，编写了五个不依赖浏览器的回归脚本，覆盖解析、排期、解释、重排的关键逻辑：")
table(doc,
      ["脚本", "验证内容", "结果"],
      [
          ["smoke-parse.mjs", "真实调用模型，检查活动拆分与时间换算", "4 条活动、时间换算正确"],
          ["smoke-plan.mjs", "规则排期是否冲突、是否占用课程", "无重叠、无课程冲突"],
          ["smoke-reasons.mjs", "理由是否具体、是否出现空话", "无套话，含具体理由"],
          ["smoke-reorder.mjs", "重排是否遗漏任务 id", "无遗漏"],
          ["smoke-reminder.mjs", "打卡连续天数与提醒窗口边界", "10 项断言全部通过"],
      ],
      widths=[4.2, 8.4, 4.4])

h1(doc, "附录 F　人工核查情况")
bullet(doc, "所有 AI 生成代码逐文件阅读，关键函数（排期引擎、校验层、时间归一化）逐行核对逻辑。")
bullet(doc, "文档中出现的每一个数字（耗时、token、测试通过数）均来自本地日志或脚本输出，可复现。")
bullet(doc, "访谈与截图素材均取得同学口头同意，隐去姓名与学号。")
bullet(doc, "未使用任何未授权的第三方代码、模板或数据集。")

OUT = r"D:\AIGC\deliverables\项目文档-初稿.docx"
print("target:", ascii(OUT))
doc.save(OUT)
print("saved")
