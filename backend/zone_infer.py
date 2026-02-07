"""Infer which map zone an agent belongs to based on its role, goal, and task."""

from __future__ import annotations

from typing import Literal

ZoneId = Literal["HOUSE", "WORKSHOP", "CAFE", "PARK"]

# Keywords → zone mapping.  Checked against role + goal + backstory + task description.
_ZONE_KEYWORDS: dict[ZoneId, list[str]] = {
    # HOUSE = the study / home office — planning, strategy, management
    "HOUSE": [
        "plan", "organiz", "manag", "coordinat", "strateg", "architect",
        "lead", "direct", "schedul", "priorit", "roadmap", "project",
        "oversee", "delegate", "decompos", "break down", "outline",
    ],
    # WORKSHOP = the workshop — research, analysis, coding, engineering
    "WORKSHOP": [
        "research", "analyz", "analys", "data", "code", "coding",
        "engineer", "develop", "build", "implement", "technic",
        "debug", "test", "experiment", "investigat", "compil",
        "program", "software", "algorithm", "database", "api",
        "scrape", "gather", "collect", "survey", "statistic",
    ],
    # CAFE = the cafe — writing, creativity, design, communication
    "CAFE": [
        "writ", "author", "creat", "design", "content", "copy",
        "blog", "story", "narrat", "draft", "composit", "essay",
        "article", "market", "brand", "communic", "social media",
        "illustrat", "visual", "graphic", "edit", "proofread",
        "document", "report", "summar", "present",
    ],
    # PARK = the park — review, QA, evaluation, general / catch-all
    "PARK": [
        "review", "quality", "QA", "validat", "evaluat", "assess",
        "feedback", "approv", "audit", "inspect", "verif", "check",
        "polish", "final", "refine",
    ],
}


def infer_zone(
    role: str = "",
    goal: str = "",
    backstory: str = "",
    task_description: str = "",
) -> ZoneId:
    """Score each zone by keyword hits and return the best match."""
    # Combine all text, lowercase for matching
    text = f"{role} {goal} {backstory} {task_description}".lower()

    best_zone: ZoneId = "PARK"
    best_score = 0

    for zone, keywords in _ZONE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw.lower() in text)
        if score > best_score:
            best_score = score
            best_zone = zone

    return best_zone
