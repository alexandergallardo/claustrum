from __future__ import annotations

import sys
from collections.abc import Iterable, Iterator
from typing import Any, TypeVar

from rich.console import Console
from rich.panel import Panel
from rich.progress import track
from rich.table import Table

T = TypeVar("T")
console = Console()


def title(text: str) -> None:
    console.print()
    console.print(Panel(f"[bold cyan]{text}[/bold cyan]", expand=False))


def step(index: int, total: int, text: str) -> None:
    console.print()
    console.print(f"[bold blue]Step {index}/{total}:[/bold blue] [bold white]{text}[/bold white]")


def info(text: str) -> None:
    console.print(f"[cyan]•[/cyan] {text}")


def success(text: str) -> None:
    console.print(f"[bold green]✓[/bold green] {text}")


def warning(text: str) -> None:
    console.print(f"[bold yellow]![/bold yellow] {text}")


def format_count(value: object) -> str:
    if isinstance(value, int):
        return f"{value:,}"
    return str(value)


def summary(title_text: str, values: dict[str, Any]) -> None:
    console.print()
    console.print(f"[bold underline]{title_text}[/bold underline]")
    if not values:
        console.print("  [dim](sin datos)[/dim]")
        return
    
    table = Table(show_header=False, box=None)
    table.add_column("Key", style="cyan")
    table.add_column("Value", style="bold")
    for label, value in values.items():
        table.add_row(label, format_count(value))
    console.print(table)


def match_summary(result: dict[str, Any]) -> None:
    summary(
        "Resumen de matching",
        {
            "profesores en MisProfesores": result.get("site_professors", 0),
            "matches reconocidos": result.get("recognized", 0),
            "sin match": result.get("unmatched", 0),
            "matches manuales cargados": result.get("manual_matches", 0),
        },
    )
    status_counts = result.get("status_counts")
    if isinstance(status_counts, dict):
        summary("Estados", {str(key): value for key, value in sorted(status_counts.items())})


def progress_bar(current: int, total: int, *, label: str = "", width: int = 40) -> str:
    if total <= 0:
        return f"{label} 0/0"
    current = min(max(current, 0), total)
    filled = round(width * current / total)
    bar = "━" * filled + " " * (width - filled)
    percent = round(100 * current / total)
    prefix = f"{label} " if label else ""
    return f"{prefix}{bar} {percent:>3}% {current:,}/{total:,} pages"


def progress_iter(items: Iterable[T], *, total: int, label: str) -> Iterator[tuple[int, T]]:
    # Usar enumerate con track para mantener la firma (index, item)
    yield from enumerate(track(items, description=label, total=total, console=console), start=1)


def print_download_result(result: dict[str, Any]) -> None:
    source_id = result.get("source_professor_id")
    professor_id = result.get("professor_id") or "candidate"
    pages = result.get("downloaded_pages", 0)
    new_reviews = result.get("new_reviews", 0)
    reason = result.get("stop_reason", "")
    console.print(f"  [dim]- source {source_id} → professor {professor_id}: {pages} pages, {new_reviews} new, cutoff={reason}[/dim]")


def flush_line() -> None:
    sys.stdout.flush()
