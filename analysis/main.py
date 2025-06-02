# main.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from fastapi.responses import JSONResponse
from ChatxLastFMreccomends import get_spotify_starting_songs
from openai import OpenAI

app = FastAPI()

# -----------------------------
# Request Models
# -----------------------------
class RecommendRequest(BaseModel):
    spotify_token: str
    weather_api_key: str
    lastfm_api_key: str
    openai_api_key: str

class DiscoverRequest(BaseModel):
    accessToken: str

# -----------------------------
# Endpoints
# -----------------------------
@app.post("/recommend")
def recommend_songs(req: RecommendRequest):
    # TODO: Replace dummy with real logic when ready
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


@app.post("/get-starting-songs")
def get_starting_songs(req: DiscoverRequest):
    try:
        songs = get_spotify_starting_songs(req.accessToken)
        print("Starting songs:", songs)
        return JSONResponse(content=songs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
