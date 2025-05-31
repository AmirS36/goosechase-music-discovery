# FastAPI app

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from ChatxLastFMreccomends import build_user_profile, parse_text_recommendations, system_prompt  # refactor these in logic.py
from openai import OpenAI

app = FastAPI()

class RecommendRequest(BaseModel):
    spotify_token: str
    weather_api_key: str
    lastfm_api_key: str
    openai_api_key: str

# @app.post("/recommend")
# def recommend_songs(req: RecommendRequest):
#     try:
#         # Build user profile
#         user_profile = build_user_profile(req.spotify_token, req.weather_api_key)
#         user_profile["user_profile"]["user_story"] = []
#         user_profile["user_profile"]["liked_songs_details"] = []

#         # Init OpenAI client
#         openai_client = OpenAI(api_key=req.openai_api_key)

#         # Generate recommendations
#         # move it to logic.py
#         response = openai_client.chat.completions.create(
#             model="gpt-4",
#             messages=[
#                 {"role": "system", "content": system_prompt},
#                 {"role": "user", "content": str(user_profile)}
#             ],
#             temperature=0.8
#         )

#         chat_output = response.choices[0].message.content.strip()
#         recommendations = parse_text_recommendations(chat_output)

#         return {"recommendations": recommendations}

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

@app.post("/recommend")
def recommend_songs(req: RecommendRequest):
    dummy_recommendations = [
        {
            "title": "Fake Song One",
            "artist": "Test Artist",
            "snippet_lyrics": "This is a snippet...",
            "suggested_lyrics": "Just a fake lyric line here.",
            "suggested_lyrics_start_time": "00:10",
            "suggested_lyrics_end_time": "00:30",
            "reason": "You might like this song because it's mellow and introspective."
        },
        {
            "title": "Fake Song Two",
            "artist": "Test Artist 2",
            "snippet_lyrics": "Another line from a fake song...",
            "suggested_lyrics": "Even more fake content.",
            "suggested_lyrics_start_time": "00:40",
            "suggested_lyrics_end_time": "01:00",
            "reason": "This one fits your vibe from previous likes."
        }
    ]
    return {"recommendations": dummy_recommendations}