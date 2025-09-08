import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Home as HomeIcon, Search, Heart, Settings, ExternalLink } from "lucide-react";

interface SongCard {
  title: string;
  artist: string;
  preview_url?: string | null;
  image_url?: string | null;
  spotify_url?: string | null;

  MIL?: string | null;     // short quote
  MIL_EXP?: string | null; // brief explanation
}

const fallbackImage =
  "https://cdn.dribbble.com/userupload/29179303/file/original-2536efd374c53c282a258d4080eb7717.jpg";

/* ----------------------------- Audio Player ----------------------------- */
const CustomAudioPlayer: React.FC<{ src: string }> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    setPlaying(true);
    audioRef.current?.play().catch(() => setPlaying(false));
    return () => {
      try { audioRef.current?.pause(); } catch {}
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => null);
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const duration = audioRef.current.duration || 1;
    setProgress((audioRef.current.currentTime / duration) * 100);
  };

  return (
    <div className="w-full flex items-center gap-2">
      <button
        onClick={togglePlay}
        className="bg-purple-600/80 hover:bg-purple-700 rounded-full p-1.5 transition-colors"
      >
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 h-1 bg-purple-900/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      <audio
        ref={audioRef}
        src={src}
        autoPlay
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        className="hidden"
      />
    </div>
  );
};

/* ------------------------------- Utilities ------------------------------ */
async function saveSwipe(card: SongCard, direction: "left" | "right", rank?: number) {
  try {
    const username = localStorage.getItem("username");
    if (!username) return;

    await fetch("http://localhost:5000/api/swipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        direction,
        rank,
        metadata: {
          title: card.title,
          artist: card.artist,
          image_url: card.image_url,
          preview_url: card.preview_url,
          spotify_url: card.spotify_url,
        },
      }),
    });
  } catch (e) {
    console.error("Failed to save swipe:", e);
  }
}

