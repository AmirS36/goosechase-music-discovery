import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Home as HomeIcon, Search, Heart, Settings } from "lucide-react";

interface Card {
  title: string;
  artist: string;
  lyrics: string;
  start: string;
  end: string;
  reason: string;
  imageUrl?: string; // optional, will fallback if missing
}

const Discover = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [lastDirection, setLastDirection] = useState<"left" | "right" | null>(null);

useEffect(() => {
  const fetchRecommendations = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();

      const cardsWithImages = data.songs.map((song: any) => ({
        ...song,
        imageUrl: song.imageUrl || "https://cdn.dribbble.com/userupload/29179303/file/original-2536efd374c53c282a258d4080eb7717.jpg"
      }));

      setCards(cardsWithImages);
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
        <div className="relative w-full max-w-md h-96" {...swipeHandlers}>
          <AnimatePresence>
            {cards.length > 0 && currentIndex < cards.length && (
              <motion.div
                key={cards[currentIndex].id}
                className="absolute w-full h-full bg-white/10 rounded-lg flex flex-col items-center justify-end p-4 shadow-lg"
                style={{
                  backgroundImage: `url(${cards[currentIndex].imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                initial={{ x: swipeDirection === "right" ? 300 : -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: lastDirection === "right" ? 300 : -300, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <h2 className="text-xl font-bold text-white">
                  {cards[currentIndex].title}
                </h2>
                <p className="text-sm text-gray-300">
                  {cards[currentIndex].reason}
                </p>
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
