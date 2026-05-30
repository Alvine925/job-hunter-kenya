"""Shared helpers for all spiders."""
import re
from datetime import date, datetime
from w3lib.html import remove_tags, replace_escape_chars

_WS = re.compile(r"\s+")

# Kenyan counties (lowercase for matching)
_KENYA_COUNTIES = [
    "nairobi", "mombasa", "kisumu", "nakuru", "eldoret", "thika", "kitale",
    "malindi", "garissa", "kakamega", "nyeri", "meru", "kiambu", "machakos",
    "kajiado", "uasin gishu", "kwale", "kilifi", "taita taveta", "lamu",
    "tana river", "isiolo", "marsabit", "mandera", "wajir", "turkana",
    "west pokot", "samburu", "trans nzoia", "baringo", "laikipia", "nyandarua",
    "kirinyaga", "murang'a", "embu", "tharaka nithi", "kitui", "makueni",
    "nandi", "elgeyo marakwet", "kericho", "bomet", "narok", "kajiado",
    "nyamira", "kisii", "migori", "homa bay", "siaya", "vihiga",
    "bungoma", "busia", "kakamega",
]

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"(?:\+254|0)[17]\d{8}")
_DATE_FMTS = [
    "%d %B %Y", "%B %d, %Y", "%d/%m/%Y", "%Y-%m-%d",
    "%d-%m-%Y", "%d %b %Y", "%b %d, %Y",
    "%B %d %Y", "%b %d %Y",
]


# ── Text cleaning ──────────────────────────────────────────────────────────

