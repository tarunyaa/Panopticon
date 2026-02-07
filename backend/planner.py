"""CrewAI-powered Leader agent that plans teams based on leader_rules.md."""

from __future__ import annotations

import os
import yaml
from pathlib import Path
from typing import Any
from dotenv import load_dotenv

from crewai import Agent, Crew, Process, Task, LLM
from crewai.tools import BaseTool
from pydantic import Field


_dir = Path(__file__).parent

# Load .env file from panopticon directory (has ANTHROPIC_API_KEY)
_env_path = _dir.parent / "panopticon" / ".env"
if _env_path.exists():
    load_dotenv(_env_path)


# ============================================================================
# Custom Tools for Leader Agent
# ============================================================================


class AskQuestionTool(BaseTool):
    """Tool for the Leader to ask the user a clarifying question."""

    name: str = "ask_question"
    description: str = (
        "Ask the user ONE short, focused question (single sentence, under 20 words). "
        "Keep it concise and specific. No compound questions or follow-ups. "
        "Use this to gather information before creating the team. "
        "Maximum 8 questions total - stop early if you have enough context. "
        "ONLY use this tool if you need more information. "
        "Once you use this tool, your turn ends and you must wait for the user's answer."
    )

    def _run(self, question: str) -> str:
        """Write question to marker file and return completion signal.

        The planner flow will detect this file and return the question
        to the frontend instead of continuing execution.
        """
        # Write marker file
        marker_path = _dir / ".question_asked"
        with open(marker_path, "w") as f:
            f.write(question)

        # Return a definitive completion message (no special markers that confuse CrewAI)
        return (
            f"SUCCESS: Question has been sent to the user and I am now waiting for their response. "
            f"The question was: '{question}'. "
            f"I will receive their answer in the next turn and can continue the planning process."
        )


class CreateTeamFilesTool(BaseTool):
    """Tool for the Leader to output the final agents.yaml and tasks.yaml files."""

    name: str = "create_team_files"
    description: str = (
        "Generate the final team configuration by outputting agents.yaml and tasks.yaml content. "
        "Input should be a YAML string containing both files separated by '---'. "
        "The first document should be agents.yaml, the second should be tasks.yaml."
    )

    agents_path: str = Field(default=str(_dir / "agents.yaml"))
    tasks_path: str = Field(default=str(_dir / "tasks.yaml"))

    def _run(self, yaml_content: str) -> str:
        """Parse and write the YAML files to disk.

        Args:
            yaml_content: A multi-document YAML string with agents.yaml and tasks.yaml

        Returns:
            Success message or error details
        """
        try:
            # Split into two documents
            docs = list(yaml.safe_load_all(yaml_content))

            if len(docs) != 2:
                return f"Error: Expected 2 YAML documents (agents.yaml, tasks.yaml), got {len(docs)}"

            agents_config = docs[0]
            tasks_config = docs[1]

            if not isinstance(agents_config, dict):
                return f"Error: agents.yaml must be a dictionary, got {type(agents_config)}"
            if not isinstance(tasks_config, dict):
                return f"Error: tasks.yaml must be a dictionary, got {type(tasks_config)}"

            # Validate structure
            if not agents_config:
                return "Error: agents.yaml is empty"
            if not tasks_config:
                return "Error: tasks.yaml is empty"

            # Check agent count (3-4 total)
            agent_count = len(agents_config)
            if agent_count < 3 or agent_count > 4:
                return f"Error: Must have 3-4 agents, got {agent_count}"

            # Validate that each task references a valid agent
            for task_key, task_data in tasks_config.items():
                agent_ref = task_data.get("agent")
                if not agent_ref or agent_ref not in agents_config:
                    return f"Error: Task '{task_key}' references unknown agent '{agent_ref}'"

                # Check for {prompt} placeholder
                description = task_data.get("description", "")
                if "{prompt}" not in description:
                    return f"Error: Task '{task_key}' description missing '{{prompt}}' placeholder"

            # Write files
            with open(self.agents_path, "w") as f:
                yaml.dump(agents_config, f, sort_keys=False, default_flow_style=False)

            with open(self.tasks_path, "w") as f:
                yaml.dump(tasks_config, f, sort_keys=False, default_flow_style=False)

            return (
                f"SUCCESS: Team configuration has been created and saved. "
                f"Generated {agent_count} agents with their respective tasks. "
                f"The team is now ready to be deployed."
            )

        except yaml.YAMLError as e:
            return f"Error parsing YAML: {e}"
        except Exception as e:
            return f"Error creating team files: {e}"


