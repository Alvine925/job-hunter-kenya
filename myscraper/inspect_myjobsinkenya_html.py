with open("myjobsinkenya_list.html", "r", encoding="utf-8") as f:
    html = f.read()

from scrapy.selector import Selector
from myscraper.utils import clean_text

sel = Selector(text=html)

# Let's inspect the page content:
print("Page Title:", sel.css("title::text").get())

print("\nAll links on the page (first 30):")
for a in sel.css("a"):
    href = a.attrib.get("href") or ""
    text = " ".join(a.css("*::text").getall()).strip()
    if href:
        print(f"  Text: '{text}' | Href: '{href}'")
