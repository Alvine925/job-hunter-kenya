with open("myjobsinkenya_home.html", "r", encoding="utf-8") as f:
    html = f.read()

from scrapy.selector import Selector
sel = Selector(text=html)

for form in sel.xpath("//form[contains(@action, '/search')]"):
    print("Form HTML:")
    print(form.get()[:2000])
    print("=" * 60)
