with open("myjobsinkenya_home.html", "r", encoding="utf-8") as f:
    html = f.read()

from scrapy.selector import Selector
sel = Selector(text=html)

print("Title:", sel.css("title::text").get())

job_links = sel.xpath("//a[contains(@href, '/job/')]")
print(f"Total /job/ links: {len(job_links)}")
for i, a in enumerate(job_links):
    href = a.attrib.get("href")
    text = " ".join(a.css("*::text").getall()).strip()
    print(f"{i+1}: Text: {repr(text)} | Href: {href}")

print("\nChecking for potential tab panes or job lists:")
for div in sel.css("div[id]"):
    div_id = div.attrib.get("id")
    if "job" in div_id.lower() or "tab" in div_id.lower() or div_id == "home":
        print(f"Div ID: {div_id} | Class: {div.attrib.get('class')} | Sub-divs/lists count: {len(div.css('*'))}")

print("\nChecking all forms:")
for form in sel.css("form"):
    action = form.attrib.get("action")
    method = form.attrib.get("method")
    inputs = [f"{i.attrib.get('name')}:{i.attrib.get('type')}" for i in form.css("input")]
    print(f"Form Action: {action} | Method: {method} | Inputs: {inputs}")
