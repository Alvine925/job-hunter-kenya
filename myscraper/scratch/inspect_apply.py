from scrapy.selector import Selector

with open("job_detail.html", "r", encoding="utf-8") as f:
    html = f.read()

sel = Selector(text=html)

print("=== Looking for Apply buttons/links/forms ===")
for a in sel.css("a"):
    text = " ".join(a.css("*::text").getall()).strip()
    href = a.attrib.get("href") or ""
    if "apply" in text.lower() or "apply" in href.lower():
        print(f"Link: Text='{text}' | Href='{href}' | Class='{a.attrib.get('class')}'")

for btn in sel.css("button"):
    text = " ".join(btn.css("*::text").getall()).strip()
    if "apply" in text.lower() or "submit" in text.lower():
        print(f"Button: Text='{text}' | Class='{btn.attrib.get('class')}' | ID='{btn.attrib.get('id')}'")

for form in sel.css("form"):
    action = form.attrib.get("action") or ""
    if "apply" in action.lower():
        print(f"Form: Action='{action}' | Method='{form.attrib.get('method')}'")
