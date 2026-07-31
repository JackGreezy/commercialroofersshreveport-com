#!/usr/bin/env python3
"""Keep Shreveport's supplied header logo as the only rendered brand mark."""

from pathlib import Path
import re
import sys


public = Path(sys.argv[1]) / "public"
marker = "rr-shreveport-single-logo"
style = (
    f'<style id="{marker}">'
    "#header a.rr-wordmark,#header a.rr-brand-force{"
    "background:none!important;background-image:none!important}"
    "</style>"
)
donor_background = re.compile(
    r"background:url\(['\"]?/ours/shared/"
    r"commercial-roofers-of-shreveport\.png['\"]?\)"
    r"\s*center/contain\s+no-repeat!important"
)

changed = 0
for path in public.rglob("*.html"):
    original = path.read_text(errors="ignore")
    updated = donor_background.sub(
        "background:none!important;background-image:none!important",
        original,
    )
    updated = re.sub(
        rf'<style id="{marker}">.*?</style>',
        "",
        updated,
        flags=re.S,
    )
    updated = updated.replace("</head>", style + "</head>", 1)
    if updated != original:
        path.write_text(updated)
        changed += 1

print(f"Shreveport header background logo removed: pages={changed}")