def clean_text(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        value = " ".join(v for v in value if v)
    text = remove_tags(value) if "<" in value else value
    text = replace_escape_chars(text, which_ones=("\t", "\r"), replace_by=" ")
    text = _WS.sub(" ", text).strip()
    return text or None


def first_text(selector_list) -> str | None:
    for s in selector_list:
        t = clean_text(s.get())
        if t:
            return t
    return None


def joined_html(selector_list) -> str | None:
    parts = [s.get() for s in selector_list if s.get()]
    return "\n".join(parts) if parts else None


def make_summary(text: str | None, max_chars: int = 300) -> str | None:
    """Return the first `max_chars` characters of text as a summary."""
    if not text:
        return None
    return text[:max_chars].rsplit(" ", 1)[0] + "…" if len(text) > max_chars else text


# ── Location helpers ───────────────────────────────────────────────────────

def extract_county(location_text: str | None) -> str | None:
    """Return the first Kenyan county name found in location_text."""
    if not location_text:
        return None
    lowered = location_text.lower()
    for county in _KENYA_COUNTIES:
        if county in lowered:
            return county.title()
    return None


def detect_remote(text_fields: list[str | None]) -> bool:
    """Return True if any of the text fields mention remote work."""
    combined = " ".join(f for f in text_fields if f).lower()
    return bool(re.search(r"\bremote\b", combined))


def detect_work_type(text_fields: list[str | None]) -> str:
    """Return 'remote' | 'hybrid' | 'on-site'."""
    combined = " ".join(f for f in text_fields if f).lower()
    if re.search(r"\bremote\b", combined):
        return "remote"
    if re.search(r"\bhybrid\b", combined):
        return "hybrid"
    return "on-site"


# ── Contact extraction ─────────────────────────────────────────────────────

def extract_email(text: str | None) -> str | None:
    if not text:
        return None
    m = _EMAIL_RE.search(text)
    return m.group(0) if m else None


def extract_phone(text: str | None) -> str | None:
    if not text:
        return None
    m = _PHONE_RE.search(text)
    return m.group(0) if m else None


# ── Date parsing ───────────────────────────────────────────────────────────

def parse_date(raw: str | None) -> str | None:
    """Try common date formats; return YYYY-MM-DD string or None."""
    if not raw:
        return None
    raw = clean_text(raw) or ""
    # Strip leading labels like "Deadline:", "Closing Date:"
    raw = re.sub(r"^[^:]+:\s*", "", raw).strip()
    # Strip day of week prefix e.g. "Sat, " or "Saturday, "
    raw = re.sub(r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,\s*", "", raw, flags=re.IGNORECASE)
    # Strip ordinal suffixes e.g. 1st, 2nd, 3rd, 4th
    raw = re.sub(r"(\d+)(?:st|nd|rd|th)\b", r"\1", raw, flags=re.IGNORECASE)
    for fmt in _DATE_FMTS:
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_datetime(raw: str | None) -> str | None:
    """Parse ISO datetime or common formats; return ISO string or None."""
    if not raw:
        return None
    raw = clean_text(raw) or ""
    # Already ISO
    try:
        return datetime.fromisoformat(raw).isoformat()
    except ValueError:
        pass
    # Strip day of week prefix e.g. "Sat, " or "Saturday, "
    raw = re.sub(r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,\s*", "", raw, flags=re.IGNORECASE)
    # Strip ordinal suffixes e.g. 1st, 2nd, 3rd, 4th
    raw = re.sub(r"(\d+)(?:st|nd|rd|th)\b", r"\1", raw, flags=re.IGNORECASE)
    for fmt in _DATE_FMTS:
        try:
            return datetime.strptime(raw, fmt).isoformat()
        except ValueError:
            continue
    return None


# ── Classification helpers ─────────────────────────────────────────────────

def detect_experience_level(text: str | None) -> str | None:
    if not text:
        return None
    t = text.lower()
    if any(w in t for w in ["executive", "director", "vp ", "c-suite", "chief"]):
        return "executive"
    if any(w in t for w in ["senior", "sr.", "lead", "principal", "head of"]):
        return "senior"
    if any(w in t for w in ["mid", "intermediate", "2+ years", "3+ years"]):
        return "mid"
    if any(w in t for w in ["junior", "entry", "graduate", "intern", "fresh"]):
        return "junior"
    return None


def detect_application_method(url: str | None, email: str | None) -> str:
    if url:
        return "url"
    if email:
        return "email"
    return "unknown"


def extract_hiring_company(title: str | None, company: str | None, description: str | None, raw_metadata: dict | None) -> str | None:
    import re
    RECRUITER_KEYWORDS = [
        "brightermonday", "brighter monday", "fuzu", "myjobsinkenya", 
        "my jobs in kenya", "myjobmag", "my job mag", "anonymous employer", 
        "anonymous", "employer", "recruiter", "consulting", "recruitment", 
        "client", "our client"
    ]
    
    is_recruiter = False
    if company:
        co_lower = company.lower()
        if any(kw in co_lower for kw in RECRUITER_KEYWORDS):
            is_recruiter = True
    else:
        is_recruiter = True

    title_company = None
    desc_company = None
    page_title_company = None

    # 1. Try to extract from page_title (found in raw_metadata)
    page_title = raw_metadata.get("page_title") if raw_metadata else None
    if page_title:
        # Strip brand suffix like " | BrighterMonday", " - BrighterMonday", " | Kenya", etc.
        cleaned_pt = re.split(r'\s+[|–-]\s+', page_title)[0].strip()
        # Find the last " at " to separate job title and company
        parts = re.split(r'\s+at\s+', cleaned_pt, flags=re.IGNORECASE)
        if len(parts) > 1:
            cand = parts[-1].strip()
            if not any(kw in cand.lower() for kw in RECRUITER_KEYWORDS):
                page_title_company = cand

    # 2. Try to extract from title (e.g., "Accountant at Zarini Naturals Ltd")
    if title:
        parts = re.split(r'\s+at\s+', title, flags=re.IGNORECASE)
        if len(parts) > 1:
            cand = parts[-1].strip()
            if not any(kw in cand.lower() for kw in RECRUITER_KEYWORDS):
                title_company = cand

    # 3. Try to extract from description text (if still recruiter/placeholder)
    if description:
        patterns = [
            r'[oO][uU][rR]\s+[cC][lL][iI][eE][nN][tT],?\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
            r'[oO][nN]\s+[bB][eE][hH][aA][lL][fF]\s+[oO][fF]\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
            r'[rR][eE][cC][rR][uU][iI][tT][iI][nN][gG]\s+[fF][oO][rR]\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
            r'[hH][iI][rR][iI][nN][gG]\s+[fF][oO][rR]\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
        ]
        for pattern in patterns:
            match = re.search(pattern, description)
            if match:
                cand = match.group(1).strip()
                stop_words = RECRUITER_KEYWORDS + ["seeking", "hiring", "looking", "leading", "established", "our", "the", "a ", "an ", "in "]
                if not any(kw in cand.lower() for kw in stop_words):
                    desc_company = cand
                    break

    # If it is a recruiter/placeholder, prioritize actual client names found
    if is_recruiter:
        resolved = page_title_company or title_company or desc_company or company
        if not resolved or any(kw in resolved.lower() for kw in ["brightermonday", "fuzu", "myjobsinkenya", "myjobmag"]):
            resolved = company
    else:
        resolved = company

    return resolved
