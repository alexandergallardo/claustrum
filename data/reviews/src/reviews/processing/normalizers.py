from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from reviews.text import normalize_text

ALLOWED_TAGS = [
    "Tomaría su clase nuevamente",
    "Brinda apoyo",
    "Da buena retroalimentación",
    "Explica con claridad",
    "Clases excelentes",
    "Califica con rigor",
    "Muchas tareas",
    "Deja trabajos largos",
    "Exámenes retadores",
    "Muchos exámenes",
    "Pocos exámenes",
    "Asistencia obligatoria",
    "La participación importa",
    "Clases largas",
    "Requiere mucha lectura",
    "Aspectos de calificación claros",
    "Respetado por los estudiantes",
    "Inspirador",
    "Muy cómico",
    "Da crédito extra",
    "Muchos proyectos grupales",
    "Proyecto útil",
    "Clase fácil",
]

TAG_MAP = {
    "aspectos de calificacion claros": "Aspectos de calificación claros",
    "asistencia obligatoria": "Asistencia obligatoria",
    "barco": "Clase fácil",
    "brinda apoyo": "Brinda apoyo",
    "califica duro": "Califica con rigor",
    "clases excelentes": "Clases excelentes",
    "da buena retroalimentacion": "Da buena retroalimentación",
    "da credito extra": "Da crédito extra",
    "deja trabajos largos": "Deja trabajos largos",
    "hace examenes sorpresa": "Exámenes retadores",
    "inspiracional": "Inspirador",
    "la participacion importa": "La participación importa",
    "las clases son largas": "Clases largas",
    "los examenes son dificiles": "Exámenes retadores",
    "muchas tareas": "Muchas tareas",
    "muchos examenes": "Muchos exámenes",
    "muchos proyectos grupales": "Muchos proyectos grupales",
    "muy comico": "Muy cómico",
    "pocos examenes": "Pocos exámenes",
    "preparate para leer": "Requiere mucha lectura",
    "proyecto util": "Proyecto útil",
    "respetado por los estudiantes": "Respetado por los estudiantes",
    "tomaria su clase otra vez": "Tomaría su clase nuevamente",
    "tomaria su clase nuevamente": "Tomaría su clase nuevamente",
}

MONTHS = {
    "ene": 1,
    "feb": 2,
    "mar": 3,
    "abr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "ago": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dic": 12,
}


def is_pending_review_comment(value: object) -> bool:
    return normalize_text(value) == "comentario esperando revision"


def parse_review_date(value: object) -> tuple[str | None, str | None]:
    from datetime import datetime, timezone

    text = str(value or "").strip()
    match = re.fullmatch(r"(\d{1,2})/([A-Za-zÁÉÍÓÚáéíóúÑñ]+)/((?:19|20)\d{2})", text)
    if match is None:
        return None, "invalid_date"
    day = int(match.group(1))
    month = MONTHS.get(normalize_text(match.group(2)))
    year = int(match.group(3))
    if month is None:
        return None, "invalid_month"
    try:
        return datetime(year, month, day, tzinfo=timezone.utc).isoformat(), None
    except ValueError:
        return None, "invalid_date"


def normalize_comment(value: object) -> tuple[str, str | None]:
    comment = str(value or "").strip()
    compact = re.sub(r"\s+", " ", comment)
    normalized = normalize_text(compact)
    if not compact or normalized in {"", "-", "--", "---", "na", "n a"} or len(normalized) < 5:
        return "Ninguno", "comment_normalized_to_none"
    return compact[:1000], None


def normalize_attendance(value: object) -> tuple[bool | None, str | None]:
    if value is None or str(value).strip() == "":
        return None, None
    normalized = normalize_text(value)
    if normalized == "obligatoria":
        return True, None
    if normalized == "no obligatoria":
        return False, None
    return None, "invalid_attendance"


def normalize_grade(value: object) -> tuple[str | None, str | None]:
    raw = str(value or "").strip()
    if not raw or normalize_text(raw) in {"n a", "na", "n/a"}:
        return None, "grade_empty_or_na"
    try:
        numeric = Decimal(raw.replace(",", "."))
    except InvalidOperation:
        return None, "grade_not_numeric"
    if numeric < 0 or numeric > 100:
        return None, "grade_out_of_range"
    if numeric <= 10:
        numeric *= Decimal(10)
    elif numeric < 50:
        return None, "grade_suspicious_scale"
    rounded = (numeric / Decimal(5)).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * Decimal(5)
    if rounded < 0 or rounded > 100:
        return None, "grade_out_of_range"
    return str(int(rounded)), None


def normalize_score(value: object) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric < 0 or numeric > 10:
        return None
    return round(numeric, 1)


def normalize_tags(raw_tags: object) -> tuple[list[str], list[str]]:
    if not isinstance(raw_tags, list):
        return [], []
    tags: list[str] = []
    unmapped: list[str] = []
    for raw_tag in raw_tags:
        mapped = TAG_MAP.get(normalize_text(raw_tag))
        if mapped is None:
            unmapped.append(str(raw_tag))
            continue
        if mapped not in tags:
            tags.append(mapped)
    return tags, unmapped
