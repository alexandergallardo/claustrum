"""Download command for raw data extraction."""

from pathlib import Path

from src.api.campus import CampusClient


def download(
    output_dir: Path = Path("data/raw"),
) -> None:
    """Download raw data from TEC APIs."""
    client = CampusClient()
    try:
        files = client.download_raw(output_dir)
        for source, path in files.items():
            print(f"Saved {source} data to: {path}")
    finally:
        client.close()
