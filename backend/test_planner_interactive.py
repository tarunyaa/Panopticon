"""Test the interactive question/answer flow."""

import sys
sys.path.insert(0, '.')

from planner import plan_team

# Simulate the full conversation flow
task = "Build a REST API for a todo list app"
history = []

print("=" * 80)
print("Testing Interactive Flow")
print("=" * 80)
print(f"\nUser task: {task}\n")

# Turn 1: Leader should ask first question
print("\n--- TURN 1: Initial question ---")
result = plan_team(task, history)
print(f"Type: {result['type']}")

if result['type'] == 'question':
    question = result['message']
    print(f"Leader: {question[:200]}...")

    # Simulate user answer
    answer = "Python with FastAPI. We want full CRUD operations."
    history.append({"role": "leader", "content": question})
    history.append({"role": "user", "content": answer})
    print(f"User: {answer}\n")

    # Turn 2: Leader should ask another question
    print("\n--- TURN 2: Follow-up question ---")
    result = plan_team(task, history)
    print(f"Type: {result['type']}")

    if result['type'] == 'question':
        question = result['message']
        print(f"Leader: {question[:200]}...")

        # Simulate user answer
        answer = "Yes, add JWT authentication and PostgreSQL database"
        history.append({"role": "leader", "content": question})
        history.append({"role": "user", "content": answer})
        print(f"User: {answer}\n")

        # Turn 3: Leader might create team or ask more
        print("\n--- TURN 3: Create team or more questions ---")
        result = plan_team(task, history)
        print(f"Type: {result['type']}")

        if result['type'] == 'team':
            print(f"Team created! {len(result['agents'])} agents")
            for i, agent in enumerate(result['agents'], 1):
                print(f"  {i}. {agent['role']}")
        elif result['type'] == 'question':
            print(f"Leader: {result['message'][:200]}...")
    elif result['type'] == 'team':
        print(f"Team created! {len(result['agents'])} agents")

elif result['type'] == 'team':
    print(f"Leader created team immediately. {len(result['agents'])} agents:")
    for i, agent in enumerate(result['agents'], 1):
        print(f"  {i}. {agent['role']}")

print("\n" + "=" * 80)
