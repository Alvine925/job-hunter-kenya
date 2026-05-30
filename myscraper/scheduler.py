"""
scheduler.py — Run all spiders on a schedule using APScheduler.

Usage:
    python scheduler.py                 # runs with defaults (every 6 hours)
    SCRAPE_INTERVAL_HOURS=12 python scheduler.py

Spiders run sequentially per tick to stay polite.
The Fuzu spider is excluded if scrapy-playwright is not installed.
"""
import logging
import os
import subprocess
import sys
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("scheduler")

# ── Spider registry ─────────────────────────────────────────────────────────
# Add or remove spiders here. Set "requires_playwright": True for JS spiders.
SPIDERS = [
    {"name": "brightermonday",  "requires_playwright": False},
    {"name": "myjobmag",        "requires_playwright": False},
    {"name": "fuzu",            "requires_playwright": True},
    {"name": "myjobsinkenya",   "requires_playwright": False},
]

INTERVAL_HOURS = float(os.environ.get("SCRAPE_INTERVAL_HOURS", "6"))
MAX_PAGES      = os.environ.get("MAX_PAGES", "")       # empty = unlimited
LOG_LEVEL      = os.environ.get("LOG_LEVEL", "INFO")


def _playwright_available() -> bool:
    try:
        import scrapy_playwright  # noqa: F401
        return True
    except ImportError:
        return False


def run_spider(name: str) -> bool:
    """Invoke `scrapy crawl <name>` as a subprocess. Returns True on success."""
    cmd = [sys.executable, "-m", "scrapy", "crawl", name, "-L", LOG_LEVEL]
    if MAX_PAGES:
        cmd += ["-s", f"MAX_PAGES={MAX_PAGES}"]

    logger.info("▶ Starting spider: %s", name)
    start = datetime.utcnow()
    result = subprocess.run(cmd, cwd=os.path.dirname(__file__))
    elapsed = (datetime.utcnow() - start).seconds
    if result.returncode == 0:
        logger.info("✔ Spider '%s' finished in %ds", name, elapsed)
        return True
    else:
        logger.error("✘ Spider '%s' exited with code %d after %ds", name, result.returncode, elapsed)
        return False


def run_all_spiders():
    logger.info("═══ Scrape run starting (%s UTC) ═══", datetime.utcnow().strftime("%Y-%m-%d %H:%M"))
    has_playwright = _playwright_available()
    ok = failed = skipped = 0

    for spider in SPIDERS:
        name = spider["name"]
        if spider["requires_playwright"] and not has_playwright:
            logger.warning("Skipping '%s' — scrapy-playwright not installed.", name)
            skipped += 1
            continue
        if run_spider(name):
            ok += 1
        else:
            failed += 1

    logger.info(
        "═══ Run complete — %d OK, %d failed, %d skipped ═══", ok, failed, skipped
    )


def main():
    try:
        from apscheduler.schedulers.blocking import BlockingScheduler
        from apscheduler.triggers.interval import IntervalTrigger
    except ImportError:
        logger.error(
            "APScheduler not installed. Run: pip install apscheduler\n"
            "Or run spiders directly: scrapy crawl brightermonday"
        )
        sys.exit(1)

    scheduler = BlockingScheduler(timezone="Africa/Nairobi")
    scheduler.add_job(
        run_all_spiders,
        trigger=IntervalTrigger(hours=INTERVAL_HOURS),
        id="scrape_all",
        name="Scrape all job sites",
        replace_existing=True,
        next_run_time=datetime.now(),   # run immediately on startup
    )

    logger.info(
        "Scheduler started — running all spiders every %.0f hour(s). "
        "Press Ctrl+C to stop.",
        INTERVAL_HOURS,
    )
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
