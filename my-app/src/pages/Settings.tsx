import React from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Home as HomeIcon, Heart, Settings as SettingsIcon, Music, ShieldCheck, ExternalLink } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();

  const handleSpotifyLogin = () => {
    // Redirect to your backend's Spotify OAuth endpoint
    window.location.href = "http://localhost:5000/api/auth/spotify";
  };

  const handleLogout = () => {
    // Clear user session (if applicable) and navigate to login
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

      {/* Settings Content */}
      <main className="flex-1 flex flex-col items-center px-6 py-4">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        {/* Spotify Connect */}
        <section className="w-full max-w-md bg-white/10 rounded-lg p-5 mb-6 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-3">
            <Music className="w-7 h-7 text-green-400" />
            <span className="font-semibold text-lg">Connect with Spotify</span>
          </div>
          <p className="text-gray-300 text-center mb-4">
            Link your Spotify account to sync your liked songs and playlists.
          </p>
          <button
            onClick={handleSpotifyLogin}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2 rounded-full flex items-center gap-2 transition"
          >
            <ExternalLink className="w-5 h-5" />
            Log in with Spotify
          </button>
        </section>

        {/* Account Section */}
        <section className="w-full max-w-md bg-white/10 rounded-lg p-5 mb-6">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <User className="w-5 h-5" /> Account
          </h2>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Username</span>
              <span className="font-medium">your_username</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Email</span>
              <span className="font-medium">you@email.com</span>
            </div>
            {/* Add more account info/settings here */}
          </div>
        </section>

        {/* Privacy Section */}
        <section className="w-full max-w-md bg-white/10 rounded-lg p-5 mb-6">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Privacy
          </h2>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Private Account</span>
              <input type="checkbox" className="accent-purple-500 w-5 h-5" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Show Listening Activity</span>
              <input type="checkbox" className="accent-purple-500 w-5 h-5" />
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-black/70 backdrop-blur-md h-16 flex items-center justify-around">
        <button
          onClick={() => navigate("/home")}
          className="flex flex-col items-center text-white"
        >
          <HomeIcon className="w-6 h-6" />
          <span className="text-xs mt-1">Home</span>
        </button>
        <button
          onClick={() => navigate("/discover")}
          className="flex flex-col items-center text-white"
        >
          <Heart className="w-6 h-6" />
          <span className="text-xs mt-1">Discover</span>
        </button>
        <button
          onClick={() => navigate("/liked")}
          className="flex flex-col items-center text-white"
        >
          <Heart className="w-6 h-6" />
          <span className="text-xs mt-1">Liked Songs</span>
        </button>
        <button
          onClick={() => navigate("/settings")}
          className="flex flex-col items-center text-purple-400"
        >
          <SettingsIcon className="w-6 h-6" />
          <span className="text-xs mt-1">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default Settings;