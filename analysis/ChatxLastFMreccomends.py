from openai import OpenAI
import json
import requests
import time
import base64

def parse_text_recommendations(text_block):
    """
    Convert a plain text block from ChatGPT into structured JSON.
    """
    recommendations = []
    blocks = text_block.strip().split('---')
    for block in blocks:
        block = block.strip()
        if not block:
            continue

        rec = {}
        for line in block.split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                rec[key.strip().lower().replace(' ', '_')] = value.strip()
        recommendations.append(rec)

    return recommendations


# =============================================================================
# LAST.FM API FUNCTIONS
# =============================================================================

def get_lastfm_track_info(artist, track, api_key):
    """
    Get comprehensive track info from Last.fm
    """
    url = "https://ws.audioscrobbler.com/2.0/"
    params = {
        "method": "track.getInfo",
        "api_key": api_key,
        "artist": artist,
        "track": track,
        "format": "json",
        "autocorrect": 1
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "track" in data:
                return data["track"]
        return None
    except Exception as e:
        print(f"Last.fm API error for {track}: {e}")
        return None


def get_lastfm_artist_info(artist, api_key):
    """
    Get artist info from Last.fm for additional context
    """
    url = "https://ws.audioscrobbler.com/2.0/"
    params = {
        "method": "artist.getInfo",
        "api_key": api_key,
        "artist": artist,
        "format": "json",
        "autocorrect": 1
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "artist" in data:
                return data["artist"]
        return None
    except Exception as e:
        print(f"Last.fm artist API error for {artist}: {e}")
        return None


def extract_lastfm_features(track_info, artist_info=None):
    """
    Extract useful features from Last.fm data
    """
    features = {}

    if not track_info:
        return features

    # Basic metadata
    features["duration_ms"] = int(track_info.get("duration", 0))
    features["playcount"] = int(track_info.get("playcount", 0))
    features["listeners"] = int(track_info.get("listeners", 0))

    # Extract genre tags
    tags = track_info.get("toptags", {}).get("tag", [])
    if isinstance(tags, dict):  # Sometimes it's a single tag
        tags = [tags]

    genre_tags = [tag["name"].lower() for tag in tags if isinstance(tag, dict)]
    features["genres"] = genre_tags[:5]  # Top 5 genres

    # Popularity score (normalized)
    if features["playcount"] > 0:
        import math
        features["popularity"] = min(math.log10(features["playcount"] + 1) / 8, 1.0)
    else:
        features["popularity"] = 0.0

    # Artist info if available
    if artist_info:
        artist_tags = artist_info.get("tags", {}).get("tag", [])
        if isinstance(artist_tags, dict):
            artist_tags = [artist_tags]
        artist_genres = [tag["name"].lower() for tag in artist_tags if isinstance(tag, dict)]
        features["artist_genres"] = artist_genres[:5]

    return features


# ========================================
# SPOTIFY API FUNCTIONS
# ========================================
def get_spotify_profile(access_token):
    url = "https://api.spotify.com/v1/me"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(url, headers=headers)
    return response.json() if response.status_code == 200 else None

def get_spotify_top_tracks(access_token, limit=10):
    url = f"https://api.spotify.com/v1/me/top/tracks?limit={limit}"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(url, headers=headers)
    return response.json()["items"] if response.status_code == 200 else []

def get_spotify_recently_played(access_token, limit=10):
    url = f"https://api.spotify.com/v1/me/player/recently-played?limit={limit}"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(url, headers=headers)
    return response.json()["items"] if response.status_code == 200 else []

# def get_access_token(client_id, client_secret):
#     auth_str = f"{client_id}:{client_secret}"
#     b64_auth = base64.b64encode(auth_str.encode()).decode()
#
#     headers = {
#         "Authorization": f"Basic {b64_auth}",
#         "Content-Type": "application/x-www-form-urlencoded"
#     }
#
#     data = {
#         "grant_type": "client_credentials"
#     }
#
#     response = requests.post("https://accounts.spotify.com/api/token", headers=headers, data=data)
#
#     if response.status_code == 200:
#         token_info = response.json()
#         return token_info["access_token"]
#     else:
#         print("Error:", response.status_code, response.text)
#         return None

def get_user_access_token(client_id, client_secret, redirect_uri, code):
    url = "https://accounts.spotify.com/api/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret
    }
    response = requests.post(url, headers=headers, data=data)
    if response.status_code == 200:
        return response.json()
    else:
        print("Error:", response.status_code, response.text)
        return None

# ========================================
# WEATHER API FUNCTION
# ========================================
def get_weather_data(api_key, city="Tel Aviv"):
    url = "http://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": city,
        "appid": api_key,
        "units": "metric"
    }
    response = requests.get(url, params=params)
    if response.status_code == 200:
        data = response.json()
        weather_desc = data["weather"][0]["description"]
        temp = data["main"]["temp"]
        return {"weather": weather_desc, "temperature_celsius": temp}
    else:
        print("Weather API Error:", response.status_code, response.text)
        return {}


