from __future__ import annotations

import argparse
from datetime import datetime, timezone
from typing import Any

from reviews.console import info, match_summary, print_download_result, progress_iter, step, success, title, warning
from reviews.paths import RAW_CANDIDATES_ROOT, RAW_PROFESSORS_ROOT, PROFESSORS_OUTPUT
from reviews.processing.pipeline import main as process_main
from reviews.professors.audit import main as audit_main
from reviews.professors.matching import build_matches
from reviews.reconcile import reconcile_matching_state
from reviews.reviews.downloader import download_profile, load_candidate_entries, load_download_index, load_match_files, save_download_index
from reviews.db import load_professors, load_professor_courses, save_json
from reviews.text import normalize_name


def run_matching(label: str) -> dict[str, Any]:
    info(label)
    result = build_matches()
    match_summary(result)
    return result


def download_candidate_evidence(
    *,
    index: dict[str, Any],
    fetched_at: str,
    candidate_limit: int | None,
    candidate_pages: int,
    refresh_all: bool,
    verbose: bool = False,
) -> int:
    candidates = load_candidate_entries(candidate_limit)
    if not candidates:
        warning("No hay perfiles unmatched para descargar como evidencia.")
        save_download_index(index)
        return 0

    for _, candidate in progress_iter(candidates, total=len(candidates), label="Evidencia candidates"):
        result = download_profile(
            candidate,
            output_root=RAW_CANDIDATES_ROOT,
            index=index,
            fetched_at=fetched_at,
            max_pages=candidate_pages,
            refresh_all=refresh_all,
        )
        if verbose:
            print_download_result(result)
    save_download_index(index)
    return len(candidates)


def download_confirmed_reviews(*, index: dict[str, Any], fetched_at: str, refresh_all: bool, verbose: bool = False) -> int:
    matches = load_match_files()
    if not matches:
        warning("No hay matches confirmados para actualizar reseñas.")
        save_download_index(index)
        return 0

    for _, match in progress_iter(matches, total=len(matches), label="Reseñas confirmadas"):
        result = download_profile(match, output_root=RAW_PROFESSORS_ROOT, index=index, fetched_at=fetched_at, refresh_all=refresh_all)
        if verbose:
            print_download_result(result)
    save_download_index(index)
    return len(matches)


def sync_command() -> None:
    parser = argparse.ArgumentParser(description="Run the full MisProfesores import workflow.")
    parser.add_argument("--include-unmatched", action="store_true", help="Download candidate evidence for unmatched profiles before the final match pass.")
    parser.add_argument("--candidate-limit", type=int, default=None, help="Limit unmatched candidate profiles downloaded.")
    parser.add_argument("--candidate-pages", type=int, default=2, help="Maximum pages per unmatched candidate profile.")
    parser.add_argument("--refresh-all", action="store_true", help="Force re-download of all known pages.")
    parser.add_argument("--skip-process", action="store_true", help="Skip normalized review processing after downloads.")
    parser.add_argument("--skip-audit", action="store_true", help="Skip professor match audit after processing.")
    parser.add_argument("--verbose-downloads", action="store_true", help="Print one line per downloaded profile.")
    args, process_args = parser.parse_known_args()

    title("Reviews import workflow")
    step(1, 5, "Matching inicial")
    run_matching("Calculando matches con evidencia existente...")

    index = load_download_index()
    fetched_at = datetime.now(timezone.utc).isoformat()

    step(2, 5, "Evidencia de perfiles unmatched")
    if args.include_unmatched:
        info(f"Descargando hasta {args.candidate_pages} páginas por perfil unmatched.")
        candidate_count = download_candidate_evidence(
            index=index,
            fetched_at=fetched_at,
            candidate_limit=args.candidate_limit,
            candidate_pages=args.candidate_pages,
            refresh_all=args.refresh_all,
            verbose=args.verbose_downloads,
        )
        success(f"Perfiles candidate descargados: {candidate_count:,}")

        step(3, 5, "Rematch con evidencia de cursos")
        run_matching("Recalculando matches con reseñas candidate...")
        reconcile_stats = reconcile_matching_state()
        if any(reconcile_stats.values()):
            success("Estado reconciliado automáticamente.")
            for key, value in reconcile_stats.items():
                if value:
                    info(f"{key}: {value:,}")
            if reconcile_stats.get("manual_overrides_removed", 0):
                run_matching("Recalculando matches después de quitar overrides manuales conflictivos...")
                reconcile_matching_state()
        else:
            success("No se encontraron conflictos de estado para reconciliar.")
    else:
        warning("Saltando evidencia unmatched. Usa --include-unmatched para mejorar matches ambiguos.")
        step(3, 5, "Rematch omitido")
        warning("No se ejecutó rematch porque no se descargó evidencia unmatched.")

    step(4, 5, "Actualización de reseñas confirmadas")
    confirmed_count = download_confirmed_reviews(index=index, fetched_at=fetched_at, refresh_all=args.refresh_all, verbose=args.verbose_downloads)
    success(f"Perfiles confirmados actualizados: {confirmed_count:,}")

    step(5, 5, "Procesamiento")
    if args.skip_process:
        warning("Procesamiento omitido por --skip-process.")
        return

    info("Procesando reseñas normalizadas...")
    import sys

    sys.argv = [sys.argv[0], *process_args]
    process_main()
    if not args.skip_audit:
        info("Ejecutando auditoría final...")
        audit_main()
    success("Workflow finalizado.")


