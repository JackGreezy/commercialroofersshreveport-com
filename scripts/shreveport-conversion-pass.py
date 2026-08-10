#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]).resolve()
PUBLIC = ROOT / "public"
PLACEHOLDER_DISPLAY = "555-555-6135"
PLACEHOLDER_TEL = "+15555556135"
ADDRESS = "401 Edwards St, Suite 1100, Shreveport, LA 71101"
MAP_SRC = "https://www.google.com/maps?q=401+Edwards+St%2C+Suite+1100%2C+Shreveport%2C+LA+71101&output=embed"


def fragment(markup: str):
    return BeautifulSoup(markup, "html.parser").find()


def set_meta(soup: BeautifulSoup, selector: str, value: str, attribute: str = "content") -> None:
    tag = soup.select_one(selector)
    if tag:
        tag[attribute] = value


def remove_placeholder_phone(soup: BeautifulSoup) -> None:
    for anchor in list(soup.find_all("a", href=re.compile(r"(?:\+?1)?5555556135"))):
        parent = anchor.parent
        if parent and parent.name in {"p", "li", "div"} and re.fullmatch(
            r"\s*Phone:\s*555-555-6135\s*", parent.get_text(" ", strip=True), re.I
        ):
            parent.decompose()
        else:
            anchor.decompose()

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except Exception:
            continue

        def clean_schema(value):
            if isinstance(value, dict):
                return {
                    key: clean_schema(item)
                    for key, item in value.items()
                    if not (key == "telephone" and (not str(item).strip() or PLACEHOLDER_DISPLAY in str(item)))
                }
            if isinstance(value, list):
                return [clean_schema(item) for item in value]
            return value

        script.string = json.dumps(clean_schema(data), separators=(",", ":"))

    for text_node in list(soup.find_all(string=re.compile(re.escape(PLACEHOLDER_DISPLAY)))):
        cleaned = re.sub(rf"(?:Phone:\s*)?{re.escape(PLACEHOLDER_DISPLAY)}", "", str(text_node), flags=re.I)
        text_node.replace_with(cleaned)

    for tag in soup.find_all(True):
        for key, value in list(tag.attrs.items()):
            if isinstance(value, str) and (PLACEHOLDER_DISPLAY in value or PLACEHOLDER_TEL in value):
                if key == "href" and value.startswith("tel:"):
                    del tag[key]
                else:
                    tag[key] = value.replace(PLACEHOLDER_DISPLAY, "").replace(PLACEHOLDER_TEL, "")


