from __future__ import annotations

import hashlib
import re

from bs4 import BeautifulSoup


def parse_total_pages(html: str) -> int:
    links = [int(page) for page in re.findall(r"\?pag=(\d+)", html)]
    return max([1, *links])


def source_review_id(review: dict[str, object]) -> str:
    report_url = str(review.get("report_url") or "")
    match = re.search(r"Reportar-Comentario_(\d+)", report_url)
    if match is not None:
        return match.group(1)
    payload = "|".join(
        str(review.get(key) or "")
        for key in ["date", "class_name", "comment", "quality_score", "ease_score", "received_grade"]
    )
    return "hash-" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


def extract_reviews(html: str) -> list[dict[str, object]]:
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select("tr")
    reviews: list[dict[str, object]] = []

    for row in rows:
        rating_cell = row.select_one("td.rating")
        class_cell = row.select_one("td.class")
        comments_cell = row.select_one("td.comments")
        if rating_cell is None or class_cell is None or comments_cell is None:
            continue

        date = rating_cell.select_one(".date")
        rating_type = rating_cell.select_one(".rating-type")
        scores = rating_cell.select(".score")
        class_name = class_cell.select_one(".name .response")
        attendance = class_cell.select_one(".attendance .response")
        received_grade = class_cell.select_one(".grade .response")
        tagbox = comments_cell.select(".tagbox span")
        comment = comments_cell.select_one(".commentsParagraph")
        report = comments_cell.select_one('a.report[href*="Reportar-Comentario_"]')
        helpful_links = comments_cell.select(".helpful-links.thumbs a.votar_icon")

        helpful_count = None
        not_helpful_count = None
        if len(helpful_links) >= 2:
            helpful = helpful_links[0].select_one(".count")
            not_helpful = helpful_links[1].select_one(".count")
            helpful_count = int(helpful.get_text(strip=True)) if helpful else None
            not_helpful_count = int(not_helpful.get_text(strip=True)) if not_helpful else None

        review = {
            "date": date.get_text(" ", strip=True) if date else None,
            "rating_type": rating_type.get_text(" ", strip=True) if rating_type else None,
            "quality_score": float(scores[0].get_text(strip=True)) if len(scores) > 0 else None,
            "ease_score": float(scores[1].get_text(strip=True)) if len(scores) > 1 else None,
            "class_name": class_name.get_text(" ", strip=True) if class_name else None,
            "attendance": attendance.get_text(" ", strip=True) if attendance else None,
            "received_grade": received_grade.get_text(" ", strip=True) if received_grade else None,
            "tags": [tag.get_text(" ", strip=True) for tag in tagbox],
            "comment": comment.get_text(" ", strip=True) if comment else None,
            "helpful": helpful_count,
            "not_helpful": not_helpful_count,
            "report_url": report["href"] if report and report.has_attr("href") else None,
        }
        review["source_review_id"] = source_review_id(review)
        reviews.append(review)
    return reviews
