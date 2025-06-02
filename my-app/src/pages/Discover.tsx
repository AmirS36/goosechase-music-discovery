import React, { useState, useEffect } from "react";
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

const Discover = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<SongCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [lastDirection, setLastDirection] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/discover?username=" + localStorage.getItem("username"), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const data = await response.json();
        // Expecting data.songs as described
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
    // Optionally, add a dependency if you want to refetch on navigation
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
        <div className="relative w-full max-w-md h-96" {...swipeHandlers}>
          <AnimatePresence>
            {cards.length > 0 && currentIndex < cards.length && (
              <motion.div
                key={cards[currentIndex].spotify_url || cards[currentIndex].title}
                className="absolute w-full h-full bg-white/10 rounded-lg flex flex-col items-center justify-end p-4 shadow-lg"
                style={{
                  backgroundImage: `url(${cards[currentIndex].image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                initial={{ x: swipeDirection === "right" ? 300 : -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: lastDirection === "right" ? 300 : -300, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="w-full bg-black/60 rounded-lg p-4 mb-2 flex flex-col items-center">
                  <h2 className="text-xl font-bold text-white mb-1">{cards[currentIndex].title}</h2>
                  <p className="text-md text-purple-200 mb-2">{cards[currentIndex].artist}</p>
                  {cards[currentIndex].preview_url && (
                    <audio
                      controls
                      src={cards[currentIndex].preview_url}
                      className="mb-2 w-full"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <a
                      href={cards[currentIndex].spotify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-green-400 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Listen on Spotify
                    </a>
                  </div>
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
        <button onClick={() => navigate("/discover")} className="flex flex-col items-center text-white">
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
