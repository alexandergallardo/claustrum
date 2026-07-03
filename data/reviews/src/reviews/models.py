from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SiteProfessor:
    display_name: str
    normalized_name: str
    url: str
    department: str
    source_professor_id: str


@dataclass(frozen=True)
class DbProfessor:
    id: int
    full_name: str
    normalized_name: str


@dataclass(frozen=True)
class MatchEntry:
    professor_id: int
    source_professor_id: str
    source_url: str
    site_name: str = ""
    db_full_name: str = ""
    is_manual: bool = False
    reason: str | None = None
