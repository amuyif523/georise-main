import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / ".env"
print(f"Checking .env at: {env_path}")
print(f"Exists: {env_path.exists()}")

if env_path.exists():
    print(f"Content preview: {env_path.read_text()[:20]}...")

load_dotenv(env_path)
secret = os.getenv("INTERNAL_SERVICE_SECRET")
print(f"Secret loaded: {secret is not None}")
print(f"Secret length: {len(secret) if secret else 0}")
