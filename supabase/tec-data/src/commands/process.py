"""Process command for transforming raw data."""

import json
from pathlib import Path
from typing import Any

import typer

from src.commands.scope import normalize_scope
from src.commands.process_course_offering import run_process_course_offering
from src.commands.process_catalog import ensure_reference_data as ensure_reference_data_catalog
from src.commands.process_catalog import process_academic_period as process_academic_period_catalog
from src.commands.process_catalog import process_academic_unit as process_academic_unit_catalog
from src.commands.process_catalog import process_campus as process_campus_catalog

app = typer.Typer(pretty_exceptions_show_locals=False)


def normalize_text(text: str) -> str:
    """Normalize text to uppercase with strip whitespace."""
    return text.upper().strip()


def ensure_reference_data(data_dir: Path) -> None:
    """Ensure country and university reference data exists.

    Creates static data files if they don't exist.
    """
    # Country data
    country_path = data_dir / "country" / "data.json"
    country_path.parent.mkdir(parents=True, exist_ok=True)
    if not country_path.exists():
        countries = [
            {
                "id": 1,
                "name": "COSTA RICA",
                "iso2_code": "CR",
            }
        ]
        country_path.write_text(json.dumps(countries, indent=2, ensure_ascii=False))
        print(f"Created {country_path}")

    # University data
    university_path = data_dir / "university" / "data.json"
    university_path.parent.mkdir(parents=True, exist_ok=True)
    if not university_path.exists():
        universities = [
            {
                "id": 1,
                "country_id": 1,
                "name": "INSTITUTO TECNOLÓGICO DE COSTA RICA",
                "short_name": "ITCR",
            }
        ]
        university_path.write_text(
            json.dumps(universities, indent=2, ensure_ascii=False)
        )
        print(f"Created {university_path}")


def load_campus_codes(data_dir: Path) -> list[str]:
    """Load campus codes from processed data."""
    campus_path = data_dir / "campus" / "data.json"
    if not campus_path.exists():
        msg = f"Campus data not found at {campus_path}"
        raise FileNotFoundError(msg)
    campuses = json.loads(campus_path.read_text())
    return [c["code"] for c in campuses]


def load_campus_id_map(data_dir: Path) -> dict[str, int]:
    """Load campus id mapping from processed data."""
    campus_path = data_dir / "campus" / "data.json"
    if not campus_path.exists():
        msg = f"Campus data not found at {campus_path}"
        raise FileNotFoundError(msg)
    campuses = json.loads(campus_path.read_text())
    return {c["code"]: c["id"] for c in campuses}


def load_universities(data_dir: Path) -> dict[str, int]:
    """Load universities and return mapping from short_name to id."""
    univ_path = data_dir / "university" / "data.json"
    if not univ_path.exists():
        msg = f"University data not found at {univ_path}"
        raise FileNotFoundError(msg)
    universities = json.loads(univ_path.read_text())
    return {univ["short_name"]: univ["id"] for univ in universities}


def get_itcr_university_id(data_dir: Path) -> int:
    """Get ITCR university ID (default for campus data)."""
    univ_id = load_universities(data_dir).get("ITCR")
    if univ_id is None:
        msg = "ITCR university not found in university data"
        raise ValueError(msg)
    return univ_id


def process_campus(
    data_dir: Path = Path("data/raw"),
    university_id: int | None = None,
) -> list[dict[str, Any]]:
    """Process campus raw data and generate normalized output.

    Reads from carga_sedes_json.json and carga_sedes_tds_lib.html,
    merges them, and normalizes all names to uppercase.
    """
    campus_dir = data_dir / "campus"

    # Load university ID
    if university_id is None:
        university_id = get_itcr_university_id(data_dir)

    # Load both sources
    json_path = campus_dir / "carga_sedes_json.json"
    html_path = campus_dir / "carga_sedes_tds_lib.html"

    # Load JSON sedes
    json_data = json.loads(json_path.read_text())
    json_sedes = {
        item["key"]: normalize_text(item["data"]) for item in json_data.get("sedes", [])
    }

    # Load HTML sedes
    html_content = html_path.read_text()
    import re

    html_matches = re.findall(r"<span value='([^']+)'>([^<]+)</span>", html_content)
    html_sedes = {code: normalize_text(name) for code, name in html_matches}

    # Merge: HTML has more data, but JSON has some names formatted better
    # Use HTML as base, fill missing from JSON
    merged: dict[str, str] = html_sedes.copy()
    for code, name in json_sedes.items():
        if code not in merged:
            merged[code] = name
        elif len(name) > len(merged[code]):
            merged[code] = name

    # Generate campus records with normalized names (uppercase)
    campuses: list[dict[str, Any]] = []
    for idx, (code, name) in enumerate(sorted(merged.items()), start=1):
        campuses.append(
            {
                "id": idx,
                "university_id": university_id,
                "code": code,
                "name": name,
            }
        )

    return campuses


