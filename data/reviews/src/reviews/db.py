from __future__ import annotations

import json
import os
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from .paths import COURSE_DECISIONS_PATH, COURSE_FAMILY_DECISIONS_PATH, COURSE_VARIATIONS_PATH, WORKSPACE_ROOT


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def query_database(query: str) -> list[dict[str, Any]]:
    command = ["pnpm", "exec", "supabase", "db", "query", "--output", "json", query]
    try:
        result = subprocess.run(command, cwd=WORKSPACE_ROOT, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as error:
        stderr = error.stderr.strip() if error.stderr else ""
        stdout = error.stdout.strip() if error.stdout else ""
        detail = stderr or stdout or str(error)
        raise RuntimeError(
            "Could not query the local Supabase database. "
            "Start it with `pnpm run supabase:start` from the project root and try again.\n\n"
            f"Supabase output:\n{detail}"
        ) from error
    
    # Supabase might output extra text or a dict containing "rows"
    text = result.stdout.strip()
    # Try to find the JSON part if there's text around it
    if "{" in text and "}" in text and not text.startswith("{") and not text.startswith("["):
        match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
        if match:
            text = match.group(1)
            
    parsed = json.loads(text)
    if isinstance(parsed, dict) and "rows" in parsed:
        return parsed["rows"]
    if isinstance(parsed, list):
        return parsed
    return []


def load_professor_courses() -> dict[int, list[dict[str, Any]]]:
    rows = query_database(
        """
        SELECT cogp.professor_id, c.id AS course_id, c.code, c.name
        FROM public.course c
        JOIN public.course_offering co ON co.course_id = c.id
        JOIN public.course_offering_group cog ON cog.course_offering_id = co.id
        JOIN public.course_offering_group_professor cogp ON cogp.course_offering_group_id = cog.id
        GROUP BY cogp.professor_id, c.id, c.code, c.name
        ORDER BY cogp.professor_id, c.code, c.name
        """
    )
    courses_by_professor: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        courses_by_professor[int(row["professor_id"])].append(row)
    return courses_by_professor


def load_professors(*, only_active: bool = True) -> list[dict[str, Any]]:
    where = "WHERE is_active = true" if only_active else ""
    rows = query_database(f"SELECT id, full_name FROM public.professor {where} ORDER BY id")
    return [{"id": int(row["id"]), "full_name": str(row["full_name"])} for row in rows]


def get_existing_import_keys(professor_id: int) -> set[str]:
    from .paths import PROCESSED_ROOT
    keys = set()
    
    # Busca en data/processed/sql/
    sql_dir = PROCESSED_ROOT / "sql"
    if sql_dir.exists():
        for sql_file in sql_dir.glob(f"*_{professor_id}.sql"):
            content = sql_file.read_text(encoding="utf-8")
            found = re.findall(r"'([a-f0-9]{64})'::TEXT", content)
            keys.update(found)
            
    return keys


def load_all_courses() -> list[dict[str, Any]]:
    rows = query_database(
        "SELECT id AS course_id, code, name, EXISTS(SELECT 1 FROM public.course_offering co WHERE co.course_id = c.id) AS has_offerings FROM public.course c ORDER BY code, name"
    )
    return [
        {
            "course_id": int(row["course_id"]),
            "code": str(row["code"]),
            "name": str(row["name"]),
            "has_offerings": bool(row.get("has_offerings")),
        }
        for row in rows
    ]


def load_course_prefix_affinity(courses_by_professor: dict[int, list[dict[str, Any]]]) -> dict[int, Counter[str]]:
    professor_prefixes: dict[int, set[str]] = {}
    affinity: dict[int, Counter[str]] = defaultdict(Counter)
    for professor_id, courses in courses_by_professor.items():
        prefixes = {
            match.group(0)
            for course in courses
            if (match := re.match(r"[A-Z]+", str(course.get("code") or ""))) is not None
        }
        professor_prefixes[professor_id] = {prefix for prefix in prefixes if prefix}
    for professor_id, courses in courses_by_professor.items():
        for course in courses:
            course_id = int(course["course_id"])
            affinity[course_id].update(professor_prefixes[professor_id])
    return affinity


def load_json_dict(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        return {}
    return {str(key): value for key, value in data.items() if isinstance(value, dict)}


def load_course_decisions() -> dict[str, dict[str, Any]]:
    return load_json_dict(COURSE_DECISIONS_PATH)


def load_course_variations() -> dict[str, dict[str, Any]]:
    return load_json_dict(COURSE_VARIATIONS_PATH)


def load_course_family_decisions() -> dict[str, dict[str, Any]]:
    return load_json_dict(COURSE_FAMILY_DECISIONS_PATH)


def save_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=True, indent=2) + "\n")
