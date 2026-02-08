"""Test script to isolate the hierarchical delegation + tools error."""

import os
from dotenv import load_dotenv
from crewai import Agent, Crew, Process, Task, LLM
from tools import instantiate_tools

# Load environment
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "panopticon", ".env"))

print("=== Testing: Hierarchical + Tools + Async Execution (WITH FIX) ===\n")

try:
    manager = Agent(
        role="Manager",
        goal="Coordinate the team",
        backstory="A manager who delegates tasks",
        tools=[],
        llm=LLM(model="claude-3-5-sonnet-20240620", api_key=os.environ.get("ANTHROPIC_API_KEY")),
        allow_delegation=True,
        verbose=True,
    )

    worker1 = Agent(
        role="Researcher",
        goal="Research topics",
        backstory="A researcher who uses web search",
        tools=instantiate_tools(["web_search"]),
        llm=LLM(model="claude-3-5-sonnet-20240620", api_key=os.environ.get("ANTHROPIC_API_KEY")),
        verbose=True,
    )

    worker2 = Agent(
        role="Writer",
        goal="Write summaries",
        backstory="A writer who creates content",
        tools=[],
        llm=LLM(model="claude-3-5-sonnet-20240620", api_key=os.environ.get("ANTHROPIC_API_KEY")),
        verbose=True,
    )

    # Task 1: Sequential task with tools
    task1 = Task(
        description="Search for CrewAI framework information",
        expected_output="Brief summary",
        agent=worker1,
        async_execution=False,  # Only last task can be async in hierarchical mode
    )

    # Task 2: Last task can be async, uses context from task1
    task2 = Task(
        description="Write a paragraph based on the research",
        expected_output="One paragraph",
        agent=worker2,
        async_execution=True,  # Last task can be async
        context=[task1],
    )

    crew = Crew(
        agents=[worker1, worker2],
        tasks=[task1, task2],
        process=Process.hierarchical,
        manager_agent=manager,
        verbose=True,
    )

    result = crew.kickoff()
    print(f"\nSUCCESS: {result}")
except Exception as e:
    print(f"\n*** ERROR CAUGHT ***")
    print(f"Type: {type(e).__name__}")
    print(f"Message: {str(e)}")

    # Check if this is the tool_call_id error
    if "tool_call_id" in str(e):
        print("\nBINGO! This is the bug:")
        print("Hierarchical + Async Tasks + Tools = tool_call_id error")

print("\n=== Test Complete ===")
