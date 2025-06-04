import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Home as HomeIcon, Search, Heart, Settings, ExternalLink } from "lucide-react";

interface SongCard {
  title: string;
  artist: string;
  preview_url?: string;
  image_url?: string;
  spotify_url?: string;
}

const fallbackImage =
  "https://cdn.dribbble.com/userupload/29179303/file/original-2536efd374c53c282a258d4080eb7717.jpg";

const CustomAudioPlayer: React.FC<{ src: string }> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setPlaying(true);
    audioRef.current?.play();
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const duration = audioRef.current.duration;
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

const Discover = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<SongCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [lastDirection, setLastDirection] = useState<"left" | "right" | null>(null);

  const fetchMoreSongs = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/discover?username=" + localStorage.getItem("username"),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      const newCards: SongCard[] = data.songs.map((song: any) => ({
        title: song.title,
        artist: song.artist,
        preview_url: song.preview_url,
        image_url: song.image_url || fallbackImage,
        spotify_url: song.spotify_url,
      }));
      
      setCards(prevCards => [...prevCards, ...newCards]);
    } catch (error) {
      console.error("Failed to fetch more songs:", error);
    }
  };

  // Check if we need more songs when currentIndex changes
  useEffect(() => {
    // If we have 1 card left, fetch more
    if (cards.length - currentIndex === 1) {
      fetchMoreSongs();
    }
  }, [currentIndex]);

  // Update the initial fetch to only get 5 songs
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/discover?username=" + localStorage.getItem("username"),
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const data = await response.json();
        const cardsWithImages: SongCard[] = data.songs.map((song: any) => ({
          title: song.title,
          artist: song.artist,
          preview_url: song.preview_url,
          image_url: song.image_url || fallbackImage,
          spotify_url: song.spotify_url,
        }));
        setCards(cardsWithImages);
        setCurrentIndex(0);
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
      }
    };

    fetchRecommendations();
  }, []);

  const handleSwipe = (direction: "left" | "right") => {
    if (currentIndex >= cards.length) return;

    setLastDirection(direction);
    setSwipeDirection(direction);

    setTimeout(() => {
      setCurrentIndex((prevIndex) => prevIndex + 1);
    }, 50);
  };

  // Reset animation state after transition
  useEffect(() => {
    if (swipeDirection) {
      const timer = setTimeout(() => {
        setSwipeDirection(null);
        setLastDirection(null);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [swipeDirection]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe("left"),
    onSwipedRight: () => handleSwipe("right"),
    preventScrollOnSwipe: true,
    trackMouse: true,
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
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-sm text-red-400 hover:text-red-500"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </header>

      {/* Card Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold mb-4">Discover New Music</h1>
        <div className="relative w-full max-w-sm aspect-[4/5]" {...swipeHandlers}> {/* Changed from max-w-md to max-w-sm */}
          <AnimatePresence>
            {cards.length > 0 && currentIndex < cards.length && (
              <motion.div
                key={cards[currentIndex].spotify_url || cards[currentIndex].title}
                className="absolute w-full h-full rounded-lg flex flex-col shadow-lg overflow-hidden"
                initial={{ x: swipeDirection === "right" ? 300 : -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: lastDirection === "right" ? 300 : -300, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* Image Container - Removed padding and adjusted flex properties */}
                <div className="w-full h-full flex items-start justify-center bg-black/5">
                  <img
                    src={cards[currentIndex].image_url}
                    alt={cards[currentIndex].title}
                    className="w-full h-full object-contain"
                    style={{ objectPosition: 'top' }}
                  />
                </div>

                {/* Info Box - No changes needed here */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm px-4 py-3 flex flex-col items-center gap-2">
                  <div className="w-full text-center">
                    <h2 className="text-lg font-bold text-white/95 leading-tight">
                      {cards[currentIndex].title}
                    </h2>
                    <p className="text-sm text-purple-200/90">
                      {cards[currentIndex].artist}
                    </p>
                  </div>

                  {cards[currentIndex].preview_url && (
                    <div className="w-full">
                      <CustomAudioPlayer src={cards[currentIndex].preview_url} />
                    </div>
                  )}

                  <a
                    href={cards[currentIndex].spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-green-400/90 hover:text-green-300 text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Listen on Spotify
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {currentIndex >= cards.length && (
            <p className="text-center text-gray-400">No more cards to swipe!</p>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-black/70 backdrop-blur-md h-16 flex items-center justify-around">
        <button onClick={() => navigate("/home")} className="flex flex-col items-center text-white">
          <HomeIcon className="w-6 h-6" />
          <span className="text-xs mt-1">Home</span>
        </button>
        <button onClick={() => navigate("/discover")} className="flex flex-col items-center text-purple-400"> {/* Added text-purple-400 */}
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
