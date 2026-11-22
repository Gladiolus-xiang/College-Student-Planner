from docx import Document

path = r"D:\AIGC\deliverables\项目文档-初稿.docx"
doc = Document(path)

headings = [(p.style.name, p.text) for p in doc.paragraphs if p.style.name.startswith("Heading")]
print("sections:", len(doc.sections))
print("paragraphs:", len(doc.paragraphs))
print("tables:", len(doc.tables))
print("headings:")
for style, text in headings:
    print("  ", style, "|", text)

chars = sum(len(p.text) for p in doc.paragraphs)
for table in doc.tables:
    for row in table.rows:
        for cell in row.cells:
            chars += len(cell.text)
print("total chars:", chars)
