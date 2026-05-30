from scrapy.selector import Selector

with open("job_detail.html", "r", encoding="utf-8") as f:
    html = f.read()

sel = Selector(text=html)

print("Title:", sel.css("title::text").get())

# Let's print out all headers (h1, h2, h3, h4, h5, h6)
print("\nHeaders:")
for h in sel.css("h1, h2, h3, h4, h5, h6"):
    text = " ".join(h.css("*::text").getall()).strip()
    print(f"  {h.root.tag}: {text}")

# Let's print out all links containing /company/ or company name classes
print("\nCompany-related elements:")
for a in sel.css("a"):
    href = a.attrib.get("href") or ""
    if "company" in href or "company" in (a.attrib.get("class") or ""):
        text = " ".join(a.css("*::text").getall()).strip()
        print(f"  Link: Href={href} | Class={a.attrib.get('class')} | Text='{text}'")

# Let's search for divs with classes containing job
print("\nDivs containing job or content in their class:")
for div in sel.css("div"):
    cls = div.attrib.get("class") or ""
    if any(k in cls.lower() for k in ["job", "detail", "content", "description", "post"]):
        # print first 100 chars of the text inside
        text = " ".join(div.css("*::text").getall()).strip()
        if text:
            print(f"  Class={cls} | Text (first 100 chars): '{text[:100]}'")

# Let's print all list items (li) to find metadata
print("\nList items:")
for li in sel.css("li"):
    text = " ".join(li.css("*::text").getall()).strip()
    if text:
        print(f"  LI: '{text}'")

# Let's check for any iframe or other main content structure
print("\nBody/Article tag structures:")
for tag in ["article", "main", "body"]:
    el = sel.css(tag)
    if el:
        print(f"  Tag: {tag} exists, class: {el.attrib.get('class')}")
