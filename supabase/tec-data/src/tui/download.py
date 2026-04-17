"""Textual UI for study plan downloads."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from textual import work
from textual.app import App, ComposeResult
from textual.containers import Vertical
from textual.widgets import Footer, Header, Label, Log, ProgressBar

from src.api.study_plan import StudyPlanClient


class StudyPlanDownloadApp(App):
    """Textual app to show download progress."""

    CSS = """
    Screen {
        layout: vertical;
        padding: 1 2;
    }

    #title {
        text-style: bold;
        margin-bottom: 1;
    }

    .section {
        margin-bottom: 1;
    }

    ProgressBar {
        margin: 0 0 1 0;
    }

    Log {
        height: 1fr;
        border: round $surface;
    }
    """

    def __init__(
        self,
        output_dir: Path,
        academic_unit_campus_data: list[dict[str, Any]],
        verify_ssl: bool,
        concurrency: int,
    ) -> None:
        super().__init__()
        self.output_dir = output_dir
        self.academic_unit_campus_data = academic_unit_campus_data
        self.verify_ssl = verify_ssl
        self.concurrency = concurrency
        self.total_relations = len(academic_unit_campus_data)
        self.last_plans_found = 0
        self.last_unique_plans = 0
        self.last_plans_fetched = 0
        self.last_plans_failed = 0

    def compose(self) -> ComposeResult:
        yield Header()
        with Vertical():
            yield Label("Downloading study plans", id="title")
            yield Label("Campus-unit combinations", classes="section")
            yield ProgressBar(total=max(self.total_relations, 1), id="combo_bar")
            yield Label("0/0", id="combo_label")
            yield Label("Unique plan details", classes="section")
            yield ProgressBar(total=1, id="plan_bar")
            yield Label("Pending", id="plan_label")
            yield Log(id="log", highlight=True)
        yield Footer()

    def on_mount(self) -> None:
        combo_bar = self.query_one("#combo_bar", ProgressBar)
        combo_bar.update(total=max(self.total_relations, 1), progress=0)
        self.query_one("#combo_label", Label).update(f"0/{self.total_relations} combos")
        self.query_one("#plan_label", Label).update(
            "Plans found 0, unique 0, fetched 0, failed 0"
        )
        self.query_one(Log).write_line("Starting download...")
        self.run_download()

    def log_event(self, message: str) -> None:
        self.query_one(Log).write_line(message)

    def handle_event(self, payload: dict[str, Any]) -> None:
        event = payload.get("event")
        if event == "combination":
            processed = payload.get("processed", 0)
            total = payload.get("total", self.total_relations)
            self.last_plans_found = payload.get("plans_found", self.last_plans_found)
            self.last_unique_plans = payload.get("unique_plans", self.last_unique_plans)
            self.last_plans_fetched = payload.get(
                "plans_fetched", self.last_plans_fetched
            )
            self.last_plans_failed = payload.get("plans_failed", self.last_plans_failed)

            combo_bar = self.query_one("#combo_bar", ProgressBar)
            combo_bar.update(progress=processed)
            self.query_one("#combo_label", Label).update(f"{processed}/{total} combos")
            self.query_one("#plan_label", Label).update(
                "Plans found {found}, unique {unique}, fetched {fetched}, failed {failed}".format(
                    found=self.last_plans_found,
                    unique=self.last_unique_plans,
                    fetched=self.last_plans_fetched,
                    failed=self.last_plans_failed,
                )
            )
        elif event == "plans_total":
            total = payload.get("total", 0)
            plan_bar = self.query_one("#plan_bar", ProgressBar)
            plan_bar.update(total=max(total, 1), progress=0)
        elif event == "plan_detail":
            fetched = payload.get("fetched", 0)
            failed = payload.get("failed", 0)
            total = payload.get("total", 0)
            self.last_plans_fetched = fetched
            self.last_plans_failed = failed

            plan_bar = self.query_one("#plan_bar", ProgressBar)
            plan_bar.update(progress=min(fetched + failed, max(total, 1)))
            self.query_one("#plan_label", Label).update(
                "Plans found {found}, unique {unique}, fetched {fetched}, failed {failed}".format(
                    found=payload.get("plans_found", self.last_plans_found),
                    unique=self.last_unique_plans,
                    fetched=fetched,
                    failed=failed,
                )
            )
        elif event == "no_plans":
            self.log_event(f"Careers without study plans: {payload.get('count', 0)}")
        elif event == "errors":
            self.log_event(f"Errors: {payload.get('count', 0)}")
        elif event == "complete":
            files = payload.get("files", {})
            self.log_event("Download complete.")
            for name, path in files.items():
                self.log_event(f"Saved {name}: {path}")
            self.set_timer(1.0, self.exit)

    @work(thread=True, exclusive=True)
    def run_download(self) -> None:
        def progress_callback(payload: dict[str, Any]) -> None:
            self.call_from_thread(self.handle_event, payload)

        client = StudyPlanClient(verify_ssl=self.verify_ssl)
        try:
            client.download_raw(
                self.output_dir,
                self.academic_unit_campus_data,
                max_concurrency=self.concurrency,
                progress_callback=progress_callback,
            )
        finally:
            client.close()


def run_study_plan_download(
    output_dir: Path,
    academic_unit_campus_data: list[dict[str, Any]],
    verify_ssl: bool,
    concurrency: int,
) -> None:
    """Run the study plan download TUI."""
    app = StudyPlanDownloadApp(
        output_dir=output_dir,
        academic_unit_campus_data=academic_unit_campus_data,
        verify_ssl=verify_ssl,
        concurrency=concurrency,
    )
    app.run()
