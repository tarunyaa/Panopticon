"""
Test to verify events are emitted at the RIGHT TIME.

Checks:
1. AgentIntentEvent fires when agent STARTS (not finishes)
2. TaskSummaryEvent fires when agent FINISHES
3. Zone updates happen immediately
"""

import os
import sys
import yaml
import uuid
import time
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent.parent / "panopticon" / ".env")

from crewai import Agent, Crew, Process, Task, LLM
from tools import instantiate_tools
from events import event_bus

_dir = Path(__file__).parent


def test_event_timing():
    """Test that events fire at the correct times."""

    print("=" * 70)
    print("EVENT TIMING TEST")
    print("=" * 70)

    # Load team
    with open(_dir / "agents.yaml") as f:
        agents_config = yaml.safe_load(f)

    # Find leader
    leader_key = None
    for key, config in agents_config.items():
        if "leader" in config.get("role", "").lower():
            leader_key = key
            break

    # Set up event monitoring
    run_id = str(uuid.uuid4())
    events_log = []

    def timestamp():
        return datetime.now().strftime("%H:%M:%S.%f")[:-3]

    def log_event(event):
        event_type = type(event).__name__
        ts = timestamp()

        if event_type == "AgentIntentEvent":
            events_log.append({
                "time": ts,
                "type": "AGENT_START",
                "agent": event.agentName,
                "zone": event.zone,
                "message": event.message
            })
            print(f"[{ts}] 🟢 {event.agentName} STARTED → {event.zone}")

        elif event_type == "TaskSummaryEvent":
            events_log.append({
                "time": ts,
                "type": "AGENT_FINISH",
                "agent": event.agentName
            })
            print(f"[{ts}] ✅ {event.agentName} FINISHED")

        elif event_type == "TaskHandoffEvent":
            events_log.append({
                "time": ts,
                "type": "HANDOFF",
                "agent": event.receivingAgent,
                "from": event.sourceAgents
            })
            print(f"[{ts}] 🔄 {event.receivingAgent} ← {', '.join(event.sourceAgents)}")

    event_bus.subscribe(run_id, log_event)

    # Create agents WITHOUT tools (for speed)
    print("\n[1/2] Creating minimal crew...")
    agents = {}
    worker_agents = []
    leader_agent = None

    for key, config in agents_config.items():
        is_leader = (key == leader_key)

        agent = Agent(
            role=config["role"],
            goal=config["goal"],
            backstory=config["backstory"] + "\n\nIMPORTANT: Be VERY brief. Answer in 1-2 sentences max.",
            verbose=False,
            llm=LLM(
                model="claude-sonnet-4-5-20250929",
                api_key=os.environ.get("ANTHROPIC_API_KEY")
            ),
            tools=[],  # No tools for speed
            allow_delegation=is_leader,
        )

        agents[key] = agent

        if is_leader:
            leader_agent = agent
        else:
            worker_agents.append(agent)

    # Create simple tasks
    test_prompt = "Name 2 fruits"

    tasks = [
        Task(
            description=f"List 2 fruits. STOP after 2. Be brief.\n\nUser: {test_prompt}",
            expected_output="2 fruits",
            agent=agents["abigail"],
            async_execution=False,
        ),
        Task(
            description=f"Pick 1 fruit and say why it's good. 1 sentence only.\n\nUser: {test_prompt}",
            expected_output="1 sentence",
            agent=agents["klaus"],
            async_execution=False,
        ),
    ]

    # Execute
    print(f"\n[2/2] Executing with event monitoring...")
    print("-" * 70)

    start_time = time.time()

    crew = Crew(
        agents=worker_agents,
        tasks=tasks,
        process=Process.hierarchical,
        manager_agent=leader_agent,
        planning=False,
        verbose=True,
    )

    # Import here to avoid circular dependency
    from events import RunStartedEvent, RunFinishedEvent

    event_bus.emit(run_id, RunStartedEvent(runId=run_id, prompt=test_prompt))

    try:
        result = crew.kickoff()
        event_bus.emit(run_id, RunFinishedEvent(runId=run_id))
    except Exception as e:
        print(f"\n❌ Execution failed: {e}")

    elapsed = time.time() - start_time

    print("-" * 70)

    # Analysis
    print("\n" + "=" * 70)
    print("EVENT TIMELINE ANALYSIS")
    print("=" * 70)

    agent_starts = [e for e in events_log if e["type"] == "AGENT_START"]
    agent_finishes = [e for e in events_log if e["type"] == "AGENT_FINISH"]
    handoffs = [e for e in events_log if e["type"] == "HANDOFF"]

    print(f"\n📊 Event Counts:")
    print(f"   Agent starts:  {len(agent_starts)}")
    print(f"   Agent finishes: {len(agent_finishes)}")
    print(f"   Handoffs:      {len(handoffs)}")

    print(f"\n⏱️  Total time: {elapsed:.1f}s")

    # Verify correct timing
    print("\n" + "=" * 70)
    print("VERIFICATION")
    print("=" * 70)

    checks = []

    # Check 1: Did agents emit START events?
    if len(agent_starts) >= 2:
        print("✅ Agents emitted START events")
        checks.append(True)
    else:
        print(f"❌ Expected 2+ start events, got {len(agent_starts)}")
        checks.append(False)

    # Check 2: Did START events include zone?
    starts_with_zone = [e for e in agent_starts if e["zone"] == "WORKSHOP"]
    if len(starts_with_zone) == len(agent_starts):
        print("✅ All START events included WORKSHOP zone")
        checks.append(True)
    else:
        print(f"❌ Not all START events had WORKSHOP zone")
        checks.append(False)

    # Check 3: Did agents emit FINISH events?
    if len(agent_finishes) >= 2:
        print("✅ Agents emitted FINISH events")
        checks.append(True)
    else:
        print(f"❌ Expected 2+ finish events, got {len(agent_finishes)}")
        checks.append(False)

    # Check 4: Event order (START before FINISH)
    for agent_name in set([e["agent"] for e in agent_starts]):
        start_events = [e for e in agent_starts if e["agent"] == agent_name]
        finish_events = [e for e in agent_finishes if e["agent"] == agent_name]

        if start_events and finish_events:
            start_time_str = start_events[0]["time"]
            finish_time_str = finish_events[0]["time"]

            if start_time_str < finish_time_str:
                print(f"✅ {agent_name}: START before FINISH")
                checks.append(True)
            else:
                print(f"❌ {agent_name}: FINISH before START (wrong order!)")
                checks.append(False)

    print("\n" + "=" * 70)
    print("CONCLUSION")
    print("=" * 70)

    if all(checks):
        print("✅ ALL CHECKS PASSED!")
        print("\nEvents are emitted at the correct times:")
        print("  • AgentIntentEvent fires when agent STARTS")
        print("  • Zone is set to WORKSHOP immediately")
        print("  • TaskSummaryEvent fires when agent FINISHES")
        print("\nFrontend should now see:")
        print("  • Agents move to zones immediately")
        print("  • Emojis update when agents start working")
    else:
        print("⚠️  SOME CHECKS FAILED")
        print("\nEvent timing may not be correct.")

    event_bus.unsubscribe(run_id)

    return all(checks)


if __name__ == "__main__":
    try:
        success = test_event_timing()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
