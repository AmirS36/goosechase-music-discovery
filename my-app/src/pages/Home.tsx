// src/pages/Home.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Home as HomeIcon, Search, Heart, Settings } from "lucide-react";

type LangPref = { lang: string; share: number };
type Assessment = {
  paragraph: string;
  sampleSize: number;
  topThemes: string[] | null;
  dominantMood?: string | null;
  dominantStyle?: string | null;
  grandStyle?: string | null;
  grandAvg?: number | null;   // 0..100
  langPrefs?: LangPref[] | null;
  createdAt?: string;
};

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-2 py-1 text-xs rounded-full bg-white/10 text-white/90 border border-white/10">
    {children}
  </span>
);

const Home = () => {
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const username = localStorage.getItem("username") || "";
    if (!username) {
      setLoading(false);
      setErr("No username in session.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/taste?username=${encodeURIComponent(username)}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        const data = await res.json();
        setAssessment(data?.assessment ?? null);
      } catch (e: any) {
        setErr(e?.message || "Failed to load taste.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = () => {
    console.log("Logging out...");
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

      {/* Middle Section */}
      <main className="flex-1 flex flex-col items-center justify-start px-6 py-6 gap-6">
        <h1 className="text-2xl font-bold">Welcome to Beatwave</h1>
        <p className="text-center text-gray-300">
          Discover new music, manage your playlists, and enjoy your favorite songs.
        </p>

        {/* Taste Card */}
        <div className="w-full max-w-xl rounded-2xl bg-white/10 border border-white/10 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Your lyrical taste</h2>
            {assessment?.sampleSize ? (
              <span className="text-xs text-white/60">
                Based on {assessment.sampleSize} liked tracks
              </span>
            ) : null}
          </div>

          {loading && <p className="text-sm text-white/70">Loading taste…</p>}

          {!loading && err && (
            <p className="text-sm text-red-300">Couldn’t load taste: {err}</p>
          )}

          {!loading && !err && !assessment && (
            <p className="text-sm text-white/70">
              Start liking songs in Discover and I’ll build your taste profile here.
            </p>
          )}

          {!loading && !err && assessment && (
            <>
              <p className="text-sm text-white/90 leading-relaxed">{assessment.paragraph}</p>

              <div className="flex flex-wrap gap-2 mt-3">
                {(assessment.topThemes ?? []).slice(0, 5).map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
                {assessment.dominantMood ? <Chip>{assessment.dominantMood}</Chip> : null}
                {assessment.dominantStyle ? <Chip>{assessment.dominantStyle}</Chip> : null}
                {assessment.grandStyle ? (
                  <Chip>
                    {assessment.grandStyle}
                    {typeof assessment.grandAvg === "number" ? ` · ${assessment.grandAvg}%` : ""}
                  </Chip>
                ) : null}
                {(assessment.langPrefs ?? [])
                  .slice(0, 2)
                  .map((lp) => <Chip key={lp.lang}>{lp.lang} · {Math.round(lp.share)}%</Chip>)}
              </div>

              {assessment.createdAt ? (
                <p className="text-[11px] text-white/50 mt-2">
                  Updated {new Date(assessment.createdAt).toLocaleString()}
                </p>
              ) : null}
            </>
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

export default Home;
