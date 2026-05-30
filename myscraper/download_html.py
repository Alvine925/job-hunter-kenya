import requests

url = "https://www.brightermonday.co.ke/listings/sales-manager-r8dg42"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

try:
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        with open("page.html", "w", encoding="utf-8") as f:
            f.write(response.text)
        print("Successfully saved to page.html!")
    else:
        print(f"Failed to fetch page: {response.status_code}")
except Exception as e:
    print(f"Exception: {e}")