def build_user_profile(spotify_token, weather_api_key):
    profile = get_spotify_profile(spotify_token)
    top_tracks = get_spotify_top_tracks(spotify_token, limit=5)
    recent_tracks = get_spotify_recently_played(spotify_token, limit=5)
    weather = get_weather_data(weather_api_key)

    # Build listening history
    listening_history = []
    for item in recent_tracks:
        track = item["track"]
        listening_history.append({
            "title": track["name"],
            "artist": track["artists"][0]["name"],
            "album": track["album"]["name"]
        })

    # Build liked songs with audio features
    liked_songs = []
    for track in top_tracks:
        #audio_features = get_audio_features(track["id"], spotify_token)
        liked_songs.append({
            "title": track["name"],
            "artist": track["artists"][0]["name"],
            #"audio_features": audio_features
        })

    user_profile = {
        "user_profile": {
            "user_id": profile["id"],
            "display_name": profile.get("display_name"),
            "email": profile.get("email"),
            "country": profile.get("country"),
            "product": profile.get("product"),
            "listening_behavior": {
                "listening_history": listening_history,
                "liked_songs": liked_songs
            },
            "environmental_context": weather
        }
    }
        #POSSIBLE FEATURE - take the top tracks add more information about each one using chatGPT
    #Take the eviromental_context and pass it to chatGPT to turn these numbers into text better fit as a prompt

    return user_profile


# =============================================================================
# COMBINED LASTFM + MILLION SONG DATASET INTEGRATION
# =============================================================================

# def get_msd_audio_features(artist, track):
#     """
#     Get audio features from the Million Song Dataset for a given track.
#     Placeholder: Replace with real MSD data extraction logic!
#     """
#     # Here, simulate fetching MSD features. Replace with actual MSD data access logic.
#     msd_features = {
#         "tempo": 120,
#         "loudness": -10,
#         "key": 5,
#         "mode": 1,
#         "time_signature": 4,
#         "danceability": 0.6,
#         "energy": 0.7,
#         "valence": 0.5,
#         "acousticness": 0.2,
#         "instrumentalness": 0.1,
#         "speechiness": 0.05,
#         "liveness": 0.1
#     }
#     msd_features["analysis_source"] = "million_song_dataset"
#     return msd_features


def get_enhanced_audio_features(artist, track, lastfm_api_key):
    """
    Combine Last.fm real data with Million Song Dataset audio features
    """
    print(f"🎵 Analyzing: {track} by {artist}")

    # Step 1: Get Last.fm data
    print("  📡 Fetching Last.fm data...")
    lastfm_track = get_lastfm_track_info(artist, track, lastfm_api_key)
    lastfm_artist = get_lastfm_artist_info(artist, lastfm_api_key)

    # Extract Last.fm features
    lastfm_features = extract_lastfm_features(lastfm_track, lastfm_artist)

    if lastfm_features.get("genres"):
        print(f"  🏷️  Genres: {', '.join(lastfm_features['genres'][:3])}")

    # Step 2: Get Million Song Dataset audio features
    print("  📊 Getting audio features from the Million Song Dataset...")
    #msd_features = get_msd_audio_features(artist, track)

    # Step 3: Combine both datasets
    combined_features = {
        "track_name": track,
        "artist_name": artist,
        #"audio_features": msd_features,
        "metadata": lastfm_features,
        "data_sources": ["lastfm", "million_song_dataset"]
    }

    print(f"  ✅ Analysis complete! Sources: {', '.join(combined_features['data_sources'])}")

    # Add a small delay to be respectful to APIs
    time.sleep(0.5)

    return combined_features