def rewrite_home(soup: BeautifulSoup) -> None:
    title = soup.find("title")
    page_title = "Commercial Roofing Shreveport | Emergency Repair & Flat Roofs"
    description = (
        "Commercial roof emergency repair, flat roof inspections, coatings, replacement, "
        "and service agreements for Shreveport and Bossier City buildings."
    )
    if title:
        title.string = page_title
    set_meta(soup, 'meta[name="description"]', description)
    set_meta(soup, 'meta[property="og:title"]', page_title)
    set_meta(soup, 'meta[property="og:description"]', description)
    set_meta(soup, 'meta[name="twitter:title"]', page_title)
    set_meta(soup, 'meta[name="twitter:description"]', description)

    hero = soup.select_one(".HeroHomeImage_heroSection__Zgj4m")
    if hero:
        h1 = hero.find("h1")
        subtitle = hero.find("p")
        if h1:
            h1.string = "Commercial Roof Help for Shreveport Buildings That Cannot Wait"
        if subtitle:
            subtitle.string = (
                "Active leak, aging flat roof, storm damage, or a budget decision coming up? "
                "Get a practical path for repair, coating, replacement, or ongoing roof service."
            )
            if not hero.select_one(".rr-shv-hero-actions"):
                subtitle.insert_after(fragment(
                    '<div class="rr-shv-hero-actions">'
                    '<a href="/contact?service=emergency-repair">Get Emergency Roof Help</a>'
                    '<a href="/contact?service=flat-roof-inspection">Book a Flat Roof Inspection</a>'
                    '</div>'
                ))

    cards = soup.select_one(".CardsSection_wrapper__UfddS")
    if cards:
        card_content = [
            (
                "Water is getting in",
                "Stop the leak, protect the building, and document what failed before the damage spreads.",
                "/contact?service=emergency-repair",
                "Request emergency help",
            ),
            (
                "The flat roof may be near the end",
                "Get an inspection and report that separates repairable conditions from coating or replacement needs.",
                "/contact?service=flat-roof-inspection",
                "Schedule an inspection",
            ),
            (
                "You need fewer roof surprises",
                "Put inspections, routine service, leak history, and budget planning into one service agreement.",
                "/contact?service=service-agreement",
                "Ask about a service agreement",
            ),
        ]
        for card, (heading, body, href, label) in zip(cards.select(":scope > div"), card_content):
            text = card.find("p")
            link = card.find("a")
            if text:
                text.clear()
                strong = soup.new_tag("strong")
                strong.string = heading
                text.append(strong)
                text.append(soup.new_tag("br"))
                text.append(body)
            if link:
                link["href"] = href
                link.string = label

        if not soup.select_one(".rr-shv-decision"):
            cards.insert_after(fragment('''
<section class="rr-shv-decision">
  <div class="rr-shv-kicker">One roof. Three honest paths.</div>
  <div class="rr-shv-decision-head">
    <h2>Repair it. Restore it. Replace it.</h2>
    <p>The right answer starts with the roof in front of us, not a predetermined sale.</p>
  </div>
  <div class="rr-shv-decision-grid">
    <article>
      <img src="/ours/services/commercial-roof-leak-repair-commercial-roofers-shreveport-la.webp" alt="Commercial flat roof repair in Shreveport" loading="lazy"/>
      <div><span>Repair</span><h3>Keep a serviceable roof working</h3><p>Target active leaks, open seams, punctures, flashing failures, drainage trouble, and storm damage.</p><a href="/services/commercial-roof-leak-repair">See repair options</a></div>
    </article>
    <article>
      <img src="/ours/services/acrylic-roof-coatings-commercial-roofers-shreveport-la.webp" alt="Commercial roof coating in Shreveport" loading="lazy"/>
      <div><span>Restore</span><h3>Extend the roof when conditions allow</h3><p>Evaluate coating or recover options only after the membrane, insulation, moisture, and details are checked.</p><a href="/contact?service=roof-coating">Evaluate coating potential</a></div>
    </article>
    <article>
      <img src="/ours/services/commercial-roof-tear-off-replacement-commercial-roofers-shreveport-la.webp" alt="Commercial flat roof replacement in Shreveport" loading="lazy"/>
      <div><span>Replace</span><h3>Plan the next roof before failure dictates the schedule</h3><p>Compare tear-off, recover, insulation, drainage, phasing, warranty, and occupied-building requirements.</p><a href="/contact?service=roof-replacement">Plan a replacement inspection</a></div>
    </article>
  </div>
</section>'''))

    scopes = soup.select_one(".CompaniesGroups_sectionWrapper__o8hXv")
    if scopes:
        heading = scopes.find("h2")
        if heading:
            heading.string = "Start with the roofing decision in front of you"

    offices = soup.select_one(".Offices_section__5KVwZ")
    if offices and not soup.select_one(".rr-shv-service-plan"):
        offices.insert_after(fragment('''
<section class="rr-shv-service-plan">
  <div class="rr-shv-service-copy">
    <p class="rr-shv-kicker">Roof service without the scramble</p>
    <h2>A service agreement keeps small roof problems from becoming capital emergencies.</h2>
    <p>Give property and facility teams a repeatable way to request service, track recurring leaks, inspect the roof, and see upcoming repair or replacement needs before budget season.</p>
    <ul>
      <li>Scheduled inspections and condition updates</li>
      <li>Priority response for active leaks</li>
      <li>Repair history and photo documentation</li>
      <li>Budget guidance for coating or replacement</li>
    </ul>
    <a href="/contact?service=service-agreement">Discuss a roof service agreement</a>
  </div>
  <div class="rr-shv-service-image">
    <img src="/ours/services/preventive-maintenance-programs-commercial-roofers-shreveport-la.webp" alt="Commercial roof service agreement inspection in Shreveport" loading="lazy"/>
  </div>
</section>'''))

    plan = soup.select_one(".WhatWeBuild_sectionWrapper__RmV6M")
    if plan:
        heading = plan.find("h2")
        if heading:
            heading.string = "Commercial roofing help for the whole life of the roof"

    main = soup.find("main")
    if main and not soup.select_one(".rr-shv-close"):
        main.append(fragment('''
<section class="rr-shv-close">
  <p>Not sure whether you need repair, coating, or replacement?</p>
  <h2>Start with a flat roof inspection. Get the facts before you spend.</h2>
  <div><a href="/contact?service=flat-roof-inspection">Request a Roof Inspection</a><a href="/contact?service=emergency-repair">I Have an Active Leak</a><a href="/about">See Our Roofing Approach</a></div>
</section>'''))
    close = soup.select_one(".rr-shv-close")
    if close and not close.select_one('a[href="/about"]'):
        actions = close.find("div")
        if actions:
            about = soup.new_tag("a", href="/about")
            about.string = "See Our Roofing Approach"
            actions.append(about)