def import_professor_command() -> None:
    parser = argparse.ArgumentParser(description="Download and process reviews for specific professors.")
    parser.add_argument("--professor-id", action="append", type=int, required=True, help="Local professor id to import. Can be repeated.")
    parser.add_argument("--complete-history", action="store_true", help="Continue past known overlap until all historical pages are saved.")
    parser.add_argument("--refresh-all", action="store_true", help="Force re-download all known pages instead of using idempotent overlap.")
    parser.add_argument("--quiet-download", action="store_true", help="Hide per-page download progress.")
    parser.add_argument("--write-sql", action="store_true", help="Write idempotent SQL files during processing.")
    parser.add_argument("--no-openrouter", action="store_true", help="Process without OpenRouter calls.")
    parser.add_argument("--max-openrouter-calls", type=int, default=None, help="Maximum OpenRouter calls during processing.")
    parser.add_argument("--min-course-confidence", choices=["high", "medium", "low"], default="high", help="Minimum course confidence for ready reviews.")
    args, process_args = parser.parse_known_args()

    professor_ids = set(args.professor_id)
    title("Import professor reviews")

    step(1, 3, "Descarga de historial completo")
    matches = [match for match in load_match_files() if match.professor_id in professor_ids]
    if not matches:
        warning("No se encontraron matches confirmados para esos professor_id.")
        return

    index = load_download_index()
    fetched_at = datetime.now(timezone.utc).isoformat()
    for profile_index, match in enumerate(matches, start=1):
        print(f"\nProfile {profile_index:,}/{len(matches):,}: professor {match.professor_id} · source {match.source_professor_id}")
        result = download_profile(
            match,
            output_root=RAW_PROFESSORS_ROOT,
            index=index,
            fetched_at=fetched_at,
            refresh_all=args.refresh_all,
            complete_history=args.complete_history,
            show_progress=not args.quiet_download,
        )
        info(
            f"source {result['source_professor_id']}: "
            f"{result['downloaded_pages']}/{result.get('total_pages', '?')} páginas, "
            f"{result['new_reviews']} reseñas nuevas, corte={result['stop_reason']}"
        )
    save_download_index(index)

    step(2, 3, "Procesamiento y SQL")
    import sys

    process_argv = [sys.argv[0], "--min-course-confidence", args.min_course_confidence]
    if args.write_sql:
        process_argv.append("--write-sql")
    if args.no_openrouter:
        process_argv.append("--no-openrouter")
    if args.max_openrouter_calls is not None:
        process_argv.extend(["--max-openrouter-calls", str(args.max_openrouter_calls)])
    for professor_id in sorted(professor_ids):
        process_argv.extend(["--professor-id", str(professor_id)])
    process_argv.extend(process_args)
    sys.argv = process_argv
    process_main()

    step(3, 3, "Auditoría")
    audit_main()
    success("Import finalizado.")


