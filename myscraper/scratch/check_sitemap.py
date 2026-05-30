import urllib.request
import urllib.error

urls = [
    "https://www.myjobsinkenya.com/sitemap.xml",
    "https://www.myjobsinkenya.com/sitemap_index.xml",
    "https://www.myjobsinkenya.com/sitemap-jobs.xml",
    "https://www.myjobsinkenya.com/robots.txt"
]

for url in urls:
    print(f"Checking {url}...")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            print(f"  Status: {response.status}")
            content = response.read().decode('utf-8', errors='ignore')
            print(f"  Content length: {len(content)}")
            print("  First 300 chars:")
            print(content[:300])
    except urllib.error.HTTPError as e:
        print(f"  HTTP Error: {e.code}")
    except Exception as e:
        print(f"  Error: {e}")
    print("-" * 50)
