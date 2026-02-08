"""Quick test to verify all components load correctly."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("Testing imports...")

try:
    from backend.llm_wrapper import AnthropicMessageFixer
    print("OK llm_wrapper.py loads")
except Exception as e:
    print(f"ERROR llm_wrapper.py failed: {e}")

try:
    from backend.crew import run_crew
    print("OK crew.py loads")
except Exception as e:
    print(f"ERROR crew.py failed: {e}")

try:
    from backend.planner import plan_team
    print("OK planner.py loads")
except Exception as e:
    print(f"ERROR planner.py failed: {e}")

try:
    from backend.main import app
    print("OK main.py loads")
except Exception as e:
    print(f"ERROR main.py failed: {e}")

print("\nOK All imports successful!")
print("\nYou can now start the server with:")
print("  uvicorn backend.main:app --reload")
