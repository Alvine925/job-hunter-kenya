with open("myjobsinkenya_home.html", "r", encoding="utf-8") as f:
    html = f.read()

from scrapy.selector import Selector
sel = Selector(text=html)

print("Links containing 'search':")
for a in sel.css("a"):
    href = a.attrib.get("href") or ""
    text = " ".join(a.css("*::text").getall()).strip()
    if "search" in href.lower() or "search" in text.lower():
        print(f"  Text: '{text}' | Href: '{href}'")

print("\nForm actions:")
for form in sel.css("form"):
    print("  Action:", form.attrib.get("action"), "Method:", form.attrib.get("method"))
