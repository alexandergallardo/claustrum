from __future__ import annotations

import json
import re
import subprocess
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from rapidfuzz import fuzz, process
from unidecode import unidecode

from reviews.db import query_database
from reviews.paths import MANUAL_MATCHES_ROOT, PROFESSOR_REPORTS_ROOT, PROFESSORS_OUTPUT, RAW_CANDIDATES_ROOT, RAW_PROFESSORS_ROOT

ROOT = Path(__file__).resolve().parents[3]
WORKSPACE_ROOT = ROOT.parent.parent
JSON_REPORT = PROFESSOR_REPORTS_ROOT / "audit.json"
MARKDOWN_REPORT = PROFESSOR_REPORTS_ROOT / "audit.md"

COURSE_MATCH_THRESHOLD = 82
COURSE_HIGH_MATCH_THRESHOLD = 90
NAME_REVIEW_THRESHOLD = 88
NAME_CANDIDATE_THRESHOLD = 70

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
    "MATE GENERAL": "MATEMATICA GENERAL",
    "MATEMATICAS GENERAL": "MATEMATICA GENERAL",
    "POO": "PROGRAMACION ORIENTADA A OBJETOS",
}


@dataclass(frozen=True)
class MatchEntry:
    file: str
    index: int
    source_url: str
    source_professor_id: str
    professor_id: int
    site_name: str
    db_full_name: str
    is_manual: bool
    match_reason: str | None
    match_score: float | None