/* --------------------------------- Page --------------------------------- */
const Discover: React.FC = () => {
  const navigate = useNavigate();

  const [cards, setCards] = useState<SongCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [lastDirection, setLastDirection] = useState<"left" | "right" | null>(null);
  const [loading, setLoading] = useState(false);

  // Weather mode toggle + coords
  const [weatherMode, setWeatherMode] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Build URL with optional weather params
  const buildUrl = () => {
    const username = encodeURIComponent(localStorage.getItem("username") || "");
    const base = `http://localhost:5000/api/discover?username=${username}`;
    const w = weatherMode && coords ? `&weather=true&lat=${coords.lat}&lon=${coords.lon}` : "";
    return `${base}${w}`;
  };

  // Single fetch function used everywhere
  const fetchRecommendations = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(buildUrl(), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Discover fetch failed:", response.status, text.slice(0, 200));
        return;
      }

      const data = await response.json();
      const newCards: SongCard[] = (data?.songs || []).map((song: any) => ({
        title: song.title,
        artist: song.artist,
        preview_url: song.preview_url ?? null,
        image_url: song.image_url || fallbackImage,
        spotify_url: song.spotify_url ?? null,
        MIL: song.MIL ?? null,
        MIL_EXP: song.MIL_EXP ?? null,
      }));

      setCards((prev) => {
        const seen = new Set(prev.map((c) => c.spotify_url || `${c.title}|${c.artist}`));
        const unique = newCards.filter((c) => {
          const key = c.spotify_url || `${c.title}|${c.artist}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return [...prev, ...unique];
      });
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
    } finally {
      setLoading(false);
    }
  }, [loading, weatherMode, coords?.lat, coords?.lon]); // deps so it rebuilds the URL

  // Initial fetch
  useEffect(() => {
    if (cards.length === 0 && !loading) {
      fetchRecommendations();
    }
  }, [cards.length, loading, fetchRecommendations]);

  // Prefetch when near end
  useEffect(() => {
    const remaining = cards.length - currentIndex;
    if (remaining <= 1 && !loading) {
      fetchRecommendations();
    }
  }, [currentIndex, cards.length, loading, fetchRecommendations]);

  // // Refetch when Weather toggles or coords change (avoid first render double-fetch)
  // const firstWeatherRef = useRef(true);
  // useEffect(() => {
  //   if (firstWeatherRef.current) {
  //     firstWeatherRef.current = false;
  //     return;
  //   }
  //   setCards([]);
  //   setCurrentIndex(0);
  //   fetchRecommendations();
  // }, [weatherMode, coords?.lat, coords?.lon, fetchRecommendations]);

  // Swipe handlers
  const handleSwipe = (direction: "left" | "right") => {
    if (currentIndex >= cards.length) return;
    const card = cards[currentIndex];
    saveSwipe(card, direction, currentIndex);
    setLastDirection(direction);
    setSwipeDirection(direction);
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setSwipeDirection(null);
      setLastDirection(null);
    }, 50);
  };

  useEffect(() => {
    if (!swipeDirection && !lastDirection) return;
    const timer = setTimeout(() => {
      setSwipeDirection(null);
      setLastDirection(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [swipeDirection, lastDirection]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe("left"),
    onSwipedRight: () => handleSwipe("right"),
    preventScrollOnSwipe: true,
    trackMouse: false,
    delta: 100,
  });

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-purple-900 text-white flex flex-col">
      {/* Top Section */}
      <header className="flex justify-between items-center p-4">
        <div className="flex items-center gap-2">
          <User className="w-6 h-6" />
          <span className="text-sm font-medium">Profile</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Weather toggle */}
          <button
            onClick={() => {
              setWeatherMode((prev) => {
                const next = !prev;
                if (next && !coords && "geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                    (err) => console.warn("Geolocation denied/failed:", err),
                    { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
                  );
                }
                return next;
              });
            }}
            className={`text-sm px-3 py-1 rounded-md border ${
              weatherMode
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-transparent border-white/30 text-white/90 hover:bg-white/10"
            }`}
            title="Tilt recommendations by current weather"
          >
            {weatherMode ? "Weather: On" : "Weather"}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-red-400 hover:text-red-500"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </header>

      {/* Card Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold mb-4">Discover New Music</h1>
        <div className="relative w-full max-w-sm aspect-[4/5]" {...swipeHandlers}>
          <AnimatePresence initial={false}>
            {cards.length > 0 && currentIndex < cards.length ? (
              cards.slice(currentIndex, currentIndex + 3).map((card, i) => {
                const isTop = i === 0;
                const depthScale = 1 - i * 0.04;
                const depthOffset = i * 10;
                const depthOpacity = 1 - i * 0.05;
                const key = card.spotify_url || `${card.title}|${card.artist}|${i}`;

                return (
                  <motion.div
                    key={key}
                    className="absolute w-full h-full rounded-xl shadow-2xl overflow-hidden"
                    style={{
                      zIndex: 100 - i,
                      pointerEvents: isTop ? "auto" : "none",
                      isolation: "isolate",
                    }}
                    initial={{ scale: depthScale, y: depthOffset, opacity: depthOpacity }}
                    animate={{ scale: depthScale, y: depthOffset, opacity: depthOpacity }}
                    exit={
                      isTop
                        ? { x: lastDirection === "right" ? 300 : -300, opacity: 0 }
                        : { opacity: 0 }
                    }
                    transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  >
                    {/* Image */}
                    <div className="w-full h-full flex items-start justify-center bg-black/5">
                      <img
                        src={card.image_url || fallbackImage}
                        alt={card.title}
                        className="w-full h-full object-contain"
                        style={{ objectPosition: "top" }}
                      />
                    </div>

                    {/* Info */}
                    {isTop ? (
                      <motion.div
                        className="absolute bottom-0 left-0 right-0 px-4 py-3 flex flex-col items-center gap-2"
                        style={{
                          backgroundColor: "rgba(0,0,0,0.62)",
                          WebkitBackdropFilter: "blur(8px)",
                          backdropFilter: "blur(8px)",
                          willChange: "opacity, transform",
                          backfaceVisibility: "hidden",
                          contain: "paint",
                        }}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: 0.05 }}
                      >
                        <div className="w-full text-center">
                          <h2 className="text-lg font-bold text-white/95 leading-tight">
                            {card.title}
                          </h2>
                          <p className="text-sm text-purple-200/90">{card.artist}</p>
                        </div>

                        {(card.MIL || card.MIL_EXP) && (
                          <div className="w-full mt-1 text-center space-y-1">
                            {card.MIL && (
                              <p className="text-sm italic text-purple-100/95 leading-snug line-clamp-2">
                                “{card.MIL}”
                              </p>
                            )}
                            {card.MIL_EXP && (
                              <p className="text-[11px] text-purple-200/80 leading-snug line-clamp-3">
                                {card.MIL_EXP}
                              </p>
                            )}
                          </div>
                        )}

                        {card.preview_url && (
                          <div className="w-full">
                            <CustomAudioPlayer src={card.preview_url} />
                          </div>
                        )}

                        {card.spotify_url && (
                          <a
                            href={card.spotify_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-green-400/90 hover:text-green-300 text-sm transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Listen on Spotify
                          </a>
                        )}
                      </motion.div>
                    ) : (
                      <div
                        aria-hidden
                        className="absolute bottom-0 left-0 right-0 pointer-events-none"
                        style={{
                          height: 88,
                          background:
                            "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.0) 100%)",
                        }}
                      />
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                {loading ? (
                  <p className="text-center text-gray-400">Loading more songs…</p>
                ) : (
                  <p className="text-center text-gray-400">No more cards to swipe!</p>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-black/70 backdrop-blur-md h-16 flex items-center justify-around">
        <button onClick={() => navigate("/home")} className="flex flex-col items-center text-white">
          <HomeIcon className="w-6 h-6" />
          <span className="text-xs mt-1">Home</span>
        </button>
        <button onClick={() => navigate("/discover")} className="flex flex-col items-center text-purple-400">
          <Search className="w-6 h-6" />
          <span className="text-xs mt-1">Discover</span>
        </button>
        <button onClick={() => navigate("/liked")} className="flex flex-col items-center text-white">
          <Heart className="w-6 h-6" />
          <span className="text-xs mt-1">Liked</span>
        </button>
        <button onClick={() => navigate("/settings")} className="flex flex-col items-center text-white">
          <Settings className="w-6 h-6" />
          <span className="text-xs mt-1">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default Discover;
