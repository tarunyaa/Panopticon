"""Quick test to find the correct Claude model ID."""

import os
from dotenv import load_dotenv
from anthropic import Anthropic

load_dotenv("../panopticon/.env")

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# Try different model names
model_names = [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-20240620",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
    "claude-2.1",
    "claude-2.0",
]

for model in model_names:
    try:
        response = client.messages.create(
            model=model,
            max_tokens=10,
            messages=[{"role": "user", "content": "Hi"}]
        )
        print(f"SUCCESS: Model '{model}' works!")
        print(f"  Response: {response.content[0].text}")
        break
    except Exception as e:
        print(f"FAILED: Model '{model}' - {str(e)[:100]}")
