"""
Basic functionality test for agent delegation and task execution.

Tests:
1. Agent status changes (idle → working → complete)
2. Task handoffs between agents
3. Delegation plan execution
4. Output verification
"""

import os
import sys
import yaml
import uuid
from pathlib import Path
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Load environment
load_dotenv(Path(__file__).parent.parent / "panopticon" / ".env")

from planner import plan_task_delegation
from crewai import Agent, Crew, Process, Task, LLM
from tools import instantiate_tools
from events import event_bus

_dir = Path(__file__).parent


class TestMonitor:
    """Monitor events during execution to verify functionality."""

    def __init__(self, run_id):
        self.run_id = run_id
        self.events = []

    def capture_event(self, event):
        """Capture an event for later analysis."""
        event_type = type(event).__name__
        self.events.append({
            "type": event_type,
            "event": event,
            "timestamp": len(self.events)
        })

        # Print event in real-time
        if event_type == "RunStartedEvent":
            print(f"\n🚀 RUN STARTED")
            print(f"   Task: {event.prompt[:80]}...")

        elif event_type == "AgentIntentEvent":
            print(f"\n👤 AGENT: {event.agentName}")
            print(f"   Zone: {event.zone}")
            print(f"   Message: {event.message}")

        elif event_type == "TaskHandoffEvent":
            print(f"\n🔄 HANDOFF TO: {event.receivingAgent}")
            print(f"   From: {', '.join(event.sourceAgents)}")
            print(f"   Summary: {event.summary}")

        elif event_type == "TaskSummaryEvent":
            print(f"\n✅ TASK COMPLETE: {event.agentName}")
            print(f"   Summary: {event.summary[:100]}...")

        elif event_type == "GateRequestedEvent":
            print(f"\n⏸️  GATE REQUESTED: {event.agentName}")
            print(f"   Question: {event.question}")

        elif event_type == "RunFinishedEvent":
            print(f"\n🏁 RUN FINISHED")

        elif event_type == "ErrorEvent":
            print(f"\n❌ ERROR: {event.message}")

    def analyze(self):
        """Analyze captured events to verify functionality."""
        print("\n" + "=" * 70)
        print("TEST ANALYSIS")
        print("=" * 70)

        # Count events by type
        event_counts = {}
        for e in self.events:
            event_type = e["type"]
            event_counts[event_type] = event_counts.get(event_type, 0) + 1

        print("\n📊 Event Summary:")
        for event_type, count in sorted(event_counts.items()):
            print(f"   {event_type}: {count}")

        # Check agent intents
        print("\n👥 Agent Activity:")
        agent_events = [e for e in self.events if e["type"] == "AgentIntentEvent"]
        agents_seen = set()
        for e in agent_events:
            agent_name = e["event"].agentName
            agents_seen.add(agent_name)
            print(f"   ✓ {agent_name} started working")

        # Check handoffs
        print("\n🔄 Task Handoffs:")
        handoff_events = [e for e in self.events if e["type"] == "TaskHandoffEvent"]
        if handoff_events:
            for e in handoff_events:
                event = e["event"]
                print(f"   ✓ {event.receivingAgent} ← {', '.join(event.sourceAgents)}")
        else:
            print("   (No handoffs detected)")

        # Check task completions
        print("\n✅ Task Completions:")
        task_events = [e for e in self.events if e["type"] == "TaskSummaryEvent"]
        if task_events:
            for e in task_events:
                agent_name = e["event"].agentName
                print(f"   ✓ {agent_name} completed their task")
        else:
            print("   (No task completions detected)")

        # Verify basic functionality
        print("\n🧪 Functionality Checks:")

        checks = {
            "Run started": any(e["type"] == "RunStartedEvent" for e in self.events),
            "Agents activated": len(agents_seen) >= 2,
            "Task handoffs": len(handoff_events) > 0,
            "Tasks completed": len(task_events) >= 2,
            "Run finished": any(e["type"] == "RunFinishedEvent" for e in self.events),
        }

        all_passed = True
        for check_name, passed in checks.items():
            status = "✅" if passed else "❌"
            print(f"   {status} {check_name}")
            if not passed:
                all_passed = False

        return all_passed


