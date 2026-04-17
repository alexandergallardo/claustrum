"""Download command."""

import json
import warnings
from pathlib import Path

from src.api.academic_unit import AcademicUnitClient
from src.api.campus import CampusClient
from src.api.study_plan import StudyPlanClient
from src.api.academic_period import AcademicPeriodClient

# Suppress SSL warnings
warnings.filterwarnings("ignore", message="Unverified HTTPS request")


def download(
    output_dir: Path = Path("data/raw"),
    entity: str | None = None,
    verify_ssl: bool = False,
    concurrency: int = 3,
    year: str | None = None,
) -> None:
    """Download raw data from TEC APIs.

    When entity is None, downloads all available data in order:
    - campus
    - academic_unit
    - academic_period

    Note: study_plan requires academic_unit_campus which is generated
    during 'process', so it must be downloaded separately after processing:
    1. uv run tec-data download
    2. uv run tec-data process
    3. uv run tec-data download --entity study_plan
    4. uv run tec-data process --entity study_plan
    """
    # Download campus (always needed)
    if entity is None or entity == "campus":
        client = CampusClient()
        try:
            files = client.download_raw(output_dir)
            for source, path in files.items():
                print(f"Saved campus {source} data to: {path}")
        finally:
            client.close()

    # Download academic_unit (always needed for study_plan later)
    if entity is None or entity == "academic_unit":
        # Load campus data to get campus codes
        campus_path = output_dir / "campus" / "data.json"
        if campus_path.exists():
            campuses = json.loads(campus_path.read_text())
            campus_codes = [c["code"] for c in campuses]
        else:
            campus_codes = ["CA", "SJ", "SC", "AL", "LM"]  # Default

        client = AcademicUnitClient(verify_ssl=verify_ssl)
        try:
            files = client.download_raw(output_dir, campus_codes)
            for source, path in files.items():
                print(f"Saved academic_unit {source} data to: {path}")
        finally:
            client.close()

    # Download academic_period (modalities and terms)
    if entity is None or entity == "academic_period":
        client = AcademicPeriodClient(verify_ssl=verify_ssl)
        try:
            files = client.download_raw(output_dir)
            for source, path in files.items():
                print(f"Saved academic_period {source} data to: {path}")
        finally:
            client.close()

    # Download study_plan only if requested explicitly (requires process first)
    if entity == "study_plan":
        # Load campus data to get campus codes
        campus_path = output_dir / "campus" / "data.json"
        if campus_path.exists():
            campuses = json.loads(campus_path.read_text())
            campus_codes = [c["code"] for c in campuses]
        else:
            campus_codes = ["CA", "SJ", "SC", "AL", "LM"]  # Default

        client = AcademicUnitClient(verify_ssl=verify_ssl)
        try:
            files = client.download_raw(output_dir, campus_codes)
            for source, path in files.items():
                print(f"Saved academic_unit {source} data to: {path}")
        finally:
            client.close()

    # Download study_plan only if requested explicitly
    if entity == "study_plan":
        # Load academic_unit_campus data to get valid combinations
        relation_path = output_dir / "academic_unit_campus" / "data.json"
        if not relation_path.exists():
            print(f"Error: academic_unit_campus data not found at {relation_path}")
            print(
                "Please run 'process' command first to generate academic_unit_campus data."
            )
            return

        relations = json.loads(relation_path.read_text())

        # Build combinations using campus codes and academic unit codes
        # First load campus data to map campus_id -> code
        campus_path = output_dir / "campus" / "data.json"
        if campus_path.exists():
            campuses = json.loads(campus_path.read_text())
            campus_id_to_code = {c["id"]: c["code"] for c in campuses}
        else:
            print(f"Error: campus data not found at {campus_path}")
            return

        # Load academic_unit data to map unit id -> code
        unit_path = output_dir / "academic_unit" / "data.json"
        if unit_path.exists():
            units = json.loads(unit_path.read_text())
            unit_id_to_code = {u["id"]: u["code"] for u in units}
        else:
            print(f"Error: academic_unit data not found at {unit_path}")
            return

        # Build list of (campus_code, academic_unit_code) combinations
        academic_unit_campus_data = []
        for relation in relations:
            campus_id = relation.get("campus_id")
            academic_unit_id = relation.get("academic_unit_id")

            campus_code = campus_id_to_code.get(campus_id)
            academic_unit_code = unit_id_to_code.get(academic_unit_id)

            if campus_code and academic_unit_code:
                academic_unit_campus_data.append(
                    {
                        "campus_code": campus_code,
                        "academic_unit_code": academic_unit_code,
                    }
                )

        from src.tui.download import run_study_plan_download

        run_study_plan_download(
            output_dir=output_dir,
            academic_unit_campus_data=academic_unit_campus_data,
            verify_ssl=verify_ssl,
            concurrency=concurrency,
        )

    # Download academic_period (modalities and terms)
    if entity == "academic_period":
        client = AcademicPeriodClient(verify_ssl=verify_ssl)
        try:
            files = client.download_raw(output_dir)
            for source, path in files.items():
                print(f"Saved academic_period {source} data to {path}")
        finally:
            client.close()

    if entity == "course_offer":
        if not year:
            print("Error: --year is required for course_offer download")
            return

        unit_path = output_dir / "academic_unit" / "data.json"
        if not unit_path.exists():
            print(f"Error: academic_unit data not found at {unit_path}")
            print("Please run 'process' command first to generate academic_unit data.")
            return

        units = json.loads(unit_path.read_text())
        school_codes = [u["code"] for u in units]

        client = AcademicUnitClient(verify_ssl=verify_ssl)
        try:
            files = client.download_oferta_cursos(output_dir, school_codes, year)
            for code, path in files.items():
                print(f"Saved course_offer for {code} to: {path}")
        finally:
            client.close()

    if entity == "schedule_guia":
        if not year:
            print("Error: --year is required for schedule_guia download")
            return

        course_offer_path = output_dir / "course_offer" / year
        if not course_offer_path.exists():
            print(f"Error: course_offer data not found at {course_offer_path}")
            print("Please run 'download --entity course_offer --year {year}' first.")
            return

        client = AcademicUnitClient(verify_ssl=verify_ssl)
        try:
            files = client.download_horarios_from_course_offer(output_dir, year)
            for file_name, path in files.items():
                print(f"Saved schedule_guia {file_name} to: {path}")
        finally:
            client.close()
