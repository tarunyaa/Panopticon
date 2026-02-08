"""LangChain-powered Leader agent that plans teams and task delegation.

Replaces CrewAI-based planner with direct ChatAnthropic + tool calling.
"""
from __future__ import annotations

import os
import yaml
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from pydantic import BaseModel, Field


_dir = Path(__file__).parent

# Load .env from project root
_env_path = _dir.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

_MODEL = "claude-sonnet-4-5-20250929"


# ============================================================================
# Tool schemas for structured output
# ============================================================================


class AskQuestionInput(BaseModel):
    question: str = Field(description="A short, focused question (under 20 words) to ask the user")


class AgentSpec(BaseModel):
    key: str = Field(description="Lowercase agent key (e.g., 'carlos', 'abigail')")
    role: str = Field(description="Agent's role title")
    goal: str = Field(description="One-sentence goal")
    backstory: str = Field(description="2-5 sentence backstory with relevant expertise")
    tools: list[str] = Field(default_factory=list, description="Tool IDs: web_search, web_scraper, terminal, file_writer")
    task_description: str = Field(description="Generic task description with {prompt} placeholder")
    expected_output: str = Field(description="Explicit, checkable expected output format")


class CreateTeamInput(BaseModel):
    agents: list[AgentSpec] = Field(description="List of 3-4 agents including the Leader")


class DelegationTaskEntry(BaseModel):
    task_key: str = Field(description="Task key from tasks.yaml (e.g., 'abigail_task')")
    async_execution: bool = Field(default=False, description="Whether this task runs async (used by executor)")
    dependencies: list[str] = Field(default_factory=list, description="Task keys that must complete before this one")


class CreateDelegationPlanInput(BaseModel):
    tasks: list[DelegationTaskEntry] = Field(description="Ordered list of tasks to execute")


# ============================================================================
# Tool implementations
# ============================================================================


@tool(args_schema=AskQuestionInput)
def ask_question(question: str) -> str:
    """Ask the user ONE short, focused question (single sentence, under 20 words).
    Keep it concise and specific. No compound questions or follow-ups.
    Use this to gather information before creating the team.
    Maximum 8 questions total - stop early if you have enough context.
    """
    return f"Question sent to user: {question}"


@tool(args_schema=CreateTeamInput)
def create_team_files(agents: list[dict]) -> str:
    """Generate the final team configuration with 3-4 agents.
    Each agent must have: key, role, goal, backstory, tools, task_description, expected_output.
    The task_description MUST include a {prompt} placeholder.
    One agent MUST have role=Leader.
    """
    try:
        # Validate
        if len(agents) < 3 or len(agents) > 4:
            return f"Error: Must have 3-4 agents, got {len(agents)}"

        has_leader = False
        agents_config = {}
        tasks_config = {}

        allowed_tools = {"web_search", "web_scraper", "terminal", "file_writer"}

        for agent in agents:
            # Handle both dict and AgentSpec
            if isinstance(agent, BaseModel):
                agent = agent.model_dump()

            key = agent["key"]
            role = agent["role"]

            if "leader" in role.lower():
                has_leader = True

            # Validate tools
            agent_tools = agent.get("tools", [])
            invalid = [t for t in agent_tools if t not in allowed_tools]
            if invalid:
                return f"Error: Agent '{key}' has invalid tools: {invalid}"

            # Validate {prompt} placeholder
            desc = agent.get("task_description", "")
            if "{prompt}" not in desc:
                return f"Error: Agent '{key}' task_description missing {{prompt}} placeholder"

            agents_config[key] = {
                "role": role,
                "goal": agent["goal"],
                "backstory": agent["backstory"],
                "tools": agent_tools,
            }

            tasks_config[f"{key}_task"] = {
                "description": desc,
                "expected_output": agent.get("expected_output", ""),
                "agent": key,
            }

        if not has_leader:
            return "Error: One agent must have role=Leader"

        # Write files
        agents_path = _dir / "agents.yaml"
        tasks_path = _dir / "tasks.yaml"

        with open(agents_path, "w") as f:
            yaml.dump(agents_config, f, sort_keys=False, default_flow_style=False)

        with open(tasks_path, "w") as f:
            yaml.dump(tasks_config, f, sort_keys=False, default_flow_style=False)

        return f"SUCCESS: Team created with {len(agents)} agents. Configuration saved."

    except Exception as e:
        return f"Error creating team: {e}"


