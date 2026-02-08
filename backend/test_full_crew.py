"""Test the full crew.py with the actual agents.yaml/tasks.yaml configuration."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from crew import run_crew
import uuid

print("=== Testing Full Crew with Actual Configuration ===\n")

run_id = str(uuid.uuid4())
prompt = "Write a brief article about the benefits of meditation"

print(f"Run ID: {run_id}")
print(f"Prompt: {prompt}")
print("\nStarting crew execution...\n")

try:
    result = run_crew(run_id, prompt)
    print("\n" + "="*60)
    print("SUCCESS! Crew execution completed")
    print("="*60)
    print(f"\nResult:\n{result}")
except Exception as e:
    print("\n" + "="*60)
    print("ERROR during execution")
    print("="*60)
    print(f"Error type: {type(e).__name__}")
    print(f"Error message: {str(e)}")

    if "tool_call_id" in str(e) or "tool_use" in str(e):
        print("\n*** This is the async execution bug! ***")
    else:
        print("\nThis is a different error.")

print("\n=== Test Complete ===")