def normalize(value: object) -> str:
    normalized = unidecode(str(value or "")).upper()
    normalized = re.sub(r"[^A-Z0-9\s]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def normalize_course_name(value: object) -> str:
    normalized = normalize(value)
    normalized = re.sub(r"\bVERANO\b", "", normalized)
    normalized = re.sub(r"\bVIRTUAL\b", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return COURSE_ALIASES.get(normalized, normalized)


def source_id_from_url(url: str) -> str | None:
    match = re.search(r"_(\d+)(?:\?.*)?$", url)
    return match.group(1) if match else None


def load_json_list(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text())
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON list in {path}")
    return [item for item in data if isinstance(item, dict)]


def load_professors() -> tuple[dict[int, str], list[str], dict[str, int]]:
    rows = query_database("select id, full_name from public.professor where is_active = true order by id")
    by_id = {int(row["id"]): str(row["full_name"]) for row in rows}
    normalized_names = [normalize(row["full_name"]) for row in rows]
    by_normalized = {normalize(row["full_name"]): int(row["id"]) for row in rows}
    return by_id, normalized_names, by_normalized


def load_professor_courses() -> dict[int, list[dict[str, Any]]]:
    rows = query_database(
        """
        select cogp.professor_id, c.id as course_id, c.code, c.name
        from public.course c
        join public.course_offering co on co.course_id = c.id
        join public.course_offering_group cog on cog.course_offering_id = co.id
        join public.course_offering_group_professor cogp on cogp.course_offering_group_id = cog.id
        group by cogp.professor_id, c.id, c.code, c.name
        """
    )
    by_professor: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_professor[int(row["professor_id"])].append(row)
    return by_professor


def load_matches() -> list[MatchEntry]:
    entries: list[MatchEntry] = []
    paths = [PROFESSORS_OUTPUT, *sorted(MANUAL_MATCHES_ROOT.glob("*.json"))]
    for path in paths:
        if not path.exists():
            continue
        is_manual = path.parent == MANUAL_MATCHES_ROOT
        for index, item in enumerate(load_json_list(path)):
            source_url = str(item.get("misprofesores_url", "")).strip()
            source_professor_id = source_id_from_url(source_url)
            professor_id = item.get("professor_id")
            if not source_url or source_professor_id is None or professor_id is None:
                continue
            raw_match_score = item.get("match_score")
            match_score = float(raw_match_score) if isinstance(raw_match_score, int | float) else None
            entries.append(
                MatchEntry(
                    file=str(path.relative_to(WORKSPACE_ROOT)),
                    index=index,
                    source_url=source_url,
                    source_professor_id=source_professor_id,
                    professor_id=int(professor_id),
                    site_name=str(item.get("site_name") or ""),
                    db_full_name=str(item.get("db_full_name") or ""),
                    is_manual=is_manual,
                    match_reason=str(item.get("manual_reason") or item.get("match_reason") or "") or None,
                    match_score=match_score,
                )
            )
    return entries


def load_raw_reviews() -> tuple[dict[str, list[dict[str, Any]]], dict[str, list[str]], list[dict[str, Any]]]:
    reviews_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    dirs_by_source: dict[str, set[str]] = defaultdict(set)
    parent_mismatches: list[dict[str, Any]] = []

    for root in [RAW_PROFESSORS_ROOT, RAW_CANDIDATES_ROOT]:
        for path in root.glob("**/pages/page-*.json"):
            data = json.loads(path.read_text())
            source_professor_id = str(data.get("source_professor_id") or "")
            professor_id = data.get("professor_id")
            if source_professor_id:
                dirs_by_source[source_professor_id].add(str(path.parent.parent.relative_to(root)))
            if root == RAW_PROFESSORS_ROOT:
                path_professor_id = path.relative_to(RAW_PROFESSORS_ROOT).parts[0]
                if str(professor_id) != path_professor_id:
                    parent_mismatches.append(
                        {
                            "path": str(path.relative_to(WORKSPACE_ROOT)),
                            "path_professor_id": path_professor_id,
                            "json_professor_id": professor_id,
                        }
                    )
            for review in data.get("reviews") or []:
                if isinstance(review, dict):
                    reviews_by_source[source_professor_id].append(review)

    return reviews_by_source, {key: sorted(value) for key, value in dirs_by_source.items()}, parent_mismatches


def course_evidence(
    professor_id: int,
    reviews: list[dict[str, Any]],
    courses_by_professor: dict[int, list[dict[str, Any]]],
) -> dict[str, Any]:
    options = courses_by_professor.get(professor_id, [])
    option_names = [normalize(course["name"]) for course in options]
    option_by_name = {normalize(course["name"]): course for course in options}
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
            {
                "class_name": key[0],
                "course_code": key[1],
                "course_name": key[2],
                "score": key[3],
                "count": count,
            }
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


def candidate_professors(
    entry: MatchEntry,
    professor_by_id: dict[int, str],
    normalized_professor_names: list[str],
    professor_id_by_normalized_name: dict[str, int],
) -> list[int]:
    query = normalize(entry.site_name) or normalize(professor_by_id.get(entry.professor_id, ""))
    candidate_ids: list[int] = []
    if query:
        matches = process.extract(query, normalized_professor_names, scorer=fuzz.token_sort_ratio, limit=12)
        for normalized_name, score, _ in matches:
            professor_id = professor_id_by_normalized_name[normalized_name]
            if score >= NAME_CANDIDATE_THRESHOLD or professor_id == entry.professor_id:
                candidate_ids.append(professor_id)
    if entry.professor_id not in candidate_ids:
        candidate_ids.append(entry.professor_id)
    return candidate_ids


def classify_entry(
    entry: MatchEntry,
    assigned_evidence: dict[str, Any],
    candidates: list[dict[str, Any]],
) -> tuple[str, list[str]]:
    flags: list[str] = []
    best_candidate = candidates[0] if candidates else None
    assigned_name_score = fuzz.token_sort_ratio(normalize(entry.site_name), normalize(entry.db_full_name)) if entry.site_name else 0

    if assigned_name_score and assigned_name_score < NAME_REVIEW_THRESHOLD:
        flags.append("weak_name_match")
    if assigned_evidence["valid_review_count"] == 0:
        flags.append("no_course_names_in_raw")
    elif assigned_evidence["valid_review_count"] < 5:
        flags.append("insufficient_course_evidence")
    elif assigned_evidence["course_match_ratio"] < 0.15:
        flags.append("weak_course_evidence")
    if assigned_evidence["available_course_count"] == 0:
        flags.append("no_db_courses_for_assigned_professor")

    if best_candidate and best_candidate["professor_id"] != entry.professor_id:
        assigned_count = assigned_evidence["matched_review_count"]
        best_count = best_candidate["matched_review_count"]
        assigned_ratio = assigned_evidence["course_match_ratio"]
        best_ratio = best_candidate["course_match_ratio"]
        if best_count >= assigned_count + 3 and best_ratio >= max(0.2, assigned_ratio + 0.15):
            flags.append("alternative_course_evidence")
        elif assigned_count <= 2 and best_count >= assigned_count + 2 and best_ratio > assigned_ratio:
            flags.append("near_alternative_course_evidence")

    if entry.is_manual:
        return "manual", flags
    if "alternative_course_evidence" in flags:
        return "needs_review", flags
    if "weak_name_match" in flags and ("weak_course_evidence" in flags or "insufficient_course_evidence" in flags):
        return "needs_review", flags
    if "weak_course_evidence" in flags or "no_db_courses_for_assigned_professor" in flags:
        return "weak", flags
    if "insufficient_course_evidence" in flags or "no_course_names_in_raw" in flags:
        return "weak", flags
    return "strong", flags


def audit() -> dict[str, Any]:
    professor_by_id, normalized_professor_names, professor_id_by_normalized_name = load_professors()
    courses_by_professor = load_professor_courses()
    entries = load_matches()
    reviews_by_source, raw_dirs_by_source, parent_mismatches = load_raw_reviews()

    source_conflicts: list[dict[str, Any]] = []
    entries_by_source: dict[str, list[MatchEntry]] = defaultdict(list)
    for entry in entries:
        entries_by_source[entry.source_professor_id].append(entry)
    for source_professor_id, source_entries in entries_by_source.items():
        professor_ids = {entry.professor_id for entry in source_entries}
        if len(professor_ids) > 1:
            source_conflicts.append(
                {
                    "source_professor_id": source_professor_id,
                    "matches": [entry.__dict__ for entry in source_entries],
                }
            )

    audited_entries: list[dict[str, Any]] = []
    for entry in entries:
        reviews = reviews_by_source.get(entry.source_professor_id, [])
        assigned_evidence = course_evidence(entry.professor_id, reviews, courses_by_professor)
        candidates: list[dict[str, Any]] = []
        for professor_id in candidate_professors(entry, professor_by_id, normalized_professor_names, professor_id_by_normalized_name):
            evidence = course_evidence(professor_id, reviews, courses_by_professor)
            name_score = fuzz.token_sort_ratio(normalize(entry.site_name), normalize(professor_by_id.get(professor_id, ""))) if entry.site_name else 0
            candidates.append(
                {
                    "professor_id": professor_id,
                    "full_name": professor_by_id.get(professor_id, ""),
                    "name_score": round(float(name_score), 1),
                    **evidence,
                }
            )
        candidates.sort(key=lambda candidate: (candidate["matched_review_count"], candidate["high_match_review_count"], candidate["name_score"]), reverse=True)
        status, flags = classify_entry(entry, assigned_evidence, candidates)
        audited_entries.append(
            {
                "status": status,
                "flags": flags,
                "file": entry.file,
                "index": entry.index,
                "source_professor_id": entry.source_professor_id,
                "source_url": entry.source_url,
                "raw_dirs": raw_dirs_by_source.get(entry.source_professor_id, []),
                "professor_id": entry.professor_id,
                "site_name": entry.site_name,
                "db_full_name": entry.db_full_name,
                "is_manual": entry.is_manual,
                "match_reason": entry.match_reason,
                "match_score": entry.match_score,
                "raw_review_count": len(reviews),
                "assigned_evidence": assigned_evidence,
                "best_candidates": candidates[:6],
            }
        )

    audited_entries.sort(
        key=lambda item: (
            item["status"] != "needs_review",
            item["status"] != "weak",
            -item["raw_review_count"],
            item["site_name"],
        )
    )
    summary = Counter(entry["status"] for entry in audited_entries)
    flag_summary = Counter(flag for entry in audited_entries for flag in entry["flags"])
    return {
        "summary": {
            "total_matches": len(audited_entries),
            "status_counts": dict(summary),
            "flag_counts": dict(flag_summary),
            "source_conflict_count": len(source_conflicts),
            "raw_parent_mismatch_count": len(parent_mismatches),
        },
        "source_conflicts": source_conflicts,
        "raw_parent_mismatches": parent_mismatches,
        "entries": audited_entries,
    }


def write_markdown(report: dict[str, Any]) -> None:
    entries = report["entries"]
    possible_wrong = [
        entry
        for entry in entries
        if "alternative_course_evidence" in entry["flags"] or "near_alternative_course_evidence" in entry["flags"]
    ]
    needs_review = [entry for entry in entries if entry["status"] == "needs_review"]
    weak = [entry for entry in entries if entry["status"] == "weak"]
    lines = [
        "# Professor Match Audit",
        "",
        "## Summary",
        "",
        f"- Total matches: {report['summary']['total_matches']}",
    ]
    for status, count in sorted(report["summary"]["status_counts"].items()):
        lines.append(f"- {status}: {count}")
    lines.extend(
        [
            f"- Source conflicts: {report['summary']['source_conflict_count']}",
            f"- Raw parent mismatches: {report['summary']['raw_parent_mismatch_count']}",
            "",
            "## Flag Counts",
            "",
        ]
    )
    for flag, count in sorted(report["summary"]["flag_counts"].items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"- {flag}: {count}")

    lines.extend(["", "## Possible Wrong Matches", ""])
    if not possible_wrong:
        lines.append("No matches currently have a better similar-name candidate by course evidence.")
    for entry in possible_wrong[:80]:
        best = entry["best_candidates"][0] if entry["best_candidates"] else None
        assigned = entry["assigned_evidence"]
        lines.extend(
            [
                f"### {entry['site_name']} ({entry['source_professor_id']})",
                "",
                f"- Current: {entry['professor_id']} {entry['db_full_name']}",
                f"- File: {entry['file']} index {entry['index']}",
                f"- Flags: {', '.join(entry['flags'])}",
                f"- Assigned course evidence: {assigned['matched_review_count']}/{assigned['valid_review_count']} ({assigned['course_match_ratio']})",
            ]
        )
        if best:
            lines.append(
                f"- Better candidate: {best['professor_id']} {best['full_name']} with {best['matched_review_count']}/{best['valid_review_count']} ({best['course_match_ratio']})"
            )
            if best["top_matches"]:
                formatted_matches = "; ".join(
                    f"{item['class_name']} -> {item['course_code']} {item['course_name']} ({item['count']})"
                    for item in best["top_matches"][:5]
                )
                lines.append(f"- Better candidate matched classes: {formatted_matches}")
        if assigned["top_unmatched"]:
            formatted = "; ".join(f"{item['class_name']} ({item['count']})" for item in assigned["top_unmatched"][:5])
            lines.append(f"- Current unmatched classes: {formatted}")
        lines.append("")

    lines.extend(["", "## Needs Review", ""])
    if not needs_review:
        lines.append("No matches currently require review.")
    for entry in needs_review[:80]:
        best = entry["best_candidates"][0] if entry["best_candidates"] else None
        assigned = entry["assigned_evidence"]
        lines.extend(
            [
                f"### {entry['site_name']} ({entry['source_professor_id']})",
                "",
                f"- Current: {entry['professor_id']} {entry['db_full_name']}",
                f"- File: {entry['file']} index {entry['index']}",
                f"- Flags: {', '.join(entry['flags'])}",
                f"- Assigned course evidence: {assigned['matched_review_count']}/{assigned['valid_review_count']} ({assigned['course_match_ratio']})",
            ]
        )
        if best:
            lines.append(
                f"- Best candidate: {best['professor_id']} {best['full_name']} with {best['matched_review_count']}/{best['valid_review_count']} ({best['course_match_ratio']})"
            )
        if assigned["top_unmatched"]:
            formatted = "; ".join(f"{item['class_name']} ({item['count']})" for item in assigned["top_unmatched"][:5])
            lines.append(f"- Top unmatched classes: {formatted}")
        lines.append("")

    lines.extend(["", "## Weak Evidence", ""])
    lines.append("These are not necessarily wrong; they need better aliases, more historical offerings, or manual confirmation before importing reviews.")
    lines.append("")
    for entry in weak[:80]:
        assigned = entry["assigned_evidence"]
        lines.append(
            f"- {entry['site_name']} ({entry['source_professor_id']}) -> {entry['professor_id']} {entry['db_full_name']}: "
            f"{assigned['matched_review_count']}/{assigned['valid_review_count']} course matches, flags={', '.join(entry['flags'])}"
        )

    MARKDOWN_REPORT.write_text("\n".join(lines) + "\n")


def main() -> None:
    PROFESSOR_REPORTS_ROOT.mkdir(parents=True, exist_ok=True)
    report = audit()
    JSON_REPORT.write_text(json.dumps(report, ensure_ascii=True, indent=2) + "\n")
    write_markdown(report)

    print(f"Matches audited: {report['summary']['total_matches']}")
    print(f"Status counts: {report['summary']['status_counts']}")
    print(f"Flag counts: {report['summary']['flag_counts']}")
    print(f"Source conflicts: {report['summary']['source_conflict_count']}")
    print(f"Raw parent mismatches: {report['summary']['raw_parent_mismatch_count']}")
    print(f"Saved: {JSON_REPORT}")
    print(f"Saved: {MARKDOWN_REPORT}")


if __name__ == "__main__":
    main()
