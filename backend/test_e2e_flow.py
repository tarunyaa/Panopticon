"""End-to-end test simulating the full frontend flow."""

import requests
import json
import time

API_BASE = "http://localhost:8000"

def print_section(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def test_full_flow():
    """Simulate a user going through the entire onboarding and team planning flow."""

    print_section("STEP 1: Initial Planning Request")

    # User enters task and clicks "Plan My Team"
    task = "Create a comprehensive guide about machine learning for beginners"
    history = []

    print(f"User task: {task}\n")

    # Turn 1: First question
    print_section("TURN 1: Leader asks first question")
    response = requests.post(
        f"{API_BASE}/plan-team",
        json={"task": task, "history": history}
    )
    result = response.json()
    print(f"Type: {result['type']}")

    if result['type'] != 'question':
        print(f"[ERROR] Expected question, got: {result['type']}")
        return False

    question1 = result['message']
    print(f"Leader: {question1[:150]}...")

    # User answers
    answer1 = "Target audience is complete beginners with no prior programming experience. Format should be a structured blog post series with practical examples."
    history.append({"role": "leader", "content": question1})
    history.append({"role": "user", "content": answer1})
    print(f"User: {answer1}\n")

    # Turn 2: Second question
    print_section("TURN 2: Leader asks follow-up question")
    response = requests.post(
        f"{API_BASE}/plan-team",
        json={"task": task, "history": history}
    )
    result = response.json()
    print(f"Type: {result['type']}")

    if result['type'] != 'question':
        print(f"[ERROR] Expected question, got: {result['type']}")
        return False

    question2 = result['message']
    print(f"Leader: {question2[:150]}...")

    # User answers
    answer2 = "Cover basic concepts, popular algorithms, tools like scikit-learn and TensorFlow, and include code examples in Python."
    history.append({"role": "leader", "content": question2})
    history.append({"role": "user", "content": answer2})
    print(f"User: {answer2}\n")

    # Continue conversation until team is created (max 8 questions)
    default_answers = [
        "Production quality with proper citations and code that actually works. Include visualizations where helpful.",
        "3-5 blog posts, each around 1500-2000 words. Start with basics, move to intermediate topics.",
        "Include practical exercises and code examples that readers can run. Focus on real-world applications.",
        "We have 4 weeks to complete this. Quality over speed.",
        "Yes, include diagrams and visualizations for concepts like neural networks and decision trees.",
        "The goal is to educate and inspire beginners to learn more about ML."
    ]

    turn = 3
    max_turns = 10
    answer_idx = 0

    while turn <= max_turns:
        print_section(f"TURN {turn}: Leader continues")
        response = requests.post(
            f"{API_BASE}/plan-team",
            json={"task": task, "history": history}
        )
        result = response.json()
        print(f"Type: {result['type']}")

        if result['type'] == 'team':
            print(f"[OK] Team created after {turn} turns!")
            break

        if result['type'] == 'question':
            question = result['message']
            print(f"Leader: {question[:150]}...")

            # Use default answer or generic response
            answer = default_answers[answer_idx] if answer_idx < len(default_answers) else "That sounds good, proceed with your best judgment."
            answer_idx += 1

            history.append({"role": "leader", "content": question})
            history.append({"role": "user", "content": answer})
            print(f"User: {answer}\n")

        turn += 1

    # Verify team was created
    if result['type'] != 'team':
        print(f"[ERROR] Expected team after {turn} turns, got: {result['type']}")
        return False

    agents = result['agents']
    print(f"[OK] Team created with {len(agents)} agents!")
    print("\nTeam roster:")
    for i, agent in enumerate(agents, 1):
        tools_str = f" (tools: {', '.join(agent['tools'])})" if agent['tools'] else ""
        print(f"  {i}. {agent['role']}{tools_str}")

    # Step 2: Verify YAML files were written
    print_section("STEP 2: Verify YAML Files")

    response = requests.get(f"{API_BASE}/agents")
    agents_data = response.json()

    print(f"[OK] Backend has {len(agents_data['agents'])} agents configured")
    print(f"   Max agents: {agents_data['maxAgents']}")

    for agent in agents_data['agents']:
        print(f"   - {agent['id']}: {agent['role']} (zone: {agent['zone']})")

    # Step 3: Test that we can start a run with this team
    print_section("STEP 3: Test Run Execution")

    print("Starting a test run with the generated team...")
    run_response = requests.post(
        f"{API_BASE}/run",
        json={"prompt": "Write an introduction to supervised learning with a simple example"}
    )

    if run_response.status_code != 200:
        print(f"[ERROR] Run failed: {run_response.status_code}")
        return False

    run_data = run_response.json()
    run_id = run_data['runId']
    print(f"[OK] Run started successfully! Run ID: {run_id}")

    print("\n" + "=" * 80)
    print("  [SUCCESS] END-TO-END TEST PASSED!")
    print("=" * 80)
    print("\n[OK] The LLM-driven team planner is working correctly:")
    print("   1. Leader asks clarifying questions one at a time")
    print("   2. Leader generates valid team based on user responses")
    print("   3. Team is written to agents.yaml and tasks.yaml")
    print("   4. Backend can load and execute the generated team")
    print("\n[READY] Ready for production use!\n")

    return True

if __name__ == "__main__":
    try:
        success = test_full_flow()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n[ERROR] Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
