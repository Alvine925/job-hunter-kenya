from scrapy.selector import Selector

with open("job_detail.html", "r", encoding="utf-8") as f:
    html = f.read()

sel = Selector(text=html)

for i, box in enumerate(sel.css("div.box.shadow-sm.border.rounded.bg-white.mb-3")[:4]):
    print(f"\n--- BOX {i+1} HTML ---")
    print(box.get()[:1000])
    print("-" * 50)
