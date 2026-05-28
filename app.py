import os
import json
import time
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import Optional

# ─── Absolute path to static folder (works locally AND on Vercel) ───────────
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"

# ─── Load .env file (local dev only — Vercel uses dashboard env vars) ───────
if not os.environ.get("VERCEL"):  # Vercel sets this automatically
    env_path = BASE_DIR / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")

# ─── Richer Schema ──────────────────────────────────────────────────────────
class ActionItem(BaseModel):
    task: str = Field(description="The specific task to be completed.")
    owner: str = Field(description="The person responsible for this task.")
    priority: str = Field(description="Priority level: 'High', 'Medium', or 'Low'.")
    due_date: Optional[str] = Field(default=None, description="Due date or deadline if mentioned, e.g. 'Thursday EOD' or null if not specified.")

class MeetingAgentOutput(BaseModel):
    key_insights: list[str] = Field(description="3-5 bullet points of the most important takeaways from the meeting.")
    action_items: list[ActionItem] = Field(description="Structured action items with owner, priority, and optional due date.")
    key_topics: list[str] = Field(description="3-6 short topic tags that summarise the main subjects discussed (e.g. 'Q3 Budget', 'Server Migration').")
    email_subject: str = Field(description="A concise, professional email subject line, e.g. 'Meeting Recap – Oct 24: Q3 Budget & Action Items'.")
    email_recipients: str = Field(description="Suggested recipients, e.g. 'Team' or specific names from the notes.")
    draft_email: str = Field(description=(
        "A complete, professional, ready-to-send email. "
        "Must include: greeting, brief intro paragraph, 'Key Decisions' section, "
        "'Action Items' section with owners and deadlines, closing paragraph, and signature line. "
        "Write as if it is about to be sent immediately — no placeholders."
    ))
    meeting_mood: str = Field(description="One sentence capturing the overall tone or mood of the meeting.")
    productivity_score: int = Field(description="A productivity score from 1 to 10 rating how actionable and effective this meeting was.")
    productivity_reason: str = Field(description="One sentence explaining the productivity score.")
    follow_up_suggestion: str = Field(description="A concrete recommendation for next steps or a follow-up meeting, e.g. 'Schedule a 15-min check-in by Friday to review estimates.'")

# ─── Model fallback chain ───────────────────────────────────────────────────
MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]

_client = None

def get_client():
    global _client
    if _client is not None:
        return _client
    if not os.environ.get("GEMINI_API_KEY"):
        return None
    # Skip SSL verify bypass on Vercel (proper certs) — only needed locally
    is_local = not os.environ.get("VERCEL")
    http_opts = {"client_args": {"verify": False}} if is_local else {}
    _client = genai.Client(http_options=http_opts)
    return _client

def call_gemini_with_retry(prompt: str, max_retries: int = 3) -> dict:
    client = get_client()
    if client is None:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. "
            "Create a .env file with: GEMINI_API_KEY=your_key_here"
        )

    last_error = None
    for model in MODELS:
        for attempt in range(1, max_retries + 1):
            try:
                print(f"  Trying model={model} attempt={attempt}...")
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=MeetingAgentOutput,
                    ),
                )
                result = json.loads(response.text)
                print(f"  Success with model={model}")
                return result
            except Exception as e:
                last_error = e
                err_str = str(e)
                is_overloaded = any(x in err_str for x in ["503", "UNAVAILABLE", "overloaded", "high demand"])
                if is_overloaded:
                    wait = 2 ** attempt
                    print(f"  Overloaded (attempt {attempt}). Waiting {wait}s...")
                    if attempt < max_retries:
                        time.sleep(wait)
                    else:
                        break
                else:
                    raise

    raise RuntimeError(
        f"All models are currently overloaded. Please try again in a moment. "
        f"Last error: {last_error}"
    )

# ─── Routes ────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(str(STATIC_DIR), "index.html")

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(force=True)
    notes = (data or {}).get("notes", "").strip()

    if not notes:
        return jsonify({"error": "No meeting notes provided."}), 400

    if get_client() is None:
        return jsonify({
            "error": "GEMINI_API_KEY is not set. Add it to .env or set as environment variable."
        }), 500

    prompt = (
        "You are an expert meeting analyst and executive assistant. "
        "Analyze the following raw meeting notes thoroughly. "
        "Extract structured insights, assign clear action items with owners and priorities, "
        "identify the key topics discussed, and compose a complete, polished, ready-to-send "
        "follow-up email that requires NO editing before sending. "
        "The email must have proper greeting, structured sections, and a professional sign-off.\n\n"
        "Notes:\n" + notes
    )

    try:
        result = call_gemini_with_retry(prompt)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("-" * 55)
    print("  MeetingMind server starting...")
    if os.environ.get("GEMINI_API_KEY"):
        print("  [OK] GEMINI_API_KEY found")
    else:
        print("  [!]  GEMINI_API_KEY not set - add it to .env or env vars")
    print("  Open: http://localhost:5000")
    print("-" * 55)
    app.run(debug=True, port=5000)