def test_basic_functionality():
    """Test basic agent delegation and execution."""

    print("=" * 70)
    print("BASIC FUNCTIONALITY TEST")
    print("=" * 70)

    # Check team exists
    agents_path = _dir / "agents.yaml"
    tasks_path = _dir / "tasks.yaml"

    if not agents_path.exists() or not tasks_path.exists():
        print("\n❌ Team configuration not found!")
        print("Please create agents.yaml and tasks.yaml first.")
        return False

    # Load team
    with open(agents_path) as f:
        agents_config = yaml.safe_load(f)

    with open(tasks_path) as f:
        tasks_config = yaml.safe_load(f)

    print(f"\n✅ Loaded team with {len(agents_config)} agents")

    # Simple test task
    test_prompt = "Research renewable energy trends and write a brief summary. Include both technical and market perspectives."

    print(f"\n📝 Test Task:")
    print(f"   {test_prompt}")

    # Create delegation plan
    print("\n⏳ Step 1: Creating delegation plan...")
    delegation_result = plan_task_delegation(test_prompt)

    if delegation_result["type"] == "error":
        print(f"❌ Delegation planning failed: {delegation_result['message']}")
        return False

    plan = delegation_result["plan"]
    planned_tasks = plan.get("tasks", [])

    print(f"✅ Plan created with {len(planned_tasks)} tasks")

    # Show plan
    parallel_tasks = [t for t in planned_tasks if t.get("async_execution") and not t.get("dependencies")]
    sequential_tasks = [t for t in planned_tasks if not t.get("async_execution") or t.get("dependencies")]

    print(f"\n   Parallel tasks: {len(parallel_tasks)}")
    for task in parallel_tasks:
        print(f"      ⚡ {task['task_key']}")

    print(f"   Sequential tasks: {len(sequential_tasks)}")
    for task in sequential_tasks:
        deps = task.get("dependencies", [])
        print(f"      ⏸  {task['task_key']}" + (f" (waits for: {', '.join(deps)})" if deps else ""))

    # Set up event monitoring
    run_id = str(uuid.uuid4())
    monitor = TestMonitor(run_id)

    # Subscribe to events
    def event_handler(event):
        monitor.capture_event(event)

    event_bus.subscribe(run_id, event_handler)

    # Build crew
    print("\n⏳ Step 2: Building and executing crew...")
    print("-" * 70)

    try:
        # Find leader
        leader_key = None
        for key, config in agents_config.items():
            if "leader" in config.get("role", "").lower():
                leader_key = key
                break

        if not leader_key:
            print("❌ No Leader agent found")
            return False

        # Create agents
        agents = {}
        worker_agents = []
        leader_agent = None

        for key, config in agents_config.items():
            is_leader = (key == leader_key)
            agent_tools = instantiate_tools(config.get("tools", []))

            agent = Agent(
                role=config["role"].strip(),
                goal=config["goal"].strip(),
                backstory=config["backstory"].strip(),
                verbose=True,
                llm=LLM(model="claude-sonnet-4-5-20250929", api_key=os.environ.get("ANTHROPIC_API_KEY")),
                tools=agent_tools,
                allow_delegation=is_leader,
            )

            agents[key] = agent

            if is_leader:
                leader_agent = agent
            else:
                worker_agents.append(agent)

        # Build tasks from delegation plan
        tasks = []
        task_map = {}

        for plan_entry in planned_tasks:
            task_key = plan_entry["task_key"]
            async_execution = plan_entry.get("async_execution", False)
            dependencies = plan_entry.get("dependencies", [])

            if task_key not in tasks_config:
                print(f"⚠️  Skipping {task_key} (not in tasks.yaml)")
                continue

            config = tasks_config[task_key]
            agent_key = config["agent"]

            if agent_key == leader_key:
                continue

            desc = config["description"].strip()
            if "{prompt}" not in desc:
                desc += "\n\nUser's request: {prompt}"

            # Build context from dependencies
            context_tasks = [task_map[dep_key] for dep_key in dependencies if dep_key in task_map]

            task = Task(
                description=desc.format(prompt=test_prompt),
                expected_output=config["expected_output"].strip(),
                agent=agents[agent_key],
                async_execution=async_execution,
                context=context_tasks if context_tasks else None,
            )

            tasks.append(task)
            task_map[task_key] = task

        # Create and run crew
        crew = Crew(
            agents=worker_agents,
            tasks=tasks,
            process=Process.hierarchical,
            manager_agent=leader_agent,
            planning=False,
            verbose=True,
        )

        # Emit start event
        from events import RunStartedEvent
        event_bus.emit(run_id, RunStartedEvent(runId=run_id, prompt=test_prompt))

        # Execute
        result = crew.kickoff()

        # Emit finish event
        from events import RunFinishedEvent
        event_bus.emit(run_id, RunFinishedEvent(runId=run_id))

        print("\n" + "-" * 70)
        print("✅ Execution complete!")

        # Show result preview
        print("\n📄 Final Output Preview:")
        result_str = str(result)
        print(f"   {result_str[:300]}...")

        # Analyze events
        all_passed = monitor.analyze()

        # Cleanup
        event_bus.unsubscribe(run_id)

        return all_passed

    except Exception as e:
        print(f"\n❌ Execution failed: {e}")
        import traceback
        traceback.print_exc()

        # Still analyze what we captured
        monitor.analyze()

        event_bus.unsubscribe(run_id)
        return False


if __name__ == "__main__":
    try:
        print("\nStarting basic functionality test...")
        print("This will execute a real task with your team to verify:")
        print("  • Delegation planning")
        print("  • Agent activation")
        print("  • Task handoffs")
        print("  • Task completion")
        print("  • Output generation")
        print("")

        success = test_basic_functionality()

        print("\n" + "=" * 70)
        if success:
            print("✅ ALL TESTS PASSED!")
            print("Basic functionality is working correctly.")
        else:
            print("⚠️  SOME TESTS FAILED")
            print("Review the output above to identify issues.")
        print("=" * 70)

        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
