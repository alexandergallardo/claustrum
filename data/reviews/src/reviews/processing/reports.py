from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from .courses import CONFIDENCE_ORDER
from reviews.paths import PROCESSED_ROOT


def collect_reports(processed_files: list[Path]) -> dict[str, Any]:
    course_failures: list[dict[str, Any]] = []
    ambiguous_course_reviews: list[dict[str, Any]] = []
    offering_backfill_reviews: list[dict[str, Any]] = []
    multiple_course_reviews: list[dict[str, Any]] = []
    grade_report: Counter[str] = Counter()
    tag_report: Counter[str] = Counter()
    incomplete_reviews: list[dict[str, Any]] = []

    for path in processed_files:
        data = json.loads(path.read_text())
        for index, review in enumerate(data.get("reviews") or []):
            courses = [item for item in review.get("courses", []) if isinstance(item, dict)]
            accepted_courses = [
                item
                for item in courses
                if item.get("id") is not None
                and CONFIDENCE_ORDER.get(str(item.get("confidence") or "none"), 0) >= CONFIDENCE_ORDER["high"]
            ]
            if review.get("processing_status") != "ready" and (
                not accepted_courses or "course_match_below_confidence_threshold" in (review.get("processing_notes") or [])
            ):
                first_course = courses[0] if courses else {}
                course_failures.append(
                    {
                        "path": str(path.relative_to(PROCESSED_ROOT)),
                        "review_index": index,
                        "professor_id": data.get("professor_id"),
                        "source_professor_id": data.get("source_professor_id"),
                        "course_id": first_course.get("id"),
                        "confidence": first_course.get("confidence"),
                        "method": first_course.get("method"),
                        "reason": first_course.get("reason"),
                        "courses": courses,
                    }
                )
            if "multiple_courses_without_primary" in (review.get("processing_notes") or []):
                ambiguous_course_reviews.append(
                    {
                        "path": str(path.relative_to(PROCESSED_ROOT)),
                        "review_index": index,
                        "professor_id": data.get("professor_id"),
                        "source_professor_id": data.get("source_professor_id"),
                        "courses": courses,
                    }
                )
            grade_report[str(review.get("raw_received_grade")) + " -> " + str(review.get("grade_received"))] += 1
            for tag in review.get("tags") or []:
                tag_report[tag] += 1
            if review.get("processing_status") != "ready":
                incomplete_reviews.append(
                    {
                        "path": str(path.relative_to(PROCESSED_ROOT)),
                        "review_index": index,
                        "notes": review.get("processing_notes"),
                    }
                )
            backfill_courses = [item for item in courses if item.get("requires_offering_backfill")]
            if backfill_courses:
                offering_backfill_reviews.append(
                    {
                        "path": str(path.relative_to(PROCESSED_ROOT)),
                        "review_index": index,
                        "professor_id": data.get("professor_id"),
                        "source_professor_id": data.get("source_professor_id"),
                        "courses": backfill_courses,
                    }
                )
            if len(courses) > 1:
                multiple_course_reviews.append(
                    {
                        "path": str(path.relative_to(PROCESSED_ROOT)),
                        "review_index": index,
                        "professor_id": data.get("professor_id"),
                        "source_professor_id": data.get("source_professor_id"),
                        "courses": courses,
                    }
                )

    return {
        "course_match_failures": course_failures,
        "ambiguous_course_reviews": ambiguous_course_reviews,
        "grade_normalization": dict(grade_report.most_common()),
        "tag_counts": dict(tag_report.most_common()),
        "incomplete_reviews": incomplete_reviews,
        "offering_backfill_reviews": offering_backfill_reviews,
        "multiple_course_reviews": multiple_course_reviews,
    }
