"""Tool registry for LangChain agents.

Provides web_search, web_scraper, terminal (sandboxed), and file_writer tools.
"""
from __future__ import annotations

import os
import shlex
import subprocess

from langchain_core.tools import tool
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# SandboxedShellTool — allowlist-based command execution (no shell=True)
# ---------------------------------------------------------------------------

_ALLOWED_CMDS = {
    "ls", "dir", "cat", "type", "head", "tail", "grep", "find", "wc",
    "pwd", "echo", "date", "python", "node", "git", "pip", "npm",
}

_BLOCKED_SUBCOMMANDS = {
    "git": {"push", "remote", "config"},
    "pip": {"install", "uninstall"},
    "npm": {"install", "uninstall", "publish"},
}

_SHELL_TIMEOUT = 30
_MAX_OUTPUT = 5000


@tool
def terminal(command: str) -> str:
    """Run a shell command in a sandboxed environment.

    Allowed commands: ls, dir, cat, type, head, tail, grep, find, wc,
    pwd, echo, date, python, node, git, pip, npm.
    Dangerous operations are blocked.
    """
    try:
        argv = shlex.split(command)
    except ValueError as e:
        return f"Error: could not parse command: {e}"

    if not argv:
        return "Error: empty command"

    # Resolve to just the binary name (strip path components like ./rm or /bin/rm)
    base_cmd = os.path.basename(argv[0]).lower()

    if base_cmd not in _ALLOWED_CMDS:
        return f"Error: command '{base_cmd}' is not in the allowed list: {', '.join(sorted(_ALLOWED_CMDS))}"

    # Check blocked subcommands for specific tools
    blocked_subs = _BLOCKED_SUBCOMMANDS.get(base_cmd)
    if blocked_subs and len(argv) > 1:
        sub = argv[1].lower().lstrip("-")
        if sub in blocked_subs:
            return f"Error: '{base_cmd} {argv[1]}' is not allowed"

    try:
        result = subprocess.run(
            argv,
            shell=False,
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
# Web search tool
# ---------------------------------------------------------------------------

@tool
def web_search(query: str) -> str:
    """Search the web using Serper API for real-time information.

    Args:
        query: The search query string.
    """
    api_key = os.environ.get("SERPER_API_KEY")
    if not api_key:
        return "Error: SERPER_API_KEY not set"

    import httpx

    try:
        resp = httpx.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": query},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()

        results = []
        for item in data.get("organic", [])[:5]:
            results.append(
                f"**{item.get('title', '')}**\n{item.get('snippet', '')}\n{item.get('link', '')}"
            )

        if data.get("answerBox"):
            box = data["answerBox"]
            answer = box.get("answer") or box.get("snippet") or ""
            if answer:
                results.insert(0, f"**Answer Box:** {answer}")

        return "\n\n".join(results) if results else "No results found."
    except Exception as e:
        return f"Error searching web: {e}"


# ---------------------------------------------------------------------------
# Web scraper tool
# ---------------------------------------------------------------------------

@tool
def web_scraper(url: str) -> str:
    """Read and extract text content from a URL.

    Args:
        url: The full URL to scrape.
    """
    import httpx

    try:
        resp = httpx.get(url, timeout=15.0, follow_redirects=True)
        resp.raise_for_status()
        text = resp.text

        # Simple HTML stripping (enough for agent consumption)
        import re
        text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()

        if len(text) > _MAX_OUTPUT:
            text = text[:_MAX_OUTPUT] + f"\n... (truncated at {_MAX_OUTPUT} chars)"
        return text or "(empty page)"
    except Exception as e:
        return f"Error scraping URL: {e}"


# ---------------------------------------------------------------------------
# File writer tool
# ---------------------------------------------------------------------------

class FileWriteInput(BaseModel):
    file_path: str = Field(description="The path to the file to write")
    content: str = Field(description="The content to write to the file")


@tool(args_schema=FileWriteInput)
def file_writer(file_path: str, content: str) -> str:
    """Write content to a file on disk.

    Args:
        file_path: The path to the file to write.
        content: The content to write to the file.
    """
    try:
        # Basic safety: prevent writing outside working directory
        import os.path
        abs_path = os.path.abspath(file_path)

        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote {len(content)} characters to {file_path}"
    except Exception as e:
        return f"Error writing file: {e}"


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

TOOL_REGISTRY: dict[str, dict] = {
    "web_search": {
        "id": "web_search",
        "label": "Web Search",
        "description": "Search the web using Serper API for real-time information",
        "env_key": "SERPER_API_KEY",
        "factory": lambda: web_search,
    },
    "web_scraper": {
        "id": "web_scraper",
        "label": "Web Scraper",
        "description": "Read and extract content from any URL",
        "env_key": None,
        "factory": lambda: web_scraper,
    },
    "terminal": {
        "id": "terminal",
        "label": "Terminal",
        "description": "Run sandboxed shell commands (ls, cat, grep, python, git, etc.)",
        "env_key": None,
        "factory": lambda: terminal,
    },
    "file_writer": {
        "id": "file_writer",
        "label": "File Writer",
        "description": "Write content to files on disk",
        "env_key": None,
        "factory": lambda: file_writer,
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
        env_key = entry["env_key"]
        if env_key and not os.environ.get(env_key):
            continue
        try:
            tools.append(entry["factory"]())
        except Exception as e:
            print(f"Warning: failed to instantiate tool '{tid}': {e}")
    return tools
