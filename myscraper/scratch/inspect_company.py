from scrapy.selector import Selector

with open("job_detail.html", "r", encoding="utf-8") as f:
    html = f.read()

sel = Selector(text=html)

# Let's search for "My Jobs In Kenya" or similar in all elements to see where it appears.
print("=== Elements containing 'My Jobs In Kenya' or 'company' ===")
for el in sel.xpath("//*[contains(text(), 'My Jobs In Kenya')]"):
    tag = el.root.tag
    cls = el.root.attrib.get("class", "")
    text = "".join(el.css("*::text").getall()).strip()
    print(f"Tag={tag} | Class={cls} | Text='{text}'")

print("\n=== All h4, h5, h6 tags ===")
for h in sel.css("h4, h5, h6"):
    text = "".join(h.css("*::text").getall()).strip()
    print(f"Tag={h.root.tag} | Class={h.root.attrib.get('class', '')} | Text='{text}'")
