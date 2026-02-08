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
# Workspace paths
# ---------------------------------------------------------------------------

_WORKSPACE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workspace")
_INPUT_DIR = os.path.join(_WORKSPACE_DIR, "input")
_OUTPUT_DIR = os.path.join(_WORKSPACE_DIR, "output")

# Ensure workspace directories exist at import time
os.makedirs(_INPUT_DIR, exist_ok=True)
os.makedirs(_OUTPUT_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# File reader tool (reads from workspace/input/)
# ---------------------------------------------------------------------------

@tool
def file_reader(file_name: str) -> str:
    """Read a file from the input folder.

    Args:
        file_name: The name of the file to read (e.g. "brief.txt", "data.csv").
                   Subdirectories are allowed (e.g. "subdir/file.txt").
    """
    try:
        safe_path = os.path.normpath(file_name)
        if safe_path.startswith("..") or os.path.isabs(safe_path):
            return "Error: path must be relative and inside the input folder"

        abs_path = os.path.join(_INPUT_DIR, safe_path)
        if not os.path.abspath(abs_path).startswith(os.path.abspath(_INPUT_DIR)):
            return "Error: path escapes the input folder"

        if not os.path.exists(abs_path):
            return f"Error: file '{file_name}' not found in input folder"

        with open(abs_path, "r", encoding="utf-8") as f:
            content = f.read()

        if len(content) > _MAX_OUTPUT:
            content = content[:_MAX_OUTPUT] + f"\n... (truncated at {_MAX_OUTPUT} chars)"
        return content or "(empty file)"
    except Exception as e:
        return f"Error reading file: {e}"


# ---------------------------------------------------------------------------
# List input files tool
# ---------------------------------------------------------------------------

@tool
def list_input_files() -> str:
    """List all files available in the input folder."""
    try:
        files = []
        for root, dirs, filenames in os.walk(_INPUT_DIR):
            for fname in filenames:
                if fname.startswith("."):
                    continue
                rel = os.path.relpath(os.path.join(root, fname), _INPUT_DIR)
                files.append(rel)
        if not files:
            return "(no files in input folder)"
        return "\n".join(sorted(files))
    except Exception as e:
        return f"Error listing files: {e}"


# ---------------------------------------------------------------------------
# File writer tool (writes to workspace/output/)
# ---------------------------------------------------------------------------

class FileWriteInput(BaseModel):
    file_path: str = Field(description="The file name/path to write inside the output folder (e.g. 'report.md', 'results/data.csv')")
    content: str = Field(description="The content to write to the file")


@tool(args_schema=FileWriteInput)
def file_writer(file_path: str, content: str) -> str:
    """Write content to a file in the output folder.

    Args:
        file_path: Relative path inside the output folder (e.g. "report.md").
        content: The content to write to the file.
    """
    try:
        safe_path = os.path.normpath(file_path)
        if safe_path.startswith("..") or os.path.isabs(safe_path):
            return "Error: path must be relative and inside the output folder"

        abs_path = os.path.join(_OUTPUT_DIR, safe_path)
        if not os.path.abspath(abs_path).startswith(os.path.abspath(_OUTPUT_DIR)):
            return "Error: path escapes the output folder"

        # Create subdirectories if needed
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)

        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote {len(content)} characters to output/{file_path}"
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
    "file_reader": {
        "id": "file_reader",
        "label": "File Reader",
        "description": "Read files from the input folder",
        "env_key": None,
        "factory": lambda: file_reader,
    },
    "list_input_files": {
        "id": "list_input_files",
        "label": "List Input Files",
        "description": "List all files available in the input folder",
        "env_key": None,
        "factory": lambda: list_input_files,
    },
    "file_writer": {
        "id": "file_writer",
        "label": "File Writer",
        "description": "Write content to files in the output folder",
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
