from scrapy.selector import Selector

with open("job_detail.html", "r", encoding="utf-8") as f:
    html = f.read()

sel = Selector(text=html)

print("=== Looking at tables and metadata ===")
for table in sel.css("table"):
    print("\nTable Class:", table.attrib.get("class"))
    for tr in table.css("tr"):
        row_text = []
        for cell in tr.css("th, td"):
            cell_text = " ".join(cell.css("*::text").getall()).strip()
            row_text.append(cell_text)
        print("  Row:", row_text)