@tool(args_schema=CreateDelegationPlanInput)
def create_delegation_plan(tasks: list[dict]) -> str:
    """Create a delegation plan specifying which tasks to run, their order, and parallelization.
    Each task entry needs: task_key, async_execution (bool), dependencies (list of task keys).
    Tasks with no dependencies can run in parallel.
    Tasks with dependencies wait for those tasks to complete first.
    """
    try:
        # Validate
        if not tasks:
            return "Error: delegation plan must have at least one task"

        # Load current task config for validation
        tasks_path = _dir / "tasks.yaml"
        if not tasks_path.exists():
            return "Error: tasks.yaml not found"

        with open(tasks_path, "r") as f:
            tasks_config = yaml.safe_load(f)

        plan_tasks = []
        task_keys_seen = set()

        for entry in tasks:
            if isinstance(entry, BaseModel):
                entry = entry.model_dump()

            task_key = entry["task_key"]

            if task_key not in tasks_config:
                return f"Error: task_key '{task_key}' not found in tasks.yaml"

            if task_key in task_keys_seen:
                return f"Error: duplicate task_key '{task_key}'"
            task_keys_seen.add(task_key)

            deps = entry.get("dependencies", [])
            for dep in deps:
                if dep not in [t["task_key"] for t in tasks if isinstance(t, dict)] and dep not in task_keys_seen:
                    # Allow forward references — they'll be validated at execution time
                    pass

            plan_tasks.append({
                "task_key": task_key,
                "async_execution": entry.get("async_execution", False),
                "dependencies": deps,
            })

        # Write plan
        plan = {"tasks": plan_tasks}
        plan_path = _dir / "delegation_plan.yaml"
        with open(plan_path, "w") as f:
            yaml.dump(plan, f, sort_keys=False, default_flow_style=False)

        return f"SUCCESS: Delegation plan created with {len(plan_tasks)} tasks."

    except Exception as e:
        return f"Error creating delegation plan: {e}"


# ============================================================================
# Leader Agent Setup
# ============================================================================


def _load_leader_rules() -> str:
    """Load the leader_rules.md content to use as system prompt."""
    rules_path = _dir / "leader_rules.md"
    if not rules_path.exists():
        return "You are a team planning expert. Design a 3-4 agent team to solve the user's task."
    with open(rules_path, "r", encoding="utf-8") as f:
        return f.read()


def _build_conversation_context(team_description: str, history: list[dict]) -> str:
    """Build a context string from the conversation history."""
    parts = [f"User's team description:\n{team_description}\n"]

    question_count = 0
    for entry in history:
        if entry["role"] == "leader":
            parts.append(f"\nYou asked: {entry['content']}")
            question_count += 1
        elif entry["role"] == "user":
            parts.append(f"User answered: {entry['content']}")

    if history:
        if question_count >= 8:
            parts.append(
                "\nYou have asked 8 questions (the maximum). "
                "Now use create_team_files to generate the final team configuration."
            )
        else:
            parts.append(
                f"\nYou have asked {question_count} question(s) so far. "
                "Continue asking questions if needed, or use create_team_files when ready."
            )
    else:
        parts.append(
            "\nThis is the first interaction. Start by asking a clarifying question about the team type/domain using ask_question."
        )

    return "\n".join(parts)


# ============================================================================
# Main Planning Function
# ============================================================================


def plan_team(team_description: str, history: list[dict]) -> dict:
    """Run the Leader agent to plan a team.

    Uses ChatAnthropic with tool calling for structured interaction.

    Args:
        team_description: Description of the type of team needed
        history: List of {"role": "leader"|"user", "content": "..."} messages

    Returns:
        {"type": "question", "message": "..."}  - if Leader asks a question
        {"type": "team", "agents": [...]}        - if Leader creates the team
        {"type": "error", "message": "..."}      - if something goes wrong
    """
    try:
        leader_backstory = _load_leader_rules()
        context = _build_conversation_context(team_description, history)

        # Build LLM with tools
        llm = ChatAnthropic(
            model=_MODEL,
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            max_tokens=4096,
        )

        tools = [ask_question, create_team_files]
        llm_with_tools = llm.bind_tools(tools)

        messages = [
            SystemMessage(content=(
                f"{leader_backstory}\n\n"
                "IMPORTANT: You must use ONLY ONE tool in this turn. "
                "Either use ask_question to ask a single question, "
                "OR use create_team_files when you're ready to generate the team. "
                "After using the tool, stop."
            )),
            HumanMessage(content=context),
        ]

        # Call the model
        response = llm_with_tools.invoke(messages)

        # Check for tool calls
        if response.tool_calls:
            tool_call = response.tool_calls[0]  # Only process first tool call

            if tool_call["name"] == "ask_question":
                question = tool_call["args"].get("question", "Could you provide more details?")
                return {"type": "question", "message": question}

            elif tool_call["name"] == "create_team_files":
                # Execute the tool to write files
                agents_data = tool_call["args"].get("agents", [])
                result = create_team_files.invoke({"agents": agents_data})

                if "SUCCESS" in result:
                    # Reload and return the created team
                    agents_path = _dir / "agents.yaml"
                    tasks_path = _dir / "tasks.yaml"

                    with open(agents_path, "r") as f:
                        agents_config = yaml.safe_load(f)
                    with open(tasks_path, "r") as f:
                        tasks_config = yaml.safe_load(f)

                    agents = []
                    for agent_id, agent_data in agents_config.items():
                        role = agent_data.get("role", "")
                        if "leader" in role.lower():
                            continue

                        task_data = None
                        for task_key, t in tasks_config.items():
                            if t.get("agent") == agent_id:
                                task_data = t
                                break

                        agents.append({
                            "role": agent_data.get("role", ""),
                            "goal": agent_data.get("goal", ""),
                            "backstory": agent_data.get("backstory", ""),
                            "task_description": task_data.get("description", "") if task_data else "",
                            "expected_output": task_data.get("expected_output", "") if task_data else "",
                            "tools": agent_data.get("tools", []),
                        })

                    return {"type": "team", "agents": agents}
                else:
                    return {"type": "error", "message": result}

        # No tool call — the model responded with plain text instead of using a tool.
        # Ask the user a generic follow-up rather than trying to parse the text.
        return {
            "type": "question",
            "message": "Could you provide more details about your task?",
        }

    except Exception as e:
        return {
            "type": "error",
            "message": f"Planning error: {str(e)}",
        }