# ============================================================================
# Leader Agent Setup
# ============================================================================


def _load_leader_rules() -> str:
    """Load the leader_rules.md content to use as backstory."""
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

    Args:
        team_description: Description of the type of team needed (e.g., "software development team")
        history: List of {"role": "leader"|"user", "content": "..."} messages

    Returns:
        {"type": "question", "message": "..."}  - if Leader asks a question
        {"type": "team", "agents": [...]}        - if Leader creates the team
        {"type": "error", "message": "..."}      - if something goes wrong
    """
    try:
        # Load leader rules
        leader_backstory = _load_leader_rules()

        # Create tools
        ask_tool = AskQuestionTool()
        create_tool = CreateTeamFilesTool()

        # Create Leader agent
        leader = Agent(
            role="Team Architect",
            goal="Interview the user and design an optimal 3-4 agent team for a specific domain",
            backstory=leader_backstory,
            tools=[ask_tool, create_tool],
            llm=LLM(model="gpt-4o", api_key=os.environ.get("OPENAI_API_KEY")),
            verbose=True,
            allow_delegation=False,
        )

        # Build conversation context
        context = _build_conversation_context(team_description, history)

        # Create task for the leader
        # CRITICAL: Tell the agent to use ONLY ONE tool to enforce one-question-at-a-time behavior
        planning_task = Task(
            description=(
                f"{context}\n\n"
                "IMPORTANT: You must use ONLY ONE tool in this turn. "
                "Either use ask_question to ask a single question, "
                "OR use create_team_files when you're ready to generate the team. "
                "After using the tool, your task is COMPLETE - do not take any additional actions."
            ),
            expected_output=(
                "A success message from the tool you used (either 'Question has been sent' or 'Successfully created team')"
            ),
            agent=leader,
        )

        # Store file paths and clear any previous question marker
        agents_path = _dir / "agents.yaml"
        tasks_path = _dir / "tasks.yaml"
        question_marker = _dir / ".question_asked"

        # Remove old question marker if it exists
        if question_marker.exists():
            question_marker.unlink()

        agents_mtime_before = agents_path.stat().st_mtime if agents_path.exists() else 0
        tasks_mtime_before = tasks_path.stat().st_mtime if tasks_path.exists() else 0

        # Run the crew
        crew = Crew(
            agents=[leader],
            tasks=[planning_task],
            process=Process.sequential,
            verbose=True,
            planning=False,  # Disable planning to avoid OpenAI dependency
        )

        result = crew.kickoff()
        output = str(result).strip()

        # Check what happened during execution (priority order matters!)

        # 1. Check if a question was asked (highest priority - stop immediately)
        if question_marker.exists():
            with open(question_marker, "r") as f:
                question = f.read().strip()
            question_marker.unlink()  # Clean up
            return {"type": "question", "message": question}

        # 2. Check if YAML files were written (team was created)
        agents_mtime_after = agents_path.stat().st_mtime if agents_path.exists() else 0
        tasks_mtime_after = tasks_path.stat().st_mtime if tasks_path.exists() else 0

        files_were_written = (
            agents_mtime_after > agents_mtime_before or
            tasks_mtime_after > tasks_mtime_before
        )

        if files_were_written:
            # Leader created the team - reload the YAML files and return agents
            with open(agents_path, "r") as f:
                agents_config = yaml.safe_load(f)
            with open(tasks_path, "r") as f:
                tasks_config = yaml.safe_load(f)

            # Convert to frontend format (exclude Leader - frontend handles it)
            agents = []
            for agent_id, agent_data in agents_config.items():
                # Skip the Leader agent (frontend already has it)
                role = agent_data.get("role", "")
                if "leader" in role.lower():
                    continue

                # Find the task for this agent
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

        elif "__QUESTION__:" in output:
            # Leader asked a question (marker found in output)
            question = output.split("__QUESTION__:", 1)[1].strip()
            return {"type": "question", "message": question}

        else:
            # Extract the last question from verbose output or use fallback
            # CrewAI often doesn't preserve tool markers in final output
            # So we'll try to extract the actual question from the output
            lines = output.split('\n')
            for line in reversed(lines):
                line = line.strip()
                if line and '?' in line and len(line) < 500:
                    return {"type": "question", "message": line}

            # Final fallback
            return {
                "type": "question",
                "message": "Could you provide more details about your task?"
            }

    except Exception as e:
        return {
            "type": "error",
            "message": f"Planning error: {str(e)}"
        }
