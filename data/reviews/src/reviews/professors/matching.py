from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from rapidfuzz import fuzz, process

from reviews.db import load_professor_courses, load_professors, save_json
from reviews.models import DbProfessor, SiteProfessor
from reviews.paths import MANUAL_MATCHES_ROOT, PROFESSOR_MATCH_DECISIONS_PATH, PROFESSOR_REPORTS_ROOT, PROFESSORS_OUTPUT, RAW_CANDIDATES_ROOT, RAW_PROFESSORS_ROOT, UNMATCHED_OUTPUT
from reviews.professors.discovery import is_probable_garbage, scrape_site_professors, source_id_from_url
from reviews.text import normalize_course_text, normalize_name

MANUAL_MATCHES_GLOB = "*.json"
COURSE_MATCH_THRESHOLD = 82
COURSE_HIGH_MATCH_THRESHOLD = 90
AUTO_STRONG_NAME_SCORE = 88
AUTO_LOW_NAME_SCORE = 80
COURSE_OVERRIDE_MIN_MATCHES = 2
COURSE_OVERRIDE_MIN_RATIO = 0.4

COURSE_ALIASES = {
    "ADMINISTRACION DE PROYECTOS": "ADMINISTRACION DE PROYECTOS",
    "ANPI": "ANALISIS NUMERICO PARA INGENIERIA",
    "AP": "ADMINISTRACION DE PROYECTOS",
    "BD I": "BASES DE DATOS I",
    "BASES DE DATOS 1": "BASES DE DATOS I",
    "CALCULO DIFERENCIAL INTEGRAL": "CALCULO DIFERENCIAL E INTEGRAL",
    "CC": "CENTROS DE COMUNICACION",
    "CDI": "CALCULO DIFERENCIAL E INTEGRAL",
    "FISICA 1": "FISICA GENERAL I",
    "FISICA 2": "FISICA GENERAL II",
    "FISICA I": "FISICA GENERAL I",
    "FISICA II": "FISICA GENERAL II",
    "FOC": "FUNDAMENTOS DE ORGANIZACION DE COMPUTADORAS",
    "HIDROLOGIA": "HIDROLOGIA",
    "INTRO A AMBIENTAL Y SANEAMIENTO": "INTRODUCCION A LA INGENIERIA AMBIENTAL Y SANEAMIENTO",
    "INTRO INGENIERIA AMBIENTAL Y SANEAMIENTO": "INTRODUCCION A LA INGENIERIA AMBIENTAL Y SANEAMIENTO",
    "MATE GENERAL": "MATEMATICA GENERAL",
    "MATEMATICAS GENERAL": "MATEMATICA GENERAL",
    "POO": "PROGRAMACION ORIENTADA A OBJETOS",
}


def normalize_course_name(value: object) -> str:
    normalized = normalize_course_text(value)
    return COURSE_ALIASES.get(normalized, normalized)


def load_db_professors() -> list[DbProfessor]:
    return [
        DbProfessor(id=int(row["id"]), full_name=str(row["full_name"]), normalized_name=normalize_name(row["full_name"]))
        for row in load_professors(only_active=True)
    ]


def load_json_list(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text())
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON list in {path}")
    return [item for item in data if isinstance(item, dict)]


def load_manual_matches() -> dict[str, dict[str, Any]]:
    matches: dict[str, dict[str, Any]] = {}
    for path in sorted(MANUAL_MATCHES_ROOT.glob(MANUAL_MATCHES_GLOB)):
        for item in load_json_list(path):
            url = str(item.get("misprofesores_url", "")).strip()
            source_professor_id = source_id_from_url(url)
            if source_professor_id is None or item.get("professor_id") is None:
                continue
            matches[source_professor_id] = {**item, "manual_file": path.name}
    return matches


def token_overlap(a: str, b: str) -> int:
    return len(set(a.split()) & set(b.split()))


def load_reviews_by_source() -> dict[str, list[dict[str, Any]]]:
    reviews_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for root in [RAW_PROFESSORS_ROOT, RAW_CANDIDATES_ROOT]:
        for path in sorted(root.glob("**/pages/page-*.json")):
            data = json.loads(path.read_text())
            source_professor_id = str(data.get("source_professor_id") or path.parent.name)
            for review in data.get("reviews") or []:
                if isinstance(review, dict):
                    reviews_by_source[source_professor_id].append(review)
    return reviews_by_source


