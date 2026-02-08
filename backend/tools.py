"""Tool registry for CrewAI agents.

Provides web_search, web_scraper, terminal (sandboxed), and file_writer tools.
"""
from __future__ import annotations

import os
import subprocess
import textwrap

from crewai.tools import BaseTool
from crewai_tools import FileWriterTool, ScrapeWebsiteTool, SerperDevTool


# ---------------------------------------------------------------------------
# SandboxedShellTool — safe subset of shell commands
# ---------------------------------------------------------------------------

_ALLOWED_CMDS = {
    "ls", "dir", "cat", "type", "head", "tail", "grep", "find", "wc",
    "pwd", "echo", "date", "python", "node", "git", "pip", "npm",
}

_BLOCKED_PATTERNS = [
    "rm", "del", "rmdir", "format", "install", "uninstall",
    "--force", "-rf", ">>", ">",
]

_SHELL_TIMEOUT = 30
_MAX_OUTPUT = 5000


class SandboxedShellTool(BaseTool):
    name: str = "terminal"
    description: str = (
        "Run a shell command in a sandboxed environment. "
        "Allowed commands: ls, dir, cat, type, head, tail, grep, find, wc, "
        "pwd, echo, date, python, node, git, pip, npm. "
        "Dangerous operations (rm, del, install, push, redirects) are blocked."
    )

    def _run(self, command: str) -> str:
        # Extract the base command (first token)
        parts = command.strip().split()
        if not parts:
            return "Error: empty command"

        base_cmd = parts[0].lower()
        if base_cmd not in _ALLOWED_CMDS:
            return f"Error: command '{base_cmd}' is not in the allowed list: {', '.join(sorted(_ALLOWED_CMDS))}"

        # Check for blocked patterns anywhere in the command
        cmd_lower = command.lower()
        for pattern in _BLOCKED_PATTERNS:
            if pattern in cmd_lower:
                return f"Error: blocked pattern '{pattern}' detected in command"

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=_SHELL_TIMEOUT,
            )
            output = result.stdout
            if result.stderr:
                output += "\n" + result.stderr
            output = output.strip()
            if len(output) > _MAX_OUTPUT:
                output = output[:_MAX_OUTPUT] + f"\n... (truncated at {_MAX_OUTPUT} chars)"
            return output or "(no output)"
        except subprocess.TimeoutExpired:
            return f"Error: command timed out after {_SHELL_TIMEOUT}s"
        except Exception as e:
            return f"Error running command: {e}"


# ---------------------------------------------------------------------------
# Safe wrappers for external tools (always return a STRING tool_result)
# ---------------------------------------------------------------------------

import json


class SafeSerperDevTool(SerperDevTool):
    def _run(self, *args, **kwargs):  # type: ignore[override]
        print(f"[TOOL CALL] web_search | args={args} | kwargs={kwargs}")
        try:
            out = super()._run(*args, **kwargs)
            print(f"[TOOL OUT TYPE] web_search | type={type(out)} | is_str={isinstance(out, str)}")
            # Ensure output is always a string
            if isinstance(out, str):
                return out
            return json.dumps(out, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[TOOL ERROR] web_search | {e}")
            return f"Tool error (web_search): {e}"


class SafeScrapeWebsiteTool(ScrapeWebsiteTool):
    def _run(self, *args, **kwargs):  # type: ignore[override]
        print(f"[TOOL CALL] web_scraper | args={args} | kwargs={kwargs}")
        try:
            out = super()._run(*args, **kwargs)
            print(f"[TOOL OUT TYPE] web_scraper | type={type(out)} | is_str={isinstance(out, str)}")
            # Ensure output is always a string
            if isinstance(out, str):
                return out
            return json.dumps(out, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[TOOL ERROR] web_scraper | {e}")
            return f"Tool error (web_scraper): {e}"


class SafeFileWriterTool(FileWriterTool):
    def _run(self, *args, **kwargs):  # type: ignore[override]
        print(f"[TOOL CALL] file_writer | args={args} | kwargs={kwargs}")
        try:
            out = super()._run(*args, **kwargs)
            print(f"[TOOL OUT TYPE] file_writer | type={type(out)} | is_str={isinstance(out, str)}")
            # Ensure output is always a string
            if isinstance(out, str):
                return out
            return json.dumps(out, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[TOOL ERROR] file_writer | {e}")
            return f"Tool error (file_writer): {e}"


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

TOOL_REGISTRY: dict[str, dict] = {
    "web_search": {
        "id": "web_search",
        "label": "Web Search",
        "description": "Search the web using Serper API for real-time information",
        "env_key": "SERPER_API_KEY",
        "factory": lambda: SafeSerperDevTool(),
    },
    "web_scraper": {
        "id": "web_scraper",
        "label": "Web Scraper",
        "description": "Read and extract content from any URL",
        "env_key": None,
        "factory": lambda: SafeScrapeWebsiteTool(),
    },
    "terminal": {
        "id": "terminal",
        "label": "Terminal",
        "description": "Run sandboxed shell commands (ls, cat, grep, python, git, etc.)",
        "env_key": None,
        "factory": lambda: SandboxedShellTool(),
    },
    "file_writer": {
        "id": "file_writer",
        "label": "File Writer",
        "description": "Write content to files on disk",
        "env_key": None,
        "factory": lambda: SafeFileWriterTool(),
    },
}


def get_available_tools() -> list[dict]:
    """Return metadata for all tools (for GET /tools endpoint)."""
    result = []
    for tool_id, info in TOOL_REGISTRY.items():
        env_key = info["env_key"]
        available = True
        if env_key:
            available = bool(os.environ.get(env_key))
        result.append({
            "id": info["id"],
            "label": info["label"],
            "description": info["description"],
            "requires_key": env_key,
            "available": available,
        })
    return result


def instantiate_tools(tool_ids: list[str]) -> list:
    """Create tool instances for the given IDs, skipping unavailable ones."""
    tools = []
    for tid in tool_ids:
        entry = TOOL_REGISTRY.get(tid)
        if not entry:
            continue
        # Skip tools that need an env key that isn't set
        env_key = entry["env_key"]
        if env_key and not os.environ.get(env_key):
            continue
        try:
            tools.append(entry["factory"]())
        except Exception as e:
            print(f"Warning: failed to instantiate tool '{tid}': {e}")
    return tools
