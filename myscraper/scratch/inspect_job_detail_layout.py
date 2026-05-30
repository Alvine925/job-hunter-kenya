from scrapy.selector import Selector

with open("job_detail.html", "r", encoding="utf-8") as f:
    html = f.read()

sel = Selector(text=html)

print("=== H6 tags and their parents ===")
for h6 in sel.css("h6"):
    text = " ".join(h6.css("*::text").getall()).strip()
    parent = h6.xpath("parent::*")
    p_tag = parent[0].root.tag if parent else None
    p_class = parent[0].root.attrib.get("class") if parent else None
    print(f"H6 Text: '{text}' | Parent Tag: {p_tag} | Parent Class: {p_class}")
    # Print the immediate siblings of this H6
    siblings = h6.xpath("following-sibling::*[position()<=3]")
    for sib in siblings:
        sib_text = " ".join(sib.css("*::text").getall()).strip()
        print(f"  Sibling Tag: {sib.root.tag} | Class: {sib.root.attrib.get('class')} | Text (first 100): '{sib_text[:100]}'")

print("\n=== H6 boxes and content ===")
for h6 in sel.css("h6"):
    text = " ".join(h6.css("*::text").getall()).strip()
    # Go up to the parent wrapper box (e.g. grandparent or parent)
    parent = h6.xpath("parent::*")
    p_el = parent[0] if parent else None
    
    grandparent = h6.xpath("parent::*/parent::*")
    gp_el = grandparent[0] if grandparent else None
    
    gp_tag = gp_el.root.tag if gp_el else None
    gp_class = gp_el.root.attrib.get("class") if gp_el else None
    
    print(f"\nH6: '{text}'")
    print(f"  Parent: <{p_el.root.tag} class='{p_el.root.attrib.get('class')}'>")
    print(f"  Grandparent: <{gp_tag} class='{gp_class}'>")
    
    # Let's print the entire text inside the grandparent box (first 300 chars)
    gp_text = " ".join(gp_el.css("*::text").getall()).strip() if gp_el else ""
    print(f"  Box Text (300 chars): {repr(gp_text[:300])}")

print("\n=== Main Column Content Structure ===")
main_col = sel.css("main")
if main_col:
    print("Main tag attributes:", main_col[0].root.attrib)
    # Print all children of the main column
    children = main_col[0].xpath("./*")
    for child in children:
        c_tag = child.root.tag
        c_class = child.root.attrib.get('class', '')
        c_id = child.root.attrib.get('id', '')
        c_text = " ".join(child.css("*::text").getall()).strip()
        print(f"Child Tag: {c_tag} | ID: {c_id} | Class: {c_class} | Text: '{c_text[:100]}'")
else:
    print("No main tag found")


print("\n=== Looking for Job Metadata ===")
# Let's search for tags or items containing "Location", "Category", "Salary", "Experience", etc.
for el in sel.xpath("//*[contains(text(), 'Location') or contains(text(), 'Salary') or contains(text(), 'Experience') or contains(text(), 'Education') or contains(text(), 'Type')]"):
    tag = el.root.tag
    cls = el.root.attrib.get("class", "")
    text = "".join(el.css("*::text").getall()).strip()
    if len(text) < 100:
        print(f"Match: Tag={tag} | Class={cls} | Text='{text}'")