def course_evidence(
    professor_id: int,
    reviews: list[dict[str, Any]],
    courses_by_professor: dict[int, list[dict[str, Any]]],
) -> dict[str, Any]:
    options = courses_by_professor.get(professor_id, [])
    option_names = [normalize_course_name(course["name"]) for course in options]
    option_by_name = {normalize_course_name(course["name"]): course for course in options}
    class_names = [
        normalize_course_name(review.get("class_name"))
        for review in reviews
        if normalize_course_name(review.get("class_name")) and normalize_course_name(review.get("class_name")) != "---"
    ]
    class_counts = Counter(class_names)
    matched_count = 0
    high_match_count = 0
    top_matches: Counter[tuple[str, str, str, float]] = Counter()
    unmatched: Counter[str] = Counter()

    for class_name, count in class_counts.items():
        if class_name in option_by_name:
            course = option_by_name[class_name]
            matched_count += count
            high_match_count += count
            top_matches[(class_name, str(course["code"]), str(course["name"]), 100.0)] += count
            continue

        best = process.extractOne(class_name, option_names, scorer=fuzz.token_sort_ratio) if option_names else None
        if best and best[1] >= COURSE_MATCH_THRESHOLD:
            course = option_by_name[best[0]]
            matched_count += count
            if best[1] >= COURSE_HIGH_MATCH_THRESHOLD:
                high_match_count += count
            top_matches[(class_name, str(course["code"]), str(course["name"]), round(float(best[1]), 1))] += count
        else:
            unmatched[class_name] += count

    valid_review_count = len(class_names)
    return {
        "valid_review_count": valid_review_count,
        "matched_review_count": matched_count,
        "high_match_review_count": high_match_count,
        "course_match_ratio": round(matched_count / valid_review_count, 3) if valid_review_count else 0,
        "available_course_count": len(options),
        "top_matches": [
            {"class_name": key[0], "course_code": key[1], "course_name": key[2], "score": key[3], "count": count}
            for key, count in top_matches.most_common(8)
        ],
        "top_unmatched": [
            {"class_name": class_name, "count": count}
            for class_name, count in unmatched.most_common(8)
        ],
        "top_raw_classes": [
            {"class_name": class_name, "count": count}
            for class_name, count in class_counts.most_common(8)
        ],
    }


def candidate_professor_ids(site_professor: SiteProfessor, db_professors: list[DbProfessor]) -> list[int]:
    query = site_professor.normalized_name
    normalized_names = [prof.normalized_name for prof in db_professors]
    by_name = {prof.normalized_name: prof.id for prof in db_professors}
    candidate_ids: list[int] = []
    if query:
        matches = process.extract(query, normalized_names, scorer=fuzz.token_sort_ratio, limit=24)
        for normalized_name, score, _ in matches:
            if score >= 65:
                candidate_ids.append(by_name[normalized_name])

    query_tokens = set(query.split())
    for professor in db_professors:
        db_tokens = set(professor.normalized_name.split())
        overlap = len(query_tokens & db_tokens)
        if overlap >= 2 or (query_tokens and query_tokens <= db_tokens):
            candidate_ids.append(professor.id)

    seen: set[int] = set()
    deduped: list[int] = []
    for professor_id in candidate_ids:
        if professor_id not in seen:
            seen.add(professor_id)
            deduped.append(professor_id)
    return deduped


def score_candidate(
    *,
    site_professor: SiteProfessor,
    professor: DbProfessor,
    reviews: list[dict[str, Any]],
    courses_by_professor: dict[int, list[dict[str, Any]]],
) -> dict[str, Any]:
    name_score = float(fuzz.token_sort_ratio(site_professor.normalized_name, professor.normalized_name))
    overlap = token_overlap(site_professor.normalized_name, professor.normalized_name)
    evidence = course_evidence(professor.id, reviews, courses_by_professor)
    course_score = 0.0
    if evidence["valid_review_count"]:
        course_score = min(100.0, evidence["course_match_ratio"] * 80 + min(20, evidence["matched_review_count"] * 4))
    composite_score = round(name_score * 0.55 + course_score * 0.45, 2)
    if evidence["matched_review_count"] >= COURSE_OVERRIDE_MIN_MATCHES and evidence["course_match_ratio"] >= COURSE_OVERRIDE_MIN_RATIO:
        composite_score = round(max(composite_score, 82 + min(12, evidence["matched_review_count"] * 2)), 2)
    return {
        "professor_id": professor.id,
        "full_name": professor.full_name,
        "name_score": round(name_score, 1),
        "token_overlap": overlap,
        "course_score": round(course_score, 1),
        "composite_score": composite_score,
        **evidence,
    }


