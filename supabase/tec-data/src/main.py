"""Main CLI entry point."""

from pathlib import Path

import typer

from src.commands.download import download
from src.commands.process import run_process
from src.commands.sql import run_sql

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


if __name__ == "__main__":
    app()
