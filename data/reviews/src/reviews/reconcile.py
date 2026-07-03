from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from reviews.db import save_json
from reviews.paths import MANUAL_MATCHES_ROOT, PROCESSED_PROFESSORS_ROOT, RAW_CANDIDATES_ROOT, RAW_PROFESSORS_ROOT, UNMATCHED_OUTPUT, PROFESSORS_OUTPUT
from reviews.professors.discovery import source_id_from_url


def load_json_list(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict)]


def matched_sources() -> dict[str, int]:
    sources: dict[str, int] = {}
    for item in load_json_list(PROFESSORS_OUTPUT):
        source_id = source_id_from_url(str(item.get("misprofesores_url") or ""))
        professor_id = item.get("professor_id")
        if source_id is None or professor_id is None:
            continue
        sources[source_id] = int(professor_id)
    return sources


def unmatched_sources() -> set[str]:
    sources: set[str] = set()
    for item in load_json_list(UNMATCHED_OUTPUT):
        source_id = source_id_from_url(str(item.get("misprofesores_url") or ""))
        if source_id is not None:
            sources.add(source_id)
    return sources


def remove_conflicting_manual_overrides(sources: dict[str, int]) -> int:
    removed = 0
    for path in sorted(MANUAL_MATCHES_ROOT.glob("*.json")):
        entries = load_json_list(path)
        kept: list[dict[str, Any]] = []
        for item in entries:
            source_id = source_id_from_url(str(item.get("misprofesores_url") or ""))
            professor_id = item.get("professor_id")
            if source_id is not None and professor_id is not None and source_id in sources and int(professor_id) != sources[source_id]:
                removed += 1
                continue
            kept.append(item)
        if len(kept) != len(entries):
            save_json(path, kept)
    return removed


def move_dir_contents(source: Path, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for child in source.iterdir():
        destination = target / child.name
        if destination.exists():
            if child.is_dir() and destination.is_dir():
                move_dir_contents(child, destination)
            elif child.is_file() and destination.is_file():
                destination.unlink()
                shutil.move(str(child), str(destination))
            else:
                if destination.is_dir():
                    shutil.rmtree(destination)
                else:
                    destination.unlink()
                shutil.move(str(child), str(destination))
        else:
            shutil.move(str(child), str(destination))
    source.rmdir()


def update_professor_id_in_pages(root: Path, professor_id: int | None) -> int:
    updated = 0
    if not root.exists():
        return 0
    for path in root.glob("pages/page-*.json"):
        data = json.loads(path.read_text())
        if data.get("professor_id") != professor_id:
            data["professor_id"] = professor_id
            path.write_text(json.dumps(data, ensure_ascii=True, indent=2) + "\n")
            updated += 1
    return updated


def clean_empty_parents(root: Path) -> None:
    if not root.exists():
        return
    for path in sorted([item for item in root.rglob("*") if item.is_dir()], key=lambda item: len(item.parts), reverse=True):
        try:
            path.rmdir()
        except OSError:
            pass


def reconcile_raw_dirs(sources: dict[str, int], unmatched: set[str]) -> dict[str, int]:
    stats = {
        "raw_moved_to_professor": 0,
        "raw_moved_to_candidates": 0,
        "raw_pages_updated": 0,
        "processed_moved_to_professor": 0,
        "processed_pages_updated": 0,
    }

    for candidate_dir in sorted(RAW_CANDIDATES_ROOT.glob("*")):
        if not candidate_dir.is_dir():
            continue
        source_id = candidate_dir.name
        target_professor_id = sources.get(source_id)
        if target_professor_id is None:
            continue
        target = RAW_PROFESSORS_ROOT / str(target_professor_id) / f"source-{source_id}"
        move_dir_contents(candidate_dir, target)
        stats["raw_moved_to_professor"] += 1
        stats["raw_pages_updated"] += update_professor_id_in_pages(target, target_professor_id)

    for professor_dir in sorted(RAW_PROFESSORS_ROOT.glob("*")):
        if not professor_dir.is_dir() or not professor_dir.name.isdigit():
            continue
        current_professor_id = int(professor_dir.name)
        for source_dir in sorted(professor_dir.glob("source-*")):
            if not source_dir.is_dir():
                continue
            source_id = source_dir.name.removeprefix("source-")
            target_professor_id = sources.get(source_id)
            if target_professor_id is None:
                if source_id in unmatched:
                    target = RAW_CANDIDATES_ROOT / source_id
                    move_dir_contents(source_dir, target)
                    stats["raw_moved_to_candidates"] += 1
                    stats["raw_pages_updated"] += update_professor_id_in_pages(target, None)
                continue
            target = RAW_PROFESSORS_ROOT / str(target_professor_id) / f"source-{source_id}"
            if target_professor_id != current_professor_id:
                move_dir_contents(source_dir, target)
                stats["raw_moved_to_professor"] += 1
            stats["raw_pages_updated"] += update_professor_id_in_pages(target, target_professor_id)

    for professor_dir in sorted(PROCESSED_PROFESSORS_ROOT.glob("*")):
        if not professor_dir.is_dir() or not professor_dir.name.isdigit():
            continue
        current_professor_id = int(professor_dir.name)
        for source_dir in sorted(professor_dir.glob("source-*")):
            if not source_dir.is_dir():
                continue
            source_id = source_dir.name.removeprefix("source-")
            target_professor_id = sources.get(source_id)
            if target_professor_id is None:
                continue
            target = PROCESSED_PROFESSORS_ROOT / str(target_professor_id) / f"source-{source_id}"
            if target_professor_id != current_professor_id:
                move_dir_contents(source_dir, target)
                stats["processed_moved_to_professor"] += 1
            stats["processed_pages_updated"] += update_professor_id_in_pages(target, target_professor_id)

    clean_empty_parents(RAW_PROFESSORS_ROOT)
    clean_empty_parents(PROCESSED_PROFESSORS_ROOT)
    return stats


def reconcile_matching_state() -> dict[str, int]:
    sources = matched_sources()
    unmatched = unmatched_sources()
    removed_manual = remove_conflicting_manual_overrides(sources)
    stats = reconcile_raw_dirs(sources, unmatched)
    return {"manual_overrides_removed": removed_manual, **stats}
