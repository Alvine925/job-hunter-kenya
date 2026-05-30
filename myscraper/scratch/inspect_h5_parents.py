from scrapy.selector import Selector

with open("job_detail.html", "r", encoding="utf-8") as f:
    html = f.read()

sel = Selector(text=html)

for i, h5 in enumerate(sel.css("h5.font-weight-bold.text-dark.mb-1.mt-0")):
    print(f"\n--- H5 {i+1} ---")
    print(h5.get())
    parent = h5.xpath("parent::*/parent::*")
    if parent:
        print("Grandparent HTML:")
        print(parent[0].get()[:500])