def refresh_matches_command() -> None:
    parser = argparse.ArgumentParser(
        description="Refresh professor matches using name, manual overrides, raw review evidence, and course evidence without processing reviews."
    )
    parser.add_argument("--no-unmatched-evidence", action="store_true", help="Do not download candidate evidence for unmatched profiles before rematching.")
    parser.add_argument("--candidate-limit", type=int, default=None, help="Limit unmatched candidate profiles downloaded.")
    parser.add_argument("--candidate-pages", type=int, default=2, help="Maximum pages per unmatched candidate profile.")
    parser.add_argument("--update-reviews", action="store_true", help="Also update confirmed raw reviews after rematching.")
    parser.add_argument("--refresh-all", action="store_true", help="Force re-download of all known pages when downloading evidence/reviews.")
    parser.add_argument("--verbose-downloads", action="store_true", help="Print one line per downloaded profile.")
    args = parser.parse_args()

    title("Refresh professor matches")
    step(1, 5, "Matching inicial")
    run_matching("Calculando matches con evidencia actual...")

    index = load_download_index()
    fetched_at = datetime.now(timezone.utc).isoformat()

    step(2, 5, "Evidencia de perfiles unmatched")
    if args.no_unmatched_evidence:
        warning("Saltando descarga de evidencia unmatched por --no-unmatched-evidence.")
    else:
        info(f"Descargando hasta {args.candidate_pages} páginas por perfil unmatched.")
        candidate_count = download_candidate_evidence(
            index=index,
            fetched_at=fetched_at,
            candidate_limit=args.candidate_limit,
            candidate_pages=args.candidate_pages,
            refresh_all=args.refresh_all,
            verbose=args.verbose_downloads,
        )
        success(f"Perfiles candidate descargados: {candidate_count:,}")

    step(3, 5, "Rematch y corrección por evidencia de cursos")
    run_matching("Recalculando matches con nombre, manuales y cursos de reseñas...")
    reconcile_stats = reconcile_matching_state()
    if any(reconcile_stats.values()):
        success("Estado reconciliado automáticamente.")
        for key, value in reconcile_stats.items():
            if value:
                info(f"{key}: {value:,}")
        if reconcile_stats.get("manual_overrides_removed", 0):
            run_matching("Recalculando matches después de quitar overrides manuales conflictivos...")
            reconcile_stats = reconcile_matching_state()
            if any(reconcile_stats.values()):
                success("Segunda reconciliación aplicada.")
                for key, value in reconcile_stats.items():
                    if value:
                        info(f"{key}: {value:,}")
    else:
        success("No se encontraron conflictos de estado para reconciliar.")

    step(4, 5, "Actualización de reseñas confirmadas")
    if args.update_reviews:
        confirmed_count = download_confirmed_reviews(index=index, fetched_at=fetched_at, refresh_all=args.refresh_all, verbose=args.verbose_downloads)
        success(f"Perfiles confirmados actualizados: {confirmed_count:,}")
    else:
        warning("Actualización de reseñas omitida. Usa --update-reviews para buscar reseñas nuevas.")

    step(5, 5, "Auditoría final")
    audit_main()
    success("Refresh de matches finalizado.")


