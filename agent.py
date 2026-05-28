import os
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# 1. Define exactly what you want the AI to return
class MeetingAgentOutput(BaseModel):
    key_insights: list[str] = Field(description="3-5 bullet points of the most important takeaways.")
    action_items: list[str] = Field(description="Who needs to do what, based on the notes.")
    draft_email: str = Field(description="A polished, professional email summarizing the meeting, ready to send.")
    meeting_mood: str = Field(description="A one sentence summary of the overall tone or mood of the meeting.")

# 2. Initialize the client (automatically uses GEMINI_API_KEY from environment)
# 2. Initialize the client (automatically uses GEMINI_API_KEY from environment)
try:
    client = genai.Client(http_options={'client_args': {'verify': False}})
except Exception as e:
    print(f"Error initializing client: {e}")
    print("Did you forget to set the GEMINI_API_KEY environment variable?")
    exit(1)

# 3. Read raw notes from the sample file
try:
    with open("sample_notes.txt", "r") as f:
        raw_notes = f.read()
except FileNotFoundError:
    print("sample_notes.txt not found. Using default messy notes.")
    raw_notes = "Sarah mentioned the Q3 marketing budget is delayed. John needs to send the revised estimates by Thursday."

prompt = f"Analyze these raw meeting notes. Extract the key insights, action items, and write a follow-up email to the team.\n\nNotes:\n{raw_notes}"

# 4. Call the Gemini API and enforce our schema
print("Agent is thinking...\n")
try:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=MeetingAgentOutput,
        )
    )
    
    # 5. The result is perfectly formatted JSON
    print(response.text)
except Exception as e:
    print(f"API Error: {e}")