def augment_recommendations_with_enhanced_features(recommendations, lastfm_api_key):
    """
    Enhance recommendations with Last.fm + MSD data
    """
    print(f"\n🚀 Enhancing {len(recommendations)} recommendations with Last.fm + MSD...")
    print("=" * 60)

    enhanced_recommendations = []

    for i, rec in enumerate(recommendations, 1):
        print(f"\n[{i}/{len(recommendations)}]", end=" ")

        try:
            # Get enhanced features
            enhanced_data = get_enhanced_audio_features(
                rec["artist"],
                rec["title"],
                lastfm_api_key
            )

            # Add enhanced data to recommendation
            rec_copy = rec.copy()
            rec_copy["audio_features"] = enhanced_data["audio_features"]
            rec_copy["metadata"] = enhanced_data["metadata"]
            rec_copy["data_sources"] = enhanced_data["data_sources"]

            enhanced_recommendations.append(rec_copy)

        except Exception as e:
            print(f" Error processing {rec['title']}: {e}")
            enhanced_recommendations.append(rec)

    print(f"\n✅ Enhancement complete! {len(enhanced_recommendations)} tracks processed.")
    return enhanced_recommendations

# =============================================================================
# IMPLIMWENT USER FEEDBACK TO LOGIC
# =============================================================================

user_story = []

def GetUserResponseToSuggestion(curret_reccomended_song, user_story):
    #print(user_story)

    print(curret_reccomended_song["suggested_lyrics"])

    while(1):
        response = input("choose 1 - LIKE or 0 - DISLIKE")
        if response.isdigit():
            response=int(response)
            if response == 0:
                print("song discarded!")
                return;
            elif response == 1:
                addLyricToUserStoryAfterLike(curret_reccomended_song,user_story)
                return
            else:
                print("Invalid choice! Please enter 1 or 0.")
        else:
            print("Invalid choice! Please enter 1 or 0.")



def addLyricToUserStoryAfterLike(curret_reccomended_song, user_profile):
    user_profile["user_profile"]["liked_songs_details"].append(curret_reccomended_song)
    user_profile["user_profile"]["user_story"].append(curret_reccomended_song["suggested_lyrics"])
    return

final_analysis_prompt = (
    "You are a compassionate, insightful music assistant.\n"
    "A user has just finished reviewing some song recommendations and has created this personal 'user story' of lyrics:\n\n"
    "{user_story}\n\n"
    "Based on these chosen lyrics, please write a short, friendly analysis of the user's character and emotional state.\n"
    "Use a warm, encouraging tone. Make it 3-4 sentences, focusing on empathy and understanding."
)

def get_final_user_analysis(user_story, openai_client):
    # Prepare the prompt, inserting the actual user story
    prompt_text = final_analysis_prompt.format(user_story='\n'.join(user_story))

    print("\n--- SENDING FINAL ANALYSIS PROMPT TO CHATGPT ---\n")
    response = openai_client.chat.completions.create(
        model="gpt-4",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a music assistant who writes warm, friendly character analyses based on song lyrics.\n"
                    "Do not mention that you are an AI. Do not talk about your process. Simply respond to the user."
                )
            },
            {"role": "user", "content": prompt_text}
        ],
        temperature=0.7
    )

    # Extract and return the final analysis
    final_analysis = response.choices[0].message.content.strip()
    return final_analysis

# =============================================================================
# MAIN INTEGRATION
# =============================================================================