def reviews_command() -> None:
    parser = argparse.ArgumentParser(description="Find, match, download and process reviews for a professor by name.")
    parser.add_argument("--name", required=True, type=str, help="Name of the professor to search for.")
    parser.add_argument("--candidate-pages", type=int, default=2, help="Maximum pages per unmatched candidate profile.")
    args, unknown_args = parser.parse_known_args()

    title(f"Búsqueda e importación por nombre: {args.name}")
    step(1, 4, "Buscando profesor en base de datos local")
    
    from rapidfuzz import process, fuzz
    db_professors = load_professors(only_active=True)
    if not db_professors:
        warning("No hay profesores activos en la base de datos.")
        return
        
    db_names = {prof["id"]: normalize_name(prof["full_name"]) for prof in db_professors}
    norm_query = normalize_name(args.name)
    best = process.extractOne(norm_query, db_names, scorer=fuzz.token_sort_ratio)
    
    if not best or best[1] < 60:
        warning(f"No se encontró un profesor similar a '{args.name}' en la BD.")
        return
        
    professor_id = best[2]
    db_prof = next(p for p in db_professors if p["id"] == professor_id)
    success(f"Encontrado: {db_prof['full_name']} (ID: {professor_id}, Score: {best[1]:.1f})")

    step(2, 4, "Desambiguación y Matching en MisProfesores")
    info("Obteniendo perfiles de MisProfesores y calculando matches...")
    from reviews.professors.discovery import scrape_site_professors, source_id_from_url
    from reviews.professors.matching import match_site_professor, load_db_professors, load_manual_matches, load_reviews_by_source
    from reviews.models import MatchEntry
    import json

    site_professors = scrape_site_professors()
    all_db_professors = load_db_professors()
    db_by_id = {p.id: p for p in all_db_professors}
    courses_by_prof = load_professor_courses()
    manual_matches = load_manual_matches()
    
    candidate_site_profs = []
    db_tokens = set(db_names[professor_id].split())
    for sp in site_professors:
        score = fuzz.token_sort_ratio(db_names[professor_id], sp.normalized_name)
        sp_tokens = set(sp.normalized_name.split())
        overlap = len(db_tokens & sp_tokens)
        if score > 80 or overlap >= 2 or (db_tokens and db_tokens <= sp_tokens):
            candidate_site_profs.append(sp)
            
    if not candidate_site_profs:
        warning("No se encontraron candidatos similares en MisProfesores.")
    else:
        info(f"Se encontraron {len(candidate_site_profs)} perfiles candidatos. Descargando evidencia...")
        index = load_download_index()
        fetched_at = datetime.now(timezone.utc).isoformat()
        
        for sp in candidate_site_profs:
            candidate_entry = MatchEntry(
                professor_id=0,
                source_professor_id=sp.source_professor_id,
                source_url=sp.url,
                site_name=sp.display_name,
                db_full_name="",
                is_manual=False,
                reason="targeted_candidate_evidence",
            )
            download_profile(
                candidate_entry,
                output_root=RAW_CANDIDATES_ROOT,
                index={"version": 1, "profiles": {}, "candidate_profiles": index.setdefault("candidate_profiles", {})},
                fetched_at=fetched_at,
                max_pages=args.candidate_pages,
                refresh_all=False,
            )
        save_download_index(index)
        
        reviews_by_source = load_reviews_by_source()
        
        existing_json = []
        if PROFESSORS_OUTPUT.exists():
            existing_json = json.loads(PROFESSORS_OUTPUT.read_text())
        existing_json_by_source = {str(source_id_from_url(item.get("misprofesores_url", ""))): item for item in existing_json}
        
        new_matches_found = False
        for sp in candidate_site_profs:
            matched, details = match_site_professor(
                sp,
                db_professors=all_db_professors,
                db_by_id=db_by_id,
                courses_by_professor=courses_by_prof,
                reviews_by_source=reviews_by_source,
                manual_matches=manual_matches,
            )
            if matched and matched["professor_id"] == professor_id:
                success(f"Match confirmado: {sp.url} (Score: {matched['match_score']})")
                new_matches_found = True
                existing_json_by_source[sp.source_professor_id] = matched
            elif matched:
                info(f"Descartado {sp.url} -> pertenece a otro prof (ID {matched['professor_id']})")
            else:
                info(f"Descartado {sp.url} -> sin match confiable")
                
        if new_matches_found:
            save_json(PROFESSORS_OUTPUT, list(existing_json_by_source.values()))

    print("")
    import sys
    sys.argv = [sys.argv[0], "--professor-id", str(professor_id), "--write-sql"] + unknown_args
    import_professor_command()
