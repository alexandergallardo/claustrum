from __future__ import annotations

import json
import re

import requests
from bs4 import BeautifulSoup
from unidecode import unidecode

from reviews.models import SiteProfessor
from reviews.text import normalize_name

SCHOOL_URL = "https://costarica.misprofesores.com/escuelas/ITCR-Instituto-Tecnologico-de-Costa-Rica_1135"


def parse_cell_name(raw_cell: str) -> str:
    parts = [part.strip() for part in raw_cell.split(",", 1)]
    if len(parts) == 2:
        surname, given = parts
        return f"{surname} {given}".strip()
    return raw_cell.strip()


def fix_url_fragment(value: str) -> str:
    normalized = unidecode(value.strip())
    normalized = re.sub(r"[^A-Za-z0-9\s-]", "", normalized)
    normalized = normalized.replace("(", "").replace(")", "")
    normalized = normalized.replace(" -", "-").replace("- ", "-")
    normalized = normalized.replace("\n", "").replace("\r", "")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized.replace(" ", "-")


def source_id_from_url(url: str) -> str | None:
    match = re.search(r"_(\d+)(?:\?.*)?$", url)
    return match.group(1) if match else None


def is_probable_garbage(name: str) -> bool:
    normalized = normalize_name(name)
    tokens = normalized.split()
    if len(tokens) < 2:
        return True
    if len(tokens) == 2 and any(len(token) == 1 for token in tokens):
        return True

    garbage_tokens = {
        "BAD",
        "BUNNY",
        "CHATGPTEC",
        "CHATGPT",
        "ANIMAL",
        "MUPPET",
        "AURON",
        "PLAYS",
    }
    return sum(token in garbage_tokens for token in tokens) >= 2


def scrape_site_professors() -> list[SiteProfessor]:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    response = requests.get(SCHOOL_URL, timeout=30, verify=False)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    scripts = "\n".join(script.get_text() for script in soup.find_all("script"))
    match = re.search(r"var\s+dataSet\s*=\s*(\[.*?\]);", scripts, re.DOTALL)
    if match is None:
        return []

    data_set = json.loads(match.group(1))
    professors: list[SiteProfessor] = []
    for row in data_set:
        surname = str(row.get("a", "")).strip()
        given_name = str(row.get("n", "")).strip()
        identifier = str(row.get("i", "")).strip()
        department = str(row.get("d", "")).strip()
        if not surname or not given_name or not identifier:
            continue

        display_name = parse_cell_name(f"{surname}, {given_name}")
        url = (
            "https://costarica.misprofesores.com/profesores/"
            f"{fix_url_fragment(given_name)}-{fix_url_fragment(surname)}_{identifier}"
        )
        professors.append(
            SiteProfessor(
                display_name=display_name,
                normalized_name=normalize_name(display_name),
                url=url,
                department=department,
                source_professor_id=identifier,
            )
        )
    return professors
