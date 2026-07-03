from __future__ import annotations

import re

from unidecode import unidecode


def normalize_text(value: object) -> str:
    text = unidecode(str(value or "")).lower().strip()
    text = text.replace(".", " ")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_course_text(value: object) -> str:

    normalized = normalize_text(value).upper()
    
    # Custom domain aliases
    normalized = re.sub(r"\bI\s*Y\s*T\b", "INTRODUCCION Y TALLER", normalized)
    normalized = re.sub(r"\bDB\b", "BASES DE DATOS", normalized)
    normalized = re.sub(r"\bBD\b", "BASES DE DATOS", normalized)
    normalized = re.sub(r"\bQA\b", "ASEGURAMIENTO DE LA CALIDAD", normalized)
    normalized = re.sub(r"\bOS\b", "SISTEMAS OPERATIVOS", normalized)
    normalized = re.sub(r"\bLAB\b", "LABORATORIO", normalized)
    
    normalized = re.sub(r"\bVERANO\b", "", normalized)

    normalized = re.sub(r"\bVIRTUAL\b", "", normalized)
    normalized = re.sub(r"\bSEMIPRESENCIAL\b", "", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def normalize_name(value: object) -> str:
    normalized = unidecode(str(value or "")).upper()
    normalized = re.sub(r"[^A-Z\s]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def sql_numeric(value: object) -> str:
    return "NULL" if value is None else str(value)


def sql_bool(value: object) -> str:
    if value is None:
        return "NULL"
    return "TRUE" if bool(value) else "FALSE"


def sql_text_array(values: list[object]) -> str:
    if not values:
        return "ARRAY[]::TEXT[]"
    return "ARRAY[" + ", ".join(sql_literal(value) for value in values) + "]::TEXT[]"
