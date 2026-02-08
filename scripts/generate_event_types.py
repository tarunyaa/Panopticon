#!/usr/bin/env python3
"""Generate src/types/events.ts from backend/events.py dataclasses.

Run: python scripts/generate_event_types.py

Makes the Python event dataclasses the single source of truth for the
WebSocket event schema shared between backend and frontend.
"""
from __future__ import annotations

import dataclasses
import inspect
import re
import sys
from pathlib import Path
from typing import get_type_hints, Literal, get_args, get_origin

# Add backend to path so we can import events
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

import events as events_module

# Maps from Python types to TypeScript types
_PY_TO_TS = {
    "str": "string",
    "int": "number",
    "float": "number",
    "bool": "boolean",
    "list": "string[]",
}

# Event classes to export (order matters for readability)
_EVENT_CLASSES = [
    "RunStartedEvent",
    "AgentIntentEvent",
    "AgentOutputEvent",
    "RunFinishedEvent",
    "TaskSummaryEvent",
    "ErrorEvent",
    "GateRequestedEvent",
    "GateRecommendedEvent",
    "AgentActivityEvent",
    "TaskHandoffEvent",
]

# Type alias literals defined at module level
_TYPE_ALIASES = {
    "ZoneId": events_module.ZoneId,
}

# Field-level type overrides for fields with literal union comments in the Python source
# These are parsed from inline comments like: # "task_complete" | "file_operation" | ...
_FIELD_OVERRIDES: dict[tuple[str, str], str] = {}


def _parse_field_literals():
    """Parse inline comments from events.py to find literal union types."""
    source = inspect.getsource(events_module)
    # Match: field_name: str = "default"  # "val1" | "val2" | ...
    pattern = re.compile(
        r'(\w+):\s*str\s*=\s*"[^"]*"\s*#\s*("[^"]+"\s*(?:\|\s*"[^"]+"\s*)+)',
    )
    # Find which class each field belongs to by tracking class context
    class_pattern = re.compile(r'^class (\w+)')
    current_class = None

    for line in source.split("\n"):
        class_match = class_pattern.match(line)
        if class_match:
            current_class = class_match.group(1)
            continue

        if current_class:
            field_match = pattern.search(line)
            if field_match:
                field_name = field_match.group(1)
                literal_str = field_match.group(2)
                # Convert "val1" | "val2" to TypeScript literal union
                _FIELD_OVERRIDES[(current_class, field_name)] = literal_str


def _resolve_type(cls_name: str, field_name: str, py_type: str) -> str:
    """Convert a Python type annotation to TypeScript."""
    # Check for field-level overrides
    override = _FIELD_OVERRIDES.get((cls_name, field_name))
    if override:
        return override

    # Check type aliases
    if py_type in _TYPE_ALIASES:
        return py_type

    # Check basic types
    if py_type in _PY_TO_TS:
        return _PY_TO_TS[py_type]

    return "unknown"


def _get_literal_ts(literal_type) -> str:
    """Convert a typing.Literal to a TypeScript union string."""
    args = get_args(literal_type)
    return " | ".join(f'"{a}"' for a in args)


def generate() -> str:
    """Generate TypeScript source from Python event dataclasses."""
    _parse_field_literals()

    lines = [
        "// AUTO-GENERATED from backend/events.py — do not edit manually.",
        "// Run: python scripts/generate_event_types.py",
        "",
    ]

    # Emit type aliases
    for alias_name, alias_type in _TYPE_ALIASES.items():
        ts_literal = _get_literal_ts(alias_type)
        lines.append(f"export type {alias_name} = {ts_literal};")
    lines.append("")

    # Emit interfaces
    for cls_name in _EVENT_CLASSES:
        cls = getattr(events_module, cls_name)
        if not dataclasses.is_dataclass(cls):
            continue

        lines.append(f"export interface {cls_name} {{")
        fields = dataclasses.fields(cls)

        for field in fields:
            py_type_name = field.type if isinstance(field.type, str) else field.type.__name__
            ts_type = _resolve_type(cls_name, field.name, py_type_name)

            # For the 'type' field, use the default value as a literal type
            if field.name == "type" and field.default:
                ts_type = f'"{field.default}"'

            # Special case: list fields with default None are optional arrays
            if py_type_name == "list" and field.default is None:
                lines.append(f"  {field.name}: string[];")
            else:
                lines.append(f"  {field.name}: {ts_type};")

        lines.append("}")
        lines.append("")

    # Emit WorldSnapshotEvent (frontend-only, not in Python)
    lines.append("export interface WorldSnapshotEvent {")
    lines.append('  type: "WORLD_SNAPSHOT";')
    lines.append("  agents: Array<{ name: string; zone: ZoneId }>;")
    lines.append("}")
    lines.append("")

    # Emit WSEvent union
    all_types = _EVENT_CLASSES + ["WorldSnapshotEvent"]
    lines.append("export type WSEvent =")
    for i, t in enumerate(all_types):
        sep = ";" if i == len(all_types) - 1 else ""
        prefix = "  | " if i > 0 else "  "
        lines.append(f"{prefix}{t}{sep}")
    lines.append("")

    return "\n".join(lines)


def main():
    ts_source = generate()
    out_path = Path(__file__).parent.parent / "src" / "types" / "events.ts"
    out_path.write_text(ts_source, encoding="utf-8")
    print(f"Generated {out_path} ({len(ts_source)} bytes)")


if __name__ == "__main__":
    main()
