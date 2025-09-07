# main.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from ChatxLastFMreccomends import get_recommendations_from_swipes
from ChatxLastFMreccomends import get_spotify_starting_songs
from typing import Optional, List

app = FastAPI()

class RecommendRequest(BaseModel):
    spotify_token: str
    username: Optional[str] = None
    weather_api_key: Optional[str] = None
    lastfm_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None

class DiscoverRequest(BaseModel):
    accessToken: str

@app.post("/recommend")
def recommend_songs(req: RecommendRequest):
    try:
        songs = get_recommendations_from_swipes(
            spotify_token=req.spotify_token,
            username=req.username,
            node_base_url="http://localhost:5000",  # your Node server
            limit=5,
        )
        return {"recommendations": songs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-starting-songs")
def get_starting_songs(req: DiscoverRequest):
    try:
        songs = get_spotify_starting_songs(req.accessToken)
        print("Starting songs:", songs)
        return JSONResponse(content=songs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
