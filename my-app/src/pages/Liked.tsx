// frontend/src/pages/Liked.tsx (full page with "Unlike")
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Home as HomeIcon, Search, Heart, Settings, ExternalLink, ThumbsDown } from "lucide-react";

type LikedSong = {
  id: string;
  title: string;
  artist: string;
  image_url?: string | null;
  preview_url?: string | null;
  spotify_url?: string | null;
  liked_at?: string;
};

const fallbackImage =
  "https://cdn.dribbble.com/userupload/29179303/file/original-2536efd374c53c282a258d4080eb7717.jpg";

const Liked: React.FC = () => {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<LikedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function fetchLiked() {
    const username = localStorage.getItem("username") || "";
    const res = await fetch(`http://localhost:5000/api/swipes/liked?username=${encodeURIComponent(username)}&limit=200`);
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    if (!ct.includes("application/json")) throw new Error(`Non-JSON: ${text.slice(0, 200)}`);
    const data = JSON.parse(text);
    setSongs(Array.isArray(data) ? data : (data?.songs ?? []));
  }

  useEffect(() => {
    (async () => {
      try {
        await fetchLiked();
      } catch (e: any) {
        setErr(e?.message || "Failed to load liked songs.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const unlike = async (trackId: string) => {
    const username = localStorage.getItem("username") || "";
    // optimistic update
    setSongs(prev => prev.filter(s => s.id !== trackId));
    try {
      const res = await fetch(`http://localhost:5000/api/swipes/unlike`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, trackId }),
      });
      if (!res.ok) {
        // revert on failure
        await fetchLiked();
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
      }
      // Optionally: trigger a toast “Removed from liked”
    } catch (e) {
      console.error("Unlike failed:", e);
    }
  };

  const handleLogout = () => navigate("/");

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-purple-900 text-white flex flex-col">
      {/* Top Section */}
      <header className="flex justify-between items-center p-4">
        <div className="flex items-center gap-2">
          <User className="w-6 h-6" />
          <span className="text-sm font-medium">Profile</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-sm text-red-400 hover:text-red-500"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-4 pb-24">
        <h1 className="text-2xl font-bold mb-4">Your previously liked songs</h1>

        {loading && <p className="text-white/80">Loading…</p>}

        {!loading && err && (
          <p className="text-sm text-red-300">Couldn’t load liked songs: {err}</p>
        )}

        {!loading && !err && songs.length === 0 && (
          <p className="text-white/70">No liked songs yet — swipe right in Discover to add some!</p>
        )}

        {!loading && !err && songs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {songs.map((s) => (
              <div
                key={s.id + (s.liked_at || "")}
                className="rounded-xl bg-white/10 border border-white/10 p-3 flex flex-col gap-3"
              >
                <div className="w-full aspect-square bg-black/20 rounded-lg overflow-hidden relative">
                  <img
                    src={s.image_url || fallbackImage}
                    alt={s.title}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => unlike(s.id)}
                    className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/60 hover:bg-black/70 text-xs inline-flex items-center gap-1"
                    title="Unlike"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    Unlike
                  </button>
                </div>

                <div>
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm text-white/70">{s.artist}</div>
                  {s.liked_at && (
                    <div className="text-xs text-white/50 mt-1">
                      Liked {new Date(s.liked_at).toLocaleString()}
                    </div>
                  )}
                </div>

                {s.preview_url && (
                  <audio src={s.preview_url} controls className="w-full" preload="none" />
                )}
                {s.spotify_url && (
                  <a
                    href={s.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-green-300 hover:text-green-200 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Listen on Spotify
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md h-16 border-t border-white/10">
        <div className="h-full flex items-center justify-around">
          <button onClick={() => navigate("/home")} className="flex flex-col items-center text-white">
            <HomeIcon className="w-6 h-6" />
            <span className="text-xs mt-1">Home</span>
          </button>
          <button onClick={() => navigate("/discover")} className="flex flex-col items-center text-white">
            <Search className="w-6 h-6" />
            <span className="text-xs mt-1">Discover</span>
          </button>
          <button onClick={() => navigate("/liked")} className="flex flex-col items-center text-purple-400">
            <Heart className="w-6 h-6" />
            <span className="text-xs mt-1">Liked</span>
          </button>
          <button onClick={() => navigate("/settings")} className="flex flex-col items-center text-white">
            <Settings className="w-6 h-6" />
            <span className="text-xs mt-1">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Liked;
