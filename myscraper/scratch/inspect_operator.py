from scrapy.selector import Selector

with open("operator.html", "r", encoding="utf-8") as f:
    html = f.read()

sel = Selector(text=html)

print("Title:", sel.css("title::text").get())

# Title & Company
title = sel.css('div.profile-left h5::text').get()
company = sel.css('div.profile-left p.mb-0.text-muted a.mr-2.font-weight-bold::text, div.profile-box h5::text').getall()
print(f"Parsed Title: {repr(title)}")
print(f"Parsed Company: {repr(company)}")

# Let's check the description and other boxes text
print("\n--- Boxes ---")
for box in sel.css("div.box"):
    box_title = box.css("div.box-title h6::text").get()
    if box_title:
        body_text = " ".join(box.css("div.box-body *::text").getall()).strip()
        print(f"Box Title: '{box_title.strip()}' | Text (first 250): {repr(body_text[:250])}")
