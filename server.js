const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const mm = require('music-metadata');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from 'public' folder
app.use('/uploads', express.static('uploads')); // Serve uploaded audio files

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = /mp3|wav|ogg|m4a/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('audio/');
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Connect to MongoDB
// We connect to a local database named 'music-app'
mongoose.connect('mongodb://localhost:27017/music-app')
.then(() => console.log('Connected to MongoDB music-app'))
.catch(err => console.error('Could not connect to MongoDB', err));

// --- SCHEMAS & MODELS ---

// 1. Playlist Schema (Parent)
const playlistSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  creator: { 
    type: String 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const Playlist = mongoose.model('Playlist', playlistSchema);

// 2. Song Schema (Child)
const songSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  artist: { 
    type: String 
  },
  duration: {
    type: String
  },
  audioFile: {
    type: String // Stores the path to the uploaded audio file
  },
  // --- LINKING HAPPENS HERE ---
  // This 'playlistId' field acts as the Foreign Key.
  // It stores the unique _id of the Playlist this song belongs to.
  playlistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Playlist', // Tells Mongoose this ID refers to the 'Playlist' collection
    required: true
  }
});

const Song = mongoose.model('Song', songSchema);

// --- API ENDPOINTS ---

// 0. Clear all data from database
app.delete('/api/clear-all', async (req, res) => {
  try {
    await Song.deleteMany({});
    await Playlist.deleteMany({});
    
    // Delete all uploaded files
    const uploadsDir = path.join(__dirname, 'uploads');
    const files = fs.readdirSync(uploadsDir);
    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
    
    console.log('Database and uploads cleared');
    res.json({ message: 'All data cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 1. Get all Playlists
app.get('/api/playlists', async (req, res) => {
  try {
    const playlists = await Playlist.find().sort({ createdAt: -1 });
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create a new Playlist
app.post('/api/playlists', async (req, res) => {
  try {
    const { name, creator } = req.body;
    const playlist = new Playlist({ name, creator });
    await playlist.save();
    
    console.log(`New Playlist Created: ${playlist.name}`);
    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Add a Song (Linked to a Playlist) with Audio File Upload and Auto-metadata extraction
app.post('/api/songs', upload.single('audioFile'), async (req, res) => {
  try {
    const { playlistId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    // Extract metadata from the uploaded audio file
    const filePath = path.join(__dirname, 'uploads', req.file.filename);
    const metadata = await mm.parseFile(filePath);
    
    // Extract title, artist, and duration from metadata
    const title = metadata.common.title || req.file.originalname.replace(/\.[^/.]+$/, "");
    const artist = metadata.common.artist || 'Unknown Artist';
    const durationInSeconds = metadata.format.duration || 0;
    const duration = `${Math.floor(durationInSeconds / 60)}:${Math.floor(durationInSeconds % 60).toString().padStart(2, '0')}`;

    const song = new Song({
      title,
      artist,
      duration,
      audioFile: `/uploads/${req.file.filename}`,
      playlistId
    });

    await song.save();
    
    console.log(`New Song Added: ${song.title} by ${artist} to Playlist ID: ${playlistId}`);
    res.status(201).json(song);
  } catch (error) {
    console.error('Error adding song:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Get Playlist details AND all associated Songs
app.get('/api/playlists/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Step A: Find the Playlist document by its ID
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Step B: Find all Songs where 'playlistId' matches this Playlist's ID.
    // This effectively "joins" the two collections based on the relationship.
    const songs = await Song.find({ playlistId: id });

    // Return both in a single response object
    res.json({
      playlist: playlist,
      songs: songs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Delete a Playlist and all its songs
app.delete('/api/playlists/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the playlist
    const playlist = await Playlist.findByIdAndDelete(id);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Find all songs in this playlist
    const songs = await Song.find({ playlistId: id });
    
    // Delete audio files
    songs.forEach(song => {
      if (song.audioFile) {
        const filePath = path.join(__dirname, song.audioFile.replace(/^\//, ''));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    // Delete all songs in this playlist
    await Song.deleteMany({ playlistId: id });

    console.log(`Playlist deleted: ${playlist.name}`);
    res.json({ message: 'Playlist and all songs deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Delete a single Song
app.delete('/api/songs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the song
    const song = await Song.findByIdAndDelete(id);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Delete audio file
    if (song.audioFile) {
      const filePath = path.join(__dirname, song.audioFile.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    console.log(`Song deleted: ${song.title}`);
    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