# Your existing user profile and system prompt (unchanged)
# user_profile = {
#     "user_profile": {
#         "user_id": "your_unique_user_id",
#         "demographics": {
#             "age": 23,
#             "gender": "male",
#             "location": "Tel Aviv, Israel"
#         },
#         "mood_or_activity": "melancholic evening",
#         "listening_behavior": {
#             "listening_history": [
#                 {
#                     "title": "Hurt",
#                     "artist": "Johnny Cash",
#                     "play_count": 42,
#                     "skip_count": 0,
#                     "replay_count": 15
#                 },
#                 {
#                     "title": "Creep",
#                     "artist": "Radiohead",
#                     "play_count": 30,
#                     "skip_count": 1,
#                     "replay_count": 8
#                 }
#             ],
#             "likes": ["Hurt", "Creep", "The Night We Met"],
#             "dislikes": ["Happy", "Shake It Off"],
#             "search_history": [
#                 "sad acoustic songs",
#                 "songs about regret",
#                 "radiohead discography"
#             ],
#             "playlist_activity": {
#                 "added": ["Breathe Me", "The Blower's Daughter"],
#                 "removed": ["Can't Stop the Feeling"]
#             },
#             "session_patterns": {
#                 "frequency_per_week": 6,
#                 "average_session_duration_minutes": 45,
#                 "active_hours": ["22:00", "01:00"]
#             },
#             "listening_context": "night-time reflection"
#         },
#         "liked_songs": [
#             {
#                 "title": "Hurt",
#                 "artist": "Johnny Cash",
#                 "lyrics_excerpt": "I hurt myself today to see if I still feel...",
#                 "topics": ["pain", "regret", "existentialism"],
#                 "sentiment": "melancholic",
#                 "audio_features": {
#                     "genre": "country",
#                     "tempo_bpm": 90,
#                     "key": "A minor",
#                     "energy": 0.2,
#                     "valence": 0.1,
#                     "danceability": 0.3,
#                     "loudness": -12.5,
#                     "instrumentalness": 0.0,
#                     "speechiness": 0.05,
#                     "acousticness": 0.9
#                 }
#             },
#             {
#                 "title": "The Night We Met",
#                 "artist": "Lord Huron",
#                 "lyrics_excerpt": "I had all and then most of you, some and now none of you...",
#                 "topics": ["loss", "nostalgia", "love"],
#                 "sentiment": "wistful",
#                 "audio_features": {
#                     "genre": "indie folk",
#                     "tempo_bpm": 110,
#                     "key": "D major",
#                     "energy": 0.4,
#                     "valence": 0.3,
#                     "danceability": 0.5,
#                     "loudness": -10.2,
#                     "instrumentalness": 0.1,
#                     "speechiness": 0.03,
#                     "acousticness": 0.85
#                 }
#             },
#             {
#                 "title": "Creep",
#                 "artist": "Radiohead",
#                 "lyrics_excerpt": "I'm a creep, I'm a weirdo...",
#                 "topics": ["alienation", "identity", "self-doubt"],
#                 "sentiment": "dark",
#                 "audio_features": {
#                     "genre": "alternative rock",
#                     "tempo_bpm": 92,
#                     "key": "G major",
#                     "energy": 0.6,
#                     "valence": 0.2,
#                     "danceability": 0.4,
#                     "loudness": -8.7,
#                     "instrumentalness": 0.0,
#                     "speechiness": 0.04,
#                     "acousticness": 0.5
#                 }
#             }
#         ],
#         "device_info": {
#             "device_type": "mobile",
#             "os": "iOS",
#             "app_used": "Spotify"
#         },
#         "social_signals": {
#             "friends_listening_to": ["Phoebe Bridgers", "Bon Iver", "Ben Howard"],
#             "shared_playlists": ["Late Night Sad Vibes", "Deep Thoughts"],
#             "regional_trends": ["Indie acoustic", "Alt-folk"]
#         },
#         "environmental_context": {
#             "weather": "clear night",
#             "temperature_celsius": 21
#         }
#     }
# }

