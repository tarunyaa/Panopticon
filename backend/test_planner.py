"""Test script for the planner system."""

import sys
sys.path.insert(0, '.')

from planner import plan_team

# Test 1: Initial question
print("=" * 80)
print("TEST 1: Initial question (empty history)")
print("=" * 80)

result = plan_team(
    task="Create a comprehensive blog post about AI agents in software development",
    history=[]
)

print(f"\nResult type: {result.get('type')}")
print(f"Message: {result.get('message', 'N/A')}")
if result.get('type') == 'team':
    print(f"Agents: {len(result.get('agents', []))} agents")
print("\n")
