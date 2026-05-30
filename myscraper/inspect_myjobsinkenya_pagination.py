with open("myjobsinkenya_home.html", "r", encoding="utf-8") as f:
    html = f.read()

from scrapy.selector import Selector
sel = Selector(text=html)

print("Pagination links:")
for a in sel.css("a"):
    href = a.attrib.get("href") or ""
    text = " ".join(a.css("*::text").getall()).strip()
    if "page" in href.lower() or "next" in href.lower() or "next" in text.lower():
        print(f"  Text: '{text}' | Href: '{href}'")
