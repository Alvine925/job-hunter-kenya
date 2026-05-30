"""
run.py — Run one or all spiders once (no scheduling).

Usage:
    python run.py                           # runs all spiders once
    python run.py brightermonday myjobmag   # runs specific spiders
    python run.py --list                    # show available spiders
"""
import logging
import os
import subprocess
import sys

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("run")

ALL_SPIDERS = ["brightermonday", "myjobmag", "fuzu", "myjobsinkenya"]


def run_spider(name: str):
    max_pages = os.environ.get("MAX_PAGES", "")
    cmd = [sys.executable, "-m", "scrapy", "crawl", name]
    if max_pages:
        cmd += ["-s", f"MAX_PAGES={max_pages}"]
    logger.info("Running: %s", " ".join(cmd))
    subprocess.run(cmd, cwd=os.path.dirname(__file__))


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--list" in args:
        print("Available spiders:\n  " + "\n  ".join(ALL_SPIDERS))
        sys.exit(0)

    targets = args if args else ALL_SPIDERS
    for spider in targets:
        if spider not in ALL_SPIDERS:
            logger.warning("Unknown spider '%s' — skipping. Use --list to see options.", spider)
            continue
        run_spider(spider)
