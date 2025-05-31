import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginForm from './pages/LoginForm';
import RegisterForm from './pages/RegisterForm';
import Home from './pages/Home';
import Discover from './pages/Discover';
import Liked from './pages/Liked';
import Settings from './pages/Settings';


const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginForm />} />
      <Route path="/register" element={<RegisterForm />} />
      <Route path="/home" element={<Home />} />
      <Route path="/discover" element={<Discover />} />
      <Route path="/liked" element={<Liked />} />
      <Route path="/settings" element={<Settings />} />
      {/* Add more routes as needed */}
    </Routes>
  );
};

export default App;