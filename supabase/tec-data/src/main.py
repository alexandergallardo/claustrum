"""Main CLI entry point."""

from pathlib import Path

import typer

from src.commands.download import download
from src.commands.process import run_process
from src.commands.sql import run_sql
from src.commands.sync import sync_cmd

app = typer.Typer(pretty_exceptions_show_locals=False)


@app.command("download")
def download_cmd(
    data_dir: Path = typer.Option(
        Path("data/raw"), "--data-dir", "-d", help="Data directory for raw files"
    ),
    entity: str | None = typer.Option(
        None, "--entity", "-e", help="Specific entity to download (e.g., campus)"
    ),
    concurrency: int = typer.Option(
        3,
        "--concurrency",
        "-c",
        min=1,
        max=10,
        help="Max concurrent plan detail downloads",
    ),
    year: str | None = typer.Option(
        None, "--year", "-y", help="Year for course_offer download (e.g., 2026)"
    ),
) -> None:
    """Download raw data from TEC APIs."""
    download(output_dir=data_dir, entity=entity, concurrency=concurrency, year=year)
    if entity != "study_plan":
        typer.echo(f"Downloaded raw data to {data_dir}")


@app.command("process")
def process_cmd_cli(
    data_dir: Path = typer.Option(
        Path("data/raw"), "--data-dir", "-d", help="Data directory with raw files"
    ),
    entity: str | None = typer.Option(
        None, "--entity", "-e", help="Specific entity to process (e.g., campus)"
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
        data_dir=data_dir, entity=entity, university_id=university_id, years=years_list
    )


@app.command("sql")
def sql_cmd(
    data_dir: Path = typer.Option(
        Path("data/raw"), "--data-dir", "-d", help="Data directory for processed files"
    ),
    output: Path = typer.Option(
        Path("../seed.sql"), "--output", "-o", help="Output SQL file path"
    ),
    tables: str | None = typer.Option(
        None, "--tables", "-t", help="Comma-separated list of tables to include"
    ),
) -> None:
    """Generate SQL inserts from processed data."""
    run_sql(data_dir=data_dir, output=output, tables=tables)


@app.command("sync")
def sync_cli(
    data_dir: Path = typer.Option(
        Path("data/raw"), "--data-dir", "-d", help="Data directory for processed files"
    ),
    target: str = typer.Option(
        "local", "--target", help="Destination target: local, remote, db-url"
    ),
    db_url: str | None = typer.Option(
        None, "--db-url", help="Destination Postgres URL (required for target=db-url)"
    ),
    env_file: Path = typer.Option(
        Path("../../.env.production.local"),
        "--env-file",
        help="Env file used when target=remote",
    ),
    years: str = typer.Option(
        "2026", "--years", "-y", help="Comma-separated years for offering sync"
    ),
    skip_pipeline: bool = typer.Option(
        False,
        "--skip-pipeline",
        help="Skip download/process pipeline and reuse current data/raw",
    ),
    skip_download: bool = typer.Option(
        False,
        "--skip-download",
        help="Run process steps only, reusing previously downloaded raw files",
    ),
    apply_seed: bool = typer.Option(
        True,
        "--apply/--no-apply",
        help="Apply generated SQL seed",
    ),
    verify: bool = typer.Option(
        True,
        "--verify/--no-verify",
        help="Run verification queries after apply",
    ),
    output: Path | None = typer.Option(
        None,
        "--output",
        "-o",
        help="Output SQL path (defaults to timestamped seed in ../seeds/tec-data)",
    ),
    keep_sql: bool = typer.Option(
        True,
        "--keep-sql",
        help="Keep generated SQL file after command finishes",
    ),
) -> None:
    """Run a full idempotent synchronization against local or remote DB."""
    sync_cmd(
        data_dir=data_dir,
        target=target,
        db_url=db_url,
        env_file=env_file,
        years=years,
        skip_pipeline=skip_pipeline,
        skip_download=skip_download,
        apply_seed=apply_seed,
        verify=verify,
        output=output,
        keep_sql=keep_sql,
    )


if __name__ == "__main__":
    app()