# ============================================================================
# Delegation Planning Function
# ============================================================================


def plan_task_delegation(task_prompt: str) -> dict:
    """Let the Leader analyze a specific task and create a delegation plan.

    Uses ChatAnthropic with tool calling for structured output.

    Args:
        task_prompt: The specific task the user wants the team to execute

    Returns:
        {"type": "plan", "plan": {...}}  - if Leader creates delegation plan
        {"type": "error", "message": "..."}  - if something goes wrong
    """
    try:
        # Load delegation rules
        delegation_rules_path = _dir / "delegation_rules.md"
        delegation_rules = ""
        if delegation_rules_path.exists():
            with open(delegation_rules_path, "r", encoding="utf-8") as f:
                delegation_rules = f.read()

        # Load current team configuration
        agents_path = _dir / "agents.yaml"
        tasks_path = _dir / "tasks.yaml"

        if not agents_path.exists() or not tasks_path.exists():
            return {
                "type": "error",
                "message": "Team configuration not found. Please create a team first.",
            }

        with open(agents_path, "r") as f:
            agents_config = yaml.safe_load(f)

        with open(tasks_path, "r") as f:
            tasks_config = yaml.safe_load(f)

        # Build context with team info
        team_context = "## Available Team\n\n### Agents:\n"
        for agent_key, agent_data in agents_config.items():
            team_context += f"\n**{agent_key}**:\n"
            team_context += f"- Role: {agent_data['role']}\n"
            team_context += f"- Goal: {agent_data['goal']}\n"

        team_context += "\n### Task Templates:\n"
        for task_key, task_data in tasks_config.items():
            team_context += f"\n**{task_key}**:\n"
            team_context += f"- Agent: {task_data['agent']}\n"
            team_context += f"- Description: {task_data['description']}\n"

        # Build LLM with delegation plan tool
        llm = ChatAnthropic(
            model=_MODEL,
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            max_tokens=4096,
        )

        tools = [create_delegation_plan]
        llm_with_tools = llm.bind_tools(tools)

        system_content = (
            f"{delegation_rules}\n\n"
            "You are the Task Delegation Planner. Analyze the user's task and create "
            "an optimal delegation plan.\n\n"
            f"{team_context}\n\n"
            "IMPORTANT:\n"
            "- Tasks with NO dependencies can run in TRUE PARALLEL\n"
            "- Use dependencies only when a task genuinely needs another's output\n"
            "- Maximize parallelism for faster execution\n"
            "- Use the create_delegation_plan tool to output your plan"
        )

        messages = [
            SystemMessage(content=system_content),
            HumanMessage(content=(
                f"User's specific task: {task_prompt}\n\n"
                "Create a delegation plan. Use the create_delegation_plan tool."
            )),
        ]

        response = llm_with_tools.invoke(messages)

        # Process tool call
        if response.tool_calls:
            tool_call = response.tool_calls[0]

            if tool_call["name"] == "create_delegation_plan":
                tasks_data = tool_call["args"].get("tasks", [])
                result = create_delegation_plan.invoke({"tasks": tasks_data})

                if "SUCCESS" in result:
                    plan_path = _dir / "delegation_plan.yaml"
                    with open(plan_path, "r") as f:
                        plan = yaml.safe_load(f)
                    return {"type": "plan", "plan": plan}
                else:
                    return {"type": "error", "message": result}

        return {
            "type": "error",
            "message": "Leader did not create a delegation plan",
        }

    except Exception as e:
        return {
            "type": "error",
            "message": f"Delegation planning error: {str(e)}",
        }