def classify_match(best: dict[str, Any] | None, *, is_manual: bool, was_overridden: bool) -> str:
    if best is None:
        return "unmatched"
    if was_overridden:
        return "course_evidence_override"
    if best["matched_review_count"] >= COURSE_OVERRIDE_MIN_MATCHES and best["course_match_ratio"] >= COURSE_OVERRIDE_MIN_RATIO:
        return "strong_course_evidence"
    if best["name_score"] >= AUTO_STRONG_NAME_SCORE:
        return "strong_name"
    if best["name_score"] >= AUTO_LOW_NAME_SCORE and best["token_overlap"] >= 2:
        return "probable_name"
    if is_manual:
        return "manual"
    return "unmatched"


def match_site_professor(
    site_professor: SiteProfessor,
    *,
    db_professors: list[DbProfessor],
    db_by_id: dict[int, DbProfessor],
    courses_by_professor: dict[int, list[dict[str, Any]]],
    reviews_by_source: dict[str, list[dict[str, Any]]],
    manual_matches: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    if is_probable_garbage(site_professor.display_name):
        return None, {
            "status": "garbage_name",
            "reason": "garbage_name",
            "source_professor_id": site_professor.source_professor_id,
            "site_name": site_professor.display_name,
            "department": site_professor.department,
            "raw_review_count": 0,
            "manual_match": None,
            "manual_overridden": False,
            "best_candidates": [],
        }

    reviews = reviews_by_source.get(site_professor.source_professor_id, [])
    manual = manual_matches.get(site_professor.source_professor_id)
    candidate_ids = candidate_professor_ids(site_professor, db_professors)
    if manual is not None:
        candidate_ids.insert(0, int(manual["professor_id"]))

    seen: set[int] = set()
    candidates: list[dict[str, Any]] = []
    for professor_id in candidate_ids:
        professor = db_by_id.get(professor_id)
        if professor is None or professor_id in seen:
            continue
        seen.add(professor_id)
        candidates.append(
            score_candidate(
                site_professor=site_professor,
                professor=professor,
                reviews=reviews,
                courses_by_professor=courses_by_professor,
            )
        )

    candidates.sort(
        key=lambda candidate: (
            candidate["matched_review_count"],
            candidate["course_match_ratio"],
            candidate["composite_score"],
            candidate["name_score"],
        ),
        reverse=True,
    )
    best = candidates[0] if candidates else None
    manual_candidate = next((candidate for candidate in candidates if manual and candidate["professor_id"] == int(manual["professor_id"])), None)
    was_overridden = False
    if manual_candidate is not None and best is not None and best["professor_id"] != manual_candidate["professor_id"]:
        best_has_evidence = best["matched_review_count"] >= manual_candidate["matched_review_count"] + COURSE_OVERRIDE_MIN_MATCHES
        best_has_ratio = best["course_match_ratio"] >= max(COURSE_OVERRIDE_MIN_RATIO, manual_candidate["course_match_ratio"] + 0.25)
        was_overridden = best_has_evidence and best_has_ratio
        if not was_overridden:
            best = manual_candidate

    status = classify_match(best, is_manual=manual is not None, was_overridden=was_overridden)
    details = {
        "status": status,
        "reason": status,
        "source_professor_id": site_professor.source_professor_id,
        "site_name": site_professor.display_name,
        "department": site_professor.department,
        "raw_review_count": len(reviews),
        "manual_match": manual,
        "manual_overridden": was_overridden,
        "best_candidates": candidates[:8],
    }
    if best is None or status in {"unmatched", "garbage_name"}:
        return None, details

    matched = {
        "misprofesores_url": site_professor.url,
        "professor_id": int(best["professor_id"]),
        "site_name": site_professor.display_name,
        "db_full_name": str(best["full_name"]),
        "match_reason": status,
        "match_score": best["composite_score"],
        "name_score": best["name_score"],
        "course_match_ratio": best["course_match_ratio"],
        "matched_review_count": best["matched_review_count"],
    }
    return matched, details


def write_markdown_report(decisions: list[dict[str, Any]]) -> None:
    report_path = PROFESSOR_REPORTS_ROOT / "decisions.md"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["# Professor Match Decisions", ""]
    summary = Counter(decision["status"] for decision in decisions)
    lines.append("## Summary")
    lines.append("")
    for status, count in sorted(summary.items()):
        lines.append(f"- {status}: {count}")
    lines.extend(["", "## Overrides And Weak Matches", ""])
    interesting = [
        decision
        for decision in decisions
        if decision["status"] in {"course_evidence_override", "unmatched", "garbage_name"} or decision.get("manual_overridden")
    ]
    for decision in interesting[:120]:
        best = decision.get("best_candidates", [{}])[0] if decision.get("best_candidates") else {}
        lines.append(f"### {decision.get('site_name')} ({decision.get('source_professor_id')})")
        lines.append("")
        lines.append(f"- Status: {decision.get('status')}")
        if best:
            lines.append(
                f"- Best: {best.get('professor_id')} {best.get('full_name')} score={best.get('composite_score')} courses={best.get('matched_review_count')}/{best.get('valid_review_count')}"
            )
            if best.get("top_matches"):
                formatted = "; ".join(
                    f"{item['class_name']} -> {item['course_code']} {item['course_name']} ({item['count']})"
                    for item in best["top_matches"][:5]
                )
                lines.append(f"- Course matches: {formatted}")
        lines.append("")
    report_path.write_text("\n".join(lines) + "\n")


def build_matches() -> dict[str, Any]:
    site_professors = scrape_site_professors()
    db_professors = load_db_professors()
    db_by_id = {professor.id: professor for professor in db_professors}
    courses_by_professor = load_professor_courses()
    reviews_by_source = load_reviews_by_source()
    manual_matches = load_manual_matches()

    recognized: list[dict[str, Any]] = []
    unmatched: list[dict[str, Any]] = []
    decisions: list[dict[str, Any]] = []
    seen_pairs: set[tuple[str, int]] = set()
    for site_professor in site_professors:
        matched, details = match_site_professor(
            site_professor,
            db_professors=db_professors,
            db_by_id=db_by_id,
            courses_by_professor=courses_by_professor,
            reviews_by_source=reviews_by_source,
            manual_matches=manual_matches,
        )
        decisions.append({"misprofesores_url": site_professor.url, **details})
        if matched is None:
            unmatched.append(
                {
                    "site_name": site_professor.display_name,
                    "normalized_site_name": site_professor.normalized_name,
                    "misprofesores_url": site_professor.url,
                    "department": site_professor.department,
                    "reason": details["status"],
                    "raw_review_count": details["raw_review_count"],
                    "best_candidates": details["best_candidates"][:4],
                }
            )
            continue
        key = (matched["misprofesores_url"], int(matched["professor_id"]))
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        recognized.append(matched)

    save_json(PROFESSORS_OUTPUT, recognized)
    save_json(UNMATCHED_OUTPUT, unmatched)
    save_json(PROFESSOR_MATCH_DECISIONS_PATH, {"decisions": decisions})
    write_markdown_report(decisions)
    return {
        "site_professors": len(site_professors),
        "recognized": len(recognized),
        "unmatched": len(unmatched),
        "manual_matches": len(manual_matches),
        "status_counts": dict(Counter(decision["status"] for decision in decisions)),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Discover and match MisProfesores professors with local database professors.")
    return parser.parse_args()


def main() -> None:
    parse_args()
    summary = build_matches()
    print(f"Scraped professors: {summary['site_professors']}")
    print(f"Matched professors: {summary['recognized']}")
    print(f"Unmatched professors: {summary['unmatched']}")
    print(f"Manual match inputs: {summary['manual_matches']}")
    print(f"Status counts: {summary['status_counts']}")
    print(f"Saved: {PROFESSORS_OUTPUT}")
    print(f"Saved: {UNMATCHED_OUTPUT}")
    print(f"Saved: {PROFESSOR_MATCH_DECISIONS_PATH}")


if __name__ == "__main__":
    main()