system_prompt = (
    "You are a music recommendation assistant that specializes in lyrics and emotional tone.\n"
    "A user has shared a list of songs they deeply resonate with. Each song includes a lyrics excerpt, core emotional themes, and sentiment.\n"
    "Your job is to recommend 5 new songs that are lyrically similar, emotionally aligned, or thematically relevant.\n"
    "For each song, provide:\n"
    "1. A 20-second lyrics snippet that best matches the user's taste\n"
    "2. An estimated time range for that snippet (e.g., \"00:42 - 01:02\")\n"
    "3. The suggested lyrics as a string\n"
    "4. The suggested snippet's start and end times as separate fields (HH:MM:SS)\n"
    "5. A short reason explaining why the song and that specific part would resonate with the user\n"
    "Do not include any of the songs already liked by the user. Focus on well-known songs with emotionally rich lyrics.\n"
    "\n"
    "Instead of JSON, return your 5 recommendations in this simple text format:\n\n"
    "Title: <title>\n"
    "Artist: <artist>\n"
    "Snippet Lyrics: <snippet_lyrics>\n"
    "Snippet Timestamps: <snippet_timestamps>\n"
    "Suggested Lyrics: <suggested_lyrics>\n"
    "Suggested Lyrics Start Time: <suggested_lyrics_start_time>\n"
    "Suggested Lyrics End Time: <suggested_lyrics_end_time>\n"
    "Reason: <reason>\n\n"
    "Separate each recommendation with a line containing '---'.\n"
    "Do not add extra commentary or markdown, just this plain text."
)

#An empty list of user liked lyrics.


def main():
    print("ENHANCED MUSIC RECOMMENDATION SYSTEM")
    print("=" * 60)

    spotify_client_id="spotify_client_id"
    spotify_client_secret="client_secret"
    redirect_uri = "https://192.168.7.33:8080/callback"
    code = ""

    OPENAI_API_KEY = "openapikey"  # Replace with your key #paid
    LASTFM_API_KEY = "lastfmkey" #free
    SPOTIFY_REQUEST_TOKEN_RESPONSE = get_user_access_token(spotify_client_id, spotify_client_secret, redirect_uri, code)
    WEATHER_API_KEY = "weatherapikey" #free

    SPOTIFY_ACCESS_TOKEN=SPOTIFY_REQUEST_TOKEN_RESPONSE["access_token"]

    # Initialize ChatGPT client
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

    user_profile = build_user_profile(SPOTIFY_ACCESS_TOKEN, WEATHER_API_KEY)

    # Add empty user_story and liked_songs_details to user_profile
    #user_profile["user_profile"]["user_story"] = []
    #user_profile["user_profile"]["liked_songs_details"] = []

    user_profile["user_profile"]["user_story"] = []
    user_profile["user_profile"]["liked_songs_details"] = []

    try:
        for round_num in range(2):  # Two sets of recommendations
            print(f"\n=== ROUND {round_num + 1} ===\n")
            print("Getting music recommendations from ChatGPT...")

            response = openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_profile)}
                ],
                temperature=0.8
            )


            chat_output = response.choices[0].message.content.strip()

            parsed_recommendations = parse_text_recommendations(chat_output)

            print(json.dumps({"recommendations": parsed_recommendations}, indent=2))


            print(f"Got {len(parsed_recommendations)} recommendations from ChatGPT.")

            # Enhance recommendations
            enhanced_recommendations = augment_recommendations_with_enhanced_features(
                parsed_recommendations,
                LASTFM_API_KEY
            )

            # Get user input for first two recommendations
            for rec in enhanced_recommendations:
                GetUserResponseToSuggestion(rec, user_profile)

        # Final output
        print("\n" + "=" * 60)
        print("FINAL USER PROFILE:")
        print(json.dumps(user_profile, indent=2))

        # After rounds are complete, get final user analysis
        final_analysis = get_final_user_analysis(
            user_profile["user_profile"]["user_story"],
            openai_client
        )

        print("\n--- FINAL USER CHARACTER & EMOTIONAL ANALYSIS ---")
        print(final_analysis)

        # Optionally save to a file
        with open("user_character_analysis.txt", "w") as f:
            f.write(final_analysis)

        print("\nAnalysis saved to 'user_character_analysis.txt'")
        print("\nProgram completed. Goodbye!")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()