def process_academic_unit(
    data_dir: Path = Path("data/raw"),
    university_id: int | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Process academic unit raw data and generate normalized output.

    Reads from carga_carreras_json.json and generates academic_unit
    and academic_unit_campus records.
    """
    unit_dir = data_dir / "academic_unit"

    # Load university ID
    if university_id is None:
        university_id = get_itcr_university_id(data_dir)

    # Load campus mapping
    campus_id_map = load_campus_id_map(data_dir)
    campus_codes = list(campus_id_map.keys())

    # Load raw JSON data
    json_path = unit_dir / "carga_carreras_json.json"
    if not json_path.exists():
        msg = f"Raw data not found at {json_path}"
        raise FileNotFoundError(msg)

    raw_data = json.loads(json_path.read_text())

    # Process careers from JSON data
    # Format: {"CA": {"carreras": [{"key": "CODE", "data": "NAME"}, ...]}, ...}
    all_units: dict[str, dict[str, Any]] = {}  # code -> unit data
    unit_campus_relations: list[dict[str, Any]] = []

    # Track existing relations to avoid duplicates
    existing_relations: set[tuple[int, int]] = set()
    relation_id_counter = 1

    # Load existing data if exists
    existing_units_path = unit_dir / "data.json"
    if existing_units_path.exists():
        existing_data = json.loads(existing_units_path.read_text())
        existing_units = {u["code"]: u for u in existing_data}
        all_units.update(existing_units)

        # Update counter
        if existing_data:
            max_id = max(u["id"] for u in existing_data)
            unit_id_counter = max_id + 1
        else:
            unit_id_counter = 1

        # Load existing relations
        relations_path = data_dir / "academic_unit_campus" / "data.json"
        if relations_path.exists():
            existing_relations_data = json.loads(relations_path.read_text())
            unit_campus_relations.extend(existing_relations_data)
            for rel in existing_relations_data:
                existing_relations.add(
                    (rel.get("academic_unit_id"), rel.get("campus_id"))
                )
            if existing_relations_data:
                max_rel_id = max(r["id"] for r in existing_relations_data)
                relation_id_counter = max_rel_id + 1
    else:
        unit_id_counter = 1

    for campus_code in campus_codes:
        if campus_code not in raw_data:
            continue

        campus_data = raw_data[campus_code]
        campus_id = campus_id_map[campus_code]

        # Extract carreras array
        carreras = campus_data.get("carreras", [])
        if not isinstance(carreras, list):
            continue

        for carrera in carreras:
            # Extract key and data
            code = carrera.get("key")
            name = carrera.get("data")

            if not code or not name:
                continue

            code = normalize_text(str(code))
            name = normalize_text(str(name))

            # Add to units dict if new
            if code not in all_units:
                all_units[code] = {
                    "id": unit_id_counter,
                    "university_id": university_id,
                    "code": code,
                    "name": name,
                }
                unit_id_counter += 1

            # Add campus relation only if doesn't exist
            unit_id = all_units[code]["id"]
            relation_key = (unit_id, campus_id)

            if relation_key not in existing_relations:
                unit_campus_relations.append(
                    {
                        "id": relation_id_counter,
                        "academic_unit_id": unit_id,
                        "campus_id": campus_id,
                    }
                )
                existing_relations.add(relation_key)
                relation_id_counter += 1

    # Convert units dict to list
    academic_units = list(all_units.values())

    return academic_units, unit_campus_relations


def process_academic_period(
    data_dir: Path = Path("data/raw"),
    years: list[int] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Process academic modality and term raw data.

    Reads from carga_modalidad_periodos.json and generates:
    - academic_modality: code, name, periods_per_year
    - academic_term: for each year in range, each period in modality
      - external_key: {year}_{modality_code}_{period_number}
      - display_name: "{year} - {modality_name} {period_number}"
    """
    period_dir = data_dir / "academic_period"

    # Default years to process
    if years is None:
        years = [2024, 2025, 2026]

    # Load raw data
    json_path = period_dir / "carga_modalidad_periodos.json"
    if not json_path.exists():
        msg = f"Raw data not found at {json_path}"
        raise FileNotFoundError(msg)

    raw_data = json.loads(json_path.read_text())

    # Process modalidades
    # Data format: [{"IDE_MODALIDAD":"S","NOMBRE":"SEMESTRE","CANT_PERIODOS":2}, ...]
    if isinstance(raw_data, list):
        modalidades_raw = raw_data
    else:
        modalidades_raw = (
            raw_data.get("modalidad", []) if isinstance(raw_data, dict) else []
        )

    all_modalities: dict[str, dict[str, Any]] = {}  # code -> modality data
    modality_id_counter = 1

    for mod in modalidades_raw:
        code = mod.get("IDE_MODALIDAD")
        name = mod.get("NOMBRE")
        periods_per_year = mod.get("CANT_PERIODOS", 0)

        if not code or not name:
            continue

        code = normalize_text(str(code))
        name = normalize_text(str(name))
        periods_per_year = int(periods_per_year) if periods_per_year else 0

        # Store modality
        all_modalities[code] = {
            "id": modality_id_counter,
            "code": code,
            "name": name,
            "periods_per_year": periods_per_year,
        }
        modality_id_counter += 1

    # Process academic terms
    # For each modality and each year, create period entries
    all_terms: list[dict[str, Any]] = []
    term_id_counter = 1

    for mod_code, mod_data in all_modalities.items():
        periods_per_year = mod_data["periods_per_year"]
        mod_name = mod_data["name"]

        for year in years:
            for period_num in range(1, periods_per_year + 1):
                external_key = f"{year}_{mod_code}_{period_num}"
                display_name = f"{year} - {mod_name} {period_num}"

                all_terms.append(
                    {
                        "id": term_id_counter,
                        "academic_modality_id": mod_data["id"],
                        "year": year,
                        "period_number": period_num,
                        "external_key": external_key,
                        "display_name": display_name,
                    }
                )
                term_id_counter += 1

    academic_modalities = list(all_modalities.values())

    return academic_modalities, all_terms


def process_study_plan_complete(
    data_dir: Path = Path("data/raw"),
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    """Process study plan raw data with full course and relation extraction.

    Uses existing processed IDs when present to avoid regenerating foreign keys.
    """
    plan_dir = data_dir / "study_plan"
    complete_path = plan_dir / "json_draw_angular.json"

    if not complete_path.exists():
        msg = f"Complete study plan data not found at {complete_path}"
        raise FileNotFoundError(msg)

    modality_path = data_dir / "academic_modality" / "data.json"
    modality_code_to_id: dict[str, int] = {}
    modality_name_to_id: dict[str, int] = {}
    if modality_path.exists():
        modalities = json.loads(modality_path.read_text())
        modality_code_to_id = {m["code"]: m["id"] for m in modalities}
        modality_name_to_id = {
            normalize_text(m["name"]): m["id"] for m in modalities if m.get("name")
        }

    campus_id_map = load_campus_id_map(data_dir)

    unit_path = data_dir / "academic_unit" / "data.json"
    unit_code_to_id: dict[str, int] = {}
    if unit_path.exists():
        units = json.loads(unit_path.read_text())
        unit_code_to_id = {u["code"]: u["id"] for u in units}

    complete_data = json.loads(complete_path.read_text())

    study_plan_map: dict[tuple[int, int], dict[str, Any]] = {}
    study_plan_id_counter = 1

    existing_plan_path = data_dir / "study_plan" / "data.json"
    if existing_plan_path.exists():
        existing_plans = json.loads(existing_plan_path.read_text())
        for plan in existing_plans:
            academic_unit_id = plan.get("academic_unit_id")
            external_plan_id = plan.get("external_plan_id")
            if academic_unit_id and external_plan_id:
                study_plan_map[(academic_unit_id, external_plan_id)] = plan
                study_plan_id_counter = max(
                    study_plan_id_counter, plan.get("id", 0) + 1
                )

    plan_campus_relations: list[dict[str, Any]] = []
    plan_campus_keys: set[tuple[int, int]] = set()
    relation_id_counter = 1
    existing_plan_campus_path = data_dir / "study_plan_campus" / "data.json"
    if existing_plan_campus_path.exists():
        existing_relations = json.loads(existing_plan_campus_path.read_text())
        for relation in existing_relations:
            plan_campus_relations.append(relation)
            key = (relation.get("study_plan_id"), relation.get("campus_id"))
            if key[0] and key[1]:
                plan_campus_keys.add(key)
                relation_id_counter = max(
                    relation_id_counter, relation.get("id", 0) + 1
                )

    study_plan_levels: list[dict[str, Any]] = []
    level_key_map: dict[tuple[int, str], int] = {}
    level_id_counter = 1
    existing_level_path = data_dir / "study_plan_level" / "data.json"
    if existing_level_path.exists():
        existing_levels = json.loads(existing_level_path.read_text())
        for level in existing_levels:
            study_plan_levels.append(level)
            level_key = (
                level.get("study_plan_id"),
                normalize_text(level.get("level_label", "")),
            )
            if level_key[0] and level_key[1]:
                level_key_map[level_key] = level.get("id")
                level_id_counter = max(level_id_counter, level.get("id", 0) + 1)

    course_map: dict[str, dict[str, Any]] = {}
    course_id_counter = 1
    existing_course_path = data_dir / "course" / "data.json"
    if existing_course_path.exists():
        existing_courses = json.loads(existing_course_path.read_text())
        for course in existing_courses:
            course_code = normalize_text(course.get("code", ""))
            if not course_code:
                continue
            course_map[course_code] = course
            course_id_counter = max(course_id_counter, course.get("id", 0) + 1)

    level_courses: list[dict[str, Any]] = []
    level_course_keys: set[tuple[int, int]] = set()
    level_course_id_counter = 1
    existing_level_course_path = data_dir / "study_plan_level_course" / "data.json"
    if existing_level_course_path.exists():
        existing_level_courses = json.loads(existing_level_course_path.read_text())
        for level_course in existing_level_courses:
            level_courses.append(level_course)
            key = (
                level_course.get("study_plan_level_id"),
                level_course.get("course_id"),
            )
            if key[0] and key[1]:
                level_course_keys.add(key)
                level_course_id_counter = max(
                    level_course_id_counter, level_course.get("id", 0) + 1
                )

    course_relations: list[dict[str, Any]] = []
    course_relation_keys: set[tuple[int, int, int, str]] = set()
    relation_id_course_counter = 1
    existing_relation_path = data_dir / "course_relation" / "data.json"
    if existing_relation_path.exists():
        existing_relations = json.loads(existing_relation_path.read_text())
        for relation in existing_relations:
            course_relations.append(relation)
            key = (
                relation.get("study_plan_id"),
                relation.get("from_course_id"),
                relation.get("to_course_id"),
                relation.get("relation_type"),
            )
            if all(key):
                course_relation_keys.add(key)
                relation_id_course_counter = max(
                    relation_id_course_counter, relation.get("id", 0) + 1
                )

    processed_plan_ids: set[int] = set()

    def ensure_course(
        course_code: Any,
        course_name: str | None = None,
        credits: int | None = None,
        hours: int | None = None,
    ) -> int:
        if course_code is None:
            return 0
        code_str = str(course_code).strip()
        if not code_str:
            return 0
        if code_str.isdigit():
            return 0
        normalized_code = normalize_text(code_str)
        if not normalized_code:
            return 0
        if normalized_code in course_map:
            course = course_map[normalized_code]
            if course_name and course_name != normalized_code:
                course["name"] = normalize_text(course_name)
            if credits is not None and course.get("default_credits", 0) == 0:
                course["default_credits"] = credits
            if hours is not None and course.get("default_weekly_hours", 0) == 0:
                course["default_weekly_hours"] = hours
            return int(course["id"])

        nonlocal course_id_counter
        new_course = {
            "id": course_id_counter,
            "code": normalized_code,
            "name": normalize_text(course_name) if course_name else normalized_code,
            "default_credits": credits or 0,
            "default_weekly_hours": hours or 0,
        }
        course_map[normalized_code] = new_course
        course_id_counter += 1
        return int(new_course["id"])

    def add_relation(
        study_plan_id: int,
        from_code: Any,
        to_code: Any,
        relation_type: str,
    ) -> None:
        from_id = ensure_course(from_code)
        to_id = ensure_course(to_code)
        if not from_id or not to_id:
            return
        key = (study_plan_id, from_id, to_id, relation_type)
        if key in course_relation_keys:
            return
        nonlocal relation_id_course_counter
        course_relations.append(
            {
                "id": relation_id_course_counter,
                "study_plan_id": study_plan_id,
                "from_course_id": from_id,
                "to_course_id": to_id,
                "relation_type": relation_type,
            }
        )
        course_relation_keys.add(key)
        relation_id_course_counter += 1

    for _, complete_unit_data in complete_data.items():
        campus_code = complete_unit_data.get("campus_code")
        academic_unit_code = complete_unit_data.get("academic_unit_code")
        plans = complete_unit_data.get("plans", [])

        if not campus_code or not academic_unit_code:
            continue

        unit_id = unit_code_to_id.get(academic_unit_code)
        if not unit_id:
            continue

        campus_id = campus_id_map.get(campus_code)

        for plan in plans:
            external_plan_id = plan.get("external_plan_id")
            if not external_plan_id:
                continue

            complete_plan_data = plan.get("complete_data", {})
            if not complete_plan_data:
                continue

            plan_name = normalize_text(plan.get("name", ""))
            first_level = plan.get("first_level_number", 0)
            academic_degree = normalize_text(plan.get("academic_degree", ""))
            modality_raw = plan.get("modalidad", "")
            modality_norm = normalize_text(str(modality_raw)) if modality_raw else ""
            modality_id = modality_code_to_id.get(
                modality_norm
            ) or modality_name_to_id.get(modality_norm)

            plan_key = (unit_id, external_plan_id)
            if plan_key not in study_plan_map:
                study_plan_map[plan_key] = {
                    "id": study_plan_id_counter,
                    "academic_unit_id": unit_id,
                    "academic_modality_id": modality_id,
                    "external_plan_id": external_plan_id,
                    "name": plan_name,
                    "academic_degree": academic_degree or None,
                    "first_level_number": first_level,
                }
                study_plan_id_counter += 1
            else:
                existing = study_plan_map[plan_key]
                if plan_name:
                    existing["name"] = plan_name
                if academic_degree:
                    existing["academic_degree"] = academic_degree
                if modality_id:
                    existing["academic_modality_id"] = modality_id
                if first_level is not None:
                    existing["first_level_number"] = first_level

            plan_id = study_plan_map[plan_key]["id"]

            if campus_id:
                campus_key = (plan_id, campus_id)
                if campus_key not in plan_campus_keys:
                    plan_campus_relations.append(
                        {
                            "id": relation_id_counter,
                            "study_plan_id": plan_id,
                            "campus_id": campus_id,
                            "valid_from": None,
                            "valid_to": None,
                        }
                    )
                    plan_campus_keys.add(campus_key)
                    relation_id_counter += 1

            if plan_id in processed_plan_ids:
                continue
            processed_plan_ids.add(plan_id)

            complete_plan_data = plan.get("complete_data", {})
            if not complete_plan_data:
                continue

            levels = (
                complete_plan_data.get("levels")
                or complete_plan_data.get("niveles")
                or []
            )

            for idx, level_info in enumerate(levels, start=1):
                level_label_raw = level_info.get("id") or f"NIVEL {idx}"
                level_label = normalize_text(level_label_raw)
                try:
                    level_number = int(level_label_raw.split()[-1])
                except (ValueError, IndexError):
                    level_number = idx

                level_key = (plan_id, level_label)
                if level_key in level_key_map:
                    level_id = level_key_map[level_key]
                else:
                    level_id = level_id_counter
                    study_plan_levels.append(
                        {
                            "id": level_id,
                            "study_plan_id": plan_id,
                            "level_number": level_number,
                            "level_label": level_label,
                        }
                    )
                    level_key_map[level_key] = level_id
                    level_id_counter += 1

                courses_in_level = level_info.get("courses", [])
                sort_order = 0

                for course_data in courses_in_level:
                    course_code = course_data.get("id_course")
                    if not course_code:
                        continue

                    course_name = course_data.get("name", "")
                    try:
                        credits_raw = course_data.get("credits", 0)
                        credits = (
                            int(credits_raw)
                            if credits_raw and str(credits_raw).lstrip("-").isdigit()
                            else 0
                        )
                    except (ValueError, TypeError):
                        credits = 0
                    try:
                        hours_raw = course_data.get("hours", 0)
                        hours = (
                            int(hours_raw)
                            if hours_raw and str(hours_raw).lstrip("-").isdigit()
                            else 0
                        )
                    except (ValueError, TypeError):
                        hours = 0

                    course_id = ensure_course(course_code, course_name, credits, hours)
                    if not course_id:
                        continue

                    level_course_key = (level_id, course_id)
                    if level_course_key not in level_course_keys:
                        level_courses.append(
                            {
                                "id": level_course_id_counter,
                                "study_plan_level_id": level_id,
                                "course_id": course_id,
                                "credits": credits,
                                "weekly_hours": hours,
                                "sort_order": sort_order,
                            }
                        )
                        level_course_keys.add(level_course_key)
                        level_course_id_counter += 1
                    sort_order += 10

                    requirements = course_data.get("requirements", [])
                    for req in requirements:
                        req_code = req.get("id", "")
                        if req_code:
                            add_relation(plan_id, course_code, req_code, "PREREQUISITE")

                    co_requirements = course_data.get("co_requirements", [])
                    for req in co_requirements:
                        req_code = req.get("id", "")
                        if req_code:
                            add_relation(plan_id, course_code, req_code, "COREQUISITE")

                    equivalents = course_data.get("equivalent", [])
                    for eq in equivalents:
                        eq_code = eq.get("id", "")
                        if eq_code and not str(eq_code).lower().startswith("no hay"):
                            add_relation(plan_id, course_code, eq_code, "EQUIVALENT")

    return (
        list(study_plan_map.values()),
        plan_campus_relations,
        study_plan_levels,
        list(course_map.values()),
        course_relations,
        level_courses,
    )


def run_process(
    data_dir: Path,
    scope: str = "all",
    university_id: int | None = None,
    years: list[int] | None = None,
) -> None:
    """Run processing for specified scope."""
    scope = normalize_scope(scope)
    run_catalog = scope in {"catalog", "all"}
    run_offering = scope in {"offering", "all"}

    try:
        # Ensure reference data exists (country, university)
        ensure_reference_data_catalog(data_dir)

        # Process campus if requested or all
        if run_catalog:
            campuses = process_campus_catalog(data_dir, university_id)
            campus_path = data_dir / "campus" / "data.json"
            campus_path.write_text(json.dumps(campuses, indent=2, ensure_ascii=False))
            typer.echo(f"Processed {len(campuses)} campuses to {campus_path}")

        # Process academic_unit if requested or all
        if run_catalog:
            academic_units, unit_campus_relations = process_academic_unit_catalog(
                data_dir, university_id
            )

            # Save academic_unit data
            unit_path = data_dir / "academic_unit" / "data.json"
            unit_path.write_text(
                json.dumps(academic_units, indent=2, ensure_ascii=False)
            )
            typer.echo(f"Processed {len(academic_units)} academic_units to {unit_path}")

            # Save academic_unit_campus data
            rel_path = data_dir / "academic_unit_campus" / "data.json"
            rel_path.parent.mkdir(parents=True, exist_ok=True)
            rel_path.write_text(
                json.dumps(unit_campus_relations, indent=2, ensure_ascii=False)
            )
            typer.echo(
                f"Processed {len(unit_campus_relations)} academic_unit_campus relations"
            )

        # Process academic_period if requested or all
        if run_catalog:
            modalities, terms = process_academic_period_catalog(data_dir, years)

            # Save academic_modality data
            modality_path = data_dir / "academic_modality" / "data.json"
            modality_path.parent.mkdir(parents=True, exist_ok=True)
            modality_path.write_text(
                json.dumps(modalities, indent=2, ensure_ascii=False)
            )
            typer.echo(
                f"Processed {len(modalities)} academic_modality to {modality_path}"
            )

            # Save academic_term data
            term_path = data_dir / "academic_term" / "data.json"
            term_path.parent.mkdir(parents=True, exist_ok=True)
            term_path.write_text(json.dumps(terms, indent=2, ensure_ascii=False))
            typer.echo(f"Processed {len(terms)} academic_term to {term_path}")

        # Process study_plan and related entities if requested or all
        if run_catalog:
            (
                study_plans,
                plan_campus_relations,
                study_plan_levels,
                courses,
                course_relations,
                level_courses,
            ) = process_study_plan_complete(data_dir)

            # Save study_plan data
            if run_catalog:
                plan_path = data_dir / "study_plan" / "data.json"
                plan_path.parent.mkdir(parents=True, exist_ok=True)
                plan_path.write_text(
                    json.dumps(study_plans, indent=2, ensure_ascii=False)
                )
                typer.echo(f"Processed {len(study_plans)} study_plans to {plan_path}")

                # Save study_plan_campus data
                plan_campus_path = data_dir / "study_plan_campus" / "data.json"
                plan_campus_path.parent.mkdir(parents=True, exist_ok=True)
                plan_campus_path.write_text(
                    json.dumps(plan_campus_relations, indent=2, ensure_ascii=False)
                )
                typer.echo(
                    f"Processed {len(plan_campus_relations)} study_plan_campus relations"
                )

                # Save study_plan_level data
                plan_level_path = data_dir / "study_plan_level" / "data.json"
                plan_level_path.parent.mkdir(parents=True, exist_ok=True)
                plan_level_path.write_text(
                    json.dumps(study_plan_levels, indent=2, ensure_ascii=False)
                )
                typer.echo(
                    f"Processed {len(study_plan_levels)} study_plan_levels to {plan_level_path}"
                )

                # Save study_plan_level_course data
                level_course_path = data_dir / "study_plan_level_course" / "data.json"
                level_course_path.parent.mkdir(parents=True, exist_ok=True)
                level_course_path.write_text(
                    json.dumps(level_courses, indent=2, ensure_ascii=False)
                )
                typer.echo(
                    f"Processed {len(level_courses)} study_plan_level_courses to {level_course_path}"
                )

            # Save course data (always when processing study_plan)
            if run_catalog:
                course_path = data_dir / "course" / "data.json"
                course_path.parent.mkdir(parents=True, exist_ok=True)
                course_path.write_text(
                    json.dumps(courses, indent=2, ensure_ascii=False)
                )
                typer.echo(f"Processed {len(courses)} courses to {course_path}")

            # Save course_relation data (always when processing study_plan)
            if run_catalog:
                course_rel_path = data_dir / "course_relation" / "data.json"
                course_rel_path.parent.mkdir(parents=True, exist_ok=True)
                course_rel_path.write_text(
                    json.dumps(course_relations, indent=2, ensure_ascii=False)
                )
                typer.echo(
                    f"Processed {len(course_relations)} course_relations to {course_rel_path}"
                )

    except FileNotFoundError as e:
        typer.echo(f"Error: {e}")
        raise typer.Exit(1)
    except ValueError as e:
        typer.echo(f"Error: {e}")
        raise typer.Exit(1)

    # Process course_offering if requested (requires course_offer and schedule_guia first)
    if run_offering:
        if not years:
            typer.echo("Error: --years is required for offering processing")
            raise typer.Exit(1)
        for year in sorted(set(years)):
            run_process_course_offering(data_dir, str(year))


@app.command()
def process_cmd(
    data_dir: Path = typer.Option(
        Path("data/raw"), "--data-dir", "-d", help="Data directory with raw files"
    ),
    scope: str = typer.Option(
        "all", "--scope", "-s", help="Scope to process: catalog, offering, all"
    ),
    university_id: int | None = typer.Option(
        None, "--university-id", "-u", help="University ID for entities"
    ),
    years: str | None = typer.Option(
        None,
        "--years",
        "-y",
        help="Comma-separated years for academic_term (e.g., 2024,2025,2026)",
    ),
) -> None:
    """Process raw data files into normalized data.json format."""
    years_list: list[int] | None = None
    if years:
        years_list = [int(y.strip()) for y in years.split(",")]
    run_process(
        data_dir=data_dir, scope=scope, university_id=university_id, years=years_list
    )


if __name__ == "__main__":
    app()