def rewrite_contact(soup: BeautifulSoup) -> None:
    h1 = soup.find("h1")
    if h1:
        h1.string = "GET HELP WITH THE ROOF"
    hero = soup.select_one(".SimpleHero_footerText__BP1GU")
    if hero:
        hero.string = "Active leak or planning ahead? Send the roof details and the next decision you need to make."
    for link in soup.find_all("a", href="/contact"):
        if "assessment" in link.get_text(" ", strip=True).lower():
            link["href"] = "/contact?service=flat-roof-inspection"


def add_mobile_emergency(soup: BeautifulSoup) -> None:
    if soup.body and not soup.select_one(".rr-shv-mobile-emergency"):
        tag = fragment(
            '<a class="rr-shv-mobile-emergency" href="/contact?service=emergency-repair" '
            'aria-label="Request emergency commercial roof help">'
            '<span aria-hidden="true">!</span><strong>Emergency Help</strong></a>'
        )
        soup.body.append(tag)


def restore_exact_footer_map(soup: BeautifulSoup) -> None:
    footer = soup.find("footer")
    if not footer:
        return
    holder = footer.select_one(".rr-footer-map")
    if not holder:
        holder = soup.new_tag("div")
        holder["class"] = ["rr-footer-map"]
        holder["data-rr-footer-map"] = ""
        footer.append(holder)
    holder.clear()
    frame = soup.new_tag("iframe")
    frame["src"] = MAP_SRC
    frame["title"] = "Commercial Roofers of Shreveport office map"
    frame["loading"] = "lazy"
    frame["referrerpolicy"] = "no-referrer-when-downgrade"
    frame["allowfullscreen"] = ""
    holder.append(frame)


def process(path: Path) -> None:
    soup = BeautifulSoup(path.read_text(errors="ignore"), "html.parser")
    remove_placeholder_phone(soup)
    route_home = path.parent == PUBLIC and path.name in {"home.html", "index.html"}
    if route_home:
        rewrite_home(soup)
    if path.parent == PUBLIC and path.name == "contact.html":
        rewrite_contact(soup)
    restore_exact_footer_map(soup)
    add_mobile_emergency(soup)
    rendered = str(soup).replace("rh-tornado", "rr-tornado").replace("—", " - ").replace("–", "-")
    path.write_text(rendered)


for html_path in PUBLIC.rglob("*.html"):
    if "assets-f" not in html_path.parts and not html_path.name.endswith(".ref"):
        process(html_path)

for text_path in [PUBLIC / "llms.txt", PUBLIC / "llms-full.txt"]:
    if text_path.exists():
        value = text_path.read_text(errors="ignore")
        value = value.replace(PLACEHOLDER_DISPLAY, "").replace(PLACEHOLDER_TEL, "").replace("—", " - ").replace("–", "-")
        text_path.write_text(value)

home = BeautifulSoup((PUBLIC / "home.html").read_text(), "html.parser")
contact = BeautifulSoup((PUBLIC / "contact.html").read_text(), "html.parser")
assert "401 Edwards St, Suite 1100" in contact.get_text(" ", strip=True), "Shreveport street address changed or missing"
assert "Shreveport, LA 71101" in contact.get_text(" ", strip=True), "Shreveport city address changed or missing"
assert home.select_one(f'iframe[src="{MAP_SRC}"]'), "Shreveport Maps embed changed or missing"
assert not any(PLACEHOLDER_DISPLAY in path.read_text(errors="ignore") for path in PUBLIC.rglob("*.html")), "placeholder phone remains"
print("shreveport-conversion-pass: complete")
