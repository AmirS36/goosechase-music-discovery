import express from 'express';
import cors from "cors";
import dotenv from 'dotenv';

import authRouthes from './routes/auth';
import registerRoute from './routes/register';
import discoverRoute from './routes/recommendations/discover';
import swipesRoute from './routes/recommendations/swipes';
import spotifyRoutes from './routes/spotify';
import spotifyProfileRoute from './routes/spotify/spotifyProfile';

require('dotenv').config(); // Ensure dotenv is loaded before importing routes

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouthes)
app.use('/api/register', registerRoute);
app.use('/api/discover', discoverRoute);
app.use('/api/swipes', swipesRoute);
app.use('/api/auth', spotifyRoutes);
app.use('/api/spotify-profile', spotifyProfileRoute);



export default app;