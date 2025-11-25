const { useState, useEffect, useRef } = React;

// --- Components ---

const MusicPlayer = ({ song }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.load();
            audioRef.current.play();
            setIsPlaying(true);
        }
    }, [song]);

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current.currentTime);
        setDuration(audioRef.current.duration);
    };

    const handleSeek = (e) => {
        const seekTime = (e.target.value / 100) * duration;
        audioRef.current.currentTime = seekTime;
        setCurrentTime(seekTime);
    };

    const formatTime = (time) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="music-player card" style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}>🎵 Now Playing</h2>
            <div className="player-info">
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'white' }}>{song.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem', marginTop: '0.25rem' }}>{song.artist}</div>
                </div>
            </div>
            
            <audio 
                ref={audioRef} 
                src={song.audioFile}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
            />
            
            <div className="player-controls">
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={duration ? (currentTime / duration) * 100 : 0}
                    onChange={handleSeek}
                    className="progress-bar"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem' }}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
                
                <button 
                    onClick={togglePlay}
                    style={{ marginTop: '1.25rem' }}
                >
                    {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                </button>
            </div>
        </div>
    );
};

const PlaylistForm = ({ onPlaylistCreated }) => {
    const [name, setName] = useState('');
    const [creator, setCreator] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/playlists', { name, creator });
            onPlaylistCreated(res.data);
            setName('');
            setCreator('');
        } catch (err) {
            console.error(err);
            alert('Error creating playlist');
        }
    };

    return (
        <div className="card">
            <h2>✨ Create New Playlist</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>🎵 Playlist Name</label>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="e.g., Road Trip Mix"
                        required 
                    />
                </div>
                <div className="form-group">
                    <label>👤 Creator Name</label>
                    <input 
                        type="text" 
                        value={creator} 
                        onChange={(e) => setCreator(e.target.value)} 
                        placeholder="e.g., DJ Nitin"
                        required 
                    />
                </div>
                <button type="submit">🚀 Create Playlist</button>
            </form>
        </div>
    );
};

const SongForm = ({ playlistId, onSongAdded }) => {
    const [audioFile, setAudioFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!audioFile) {
            alert('Please select an audio file');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('playlistId', playlistId);
            formData.append('audioFile', audioFile);

            const res = await axios.post('/api/songs', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            onSongAdded(res.data);
            setAudioFile(null);
            document.getElementById('audioFileInput').value = '';
            alert(`Song added: ${res.data.title} by ${res.data.artist}`);
        } catch (err) {
            console.error(err);
            alert('Error adding song: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="card" style={{ marginTop: '2rem' }}>
            <h2>🎼 Add Song to Playlist</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                Upload an audio file - title, artist, and duration will be extracted automatically!
            </p>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>📁 Audio File (MP3, WAV, OGG, M4A)</label>
                    <input 
                        id="audioFileInput"
                        type="file" 
                        accept="audio/*"
                        onChange={(e) => setAudioFile(e.target.files[0])}
                        style={{ padding: '0.5rem' }}
                        required
                    />
                </div>
                <button type="submit" disabled={uploading}>
                    {uploading ? '⏳ Uploading...' : '✨ Add Song'}
                </button>
            </form>
        </div>
    );
};

const PlaylistDetails = ({ playlistId, onPlaylistDeleted }) => {
    const [playlist, setPlaylist] = useState(null);
    const [songs, setSongs] = useState([]);
    const [currentSong, setCurrentSong] = useState(null);

    const fetchDetails = async () => {
        if (!playlistId) return;
        try {
            const res = await axios.get(`/api/playlists/${playlistId}`);
            setPlaylist(res.data.playlist);
            setSongs(res.data.songs);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [playlistId]);

    const handleSongAdded = (newSong) => {
        setSongs([...songs, newSong]);
    };

    const playSong = (song) => {
        setCurrentSong(song);
    };

    const deleteSong = async (songId) => {
        if (!confirm('Are you sure you want to delete this song?')) return;
        try {
            await axios.delete(`/api/songs/${songId}`);
            setSongs(songs.filter(s => s._id !== songId));
            if (currentSong && currentSong._id === songId) {
                setCurrentSong(null);
            }
        } catch (err) {
            console.error(err);
            alert('Error deleting song');
        }
    };

    const deletePlaylist = async () => {
        if (!confirm(`Are you sure you want to delete "${playlist.name}" and all its songs?`)) return;
        try {
            await axios.delete(`/api/playlists/${playlistId}`);
            onPlaylistDeleted(playlistId);
        } catch (err) {
            console.error(err);
            alert('Error deleting playlist');
        }
    };

    if (!playlistId) {
        return (
            <div className="card empty-state">
                <p>Select a playlist to view details and add songs.</p>
            </div>
        );
    }

    if (!playlist) return <div className="card">Loading...</div>;

    return (
        <div>
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ marginBottom: 0 }}>{playlist.name}</h2>
                    <button 
                        onClick={deletePlaylist}
                        style={{ 
                            width: 'auto', 
                            padding: '0.5rem 1rem', 
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            fontSize: '0.9rem'
                        }}
                    >
                        🗑️ Delete Playlist
                    </button>
                </div>
                <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>👤 Created by {playlist.creator}</p>
                
                <div className="songs-container">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: '600' }}>🎶 Songs ({songs.length})</h3>
                    {songs.length === 0 ? (
                        <p style={{ color: '#64748b', fontStyle: 'italic', padding: '2rem', textAlign: 'center' }}>No songs yet. Upload your first track!</p>
                    ) : (
                        songs.map(song => (
                            <div 
                                key={song._id} 
                                className="song-item"
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <div 
                                    onClick={() => playSong(song)}
                                    style={{ cursor: 'pointer', flex: 1 }}
                                >
                                    <span className="song-title">🎵 {song.title}</span>
                                    <span className="song-artist" style={{ display: 'block', fontSize: '0.85rem', marginTop: '0.25rem' }}>👤 {song.artist}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span 
                                        onClick={() => playSong(song)}
                                        style={{ color: '#818cf8', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer' }}
                                    >
                                        ▶️ Play
                                    </span>
                                    <button
                                        onClick={() => deleteSong(song._id)}
                                        style={{
                                            width: 'auto',
                                            padding: '0.4rem 0.75rem',
                                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                            fontSize: '0.85rem',
                                            marginLeft: '0.5rem'
                                        }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {currentSong && <MusicPlayer song={currentSong} />}

            <SongForm playlistId={playlist._id} onSongAdded={handleSongAdded} />
        </div>
    );
};

const App = () => {
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);

    const fetchPlaylists = async () => {
        try {
             const res = await axios.get('/api/playlists'); 
             setPlaylists(res.data);
        } catch (err) {
            console.error("Could not fetch playlists", err);
        }
    };

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const handlePlaylistCreated = (newPlaylist) => {
        setPlaylists([newPlaylist, ...playlists]);
        setSelectedPlaylistId(newPlaylist._id);
    };

    const handlePlaylistDeleted = (deletedId) => {
        setPlaylists(playlists.filter(p => p._id !== deletedId));
        setSelectedPlaylistId(null);
    };

    return (
        <div className="container">
            <header>
                <h1>Music Playlist Creator</h1>
            </header>

            <div className="grid">
                {/* Left Column: Create & List */}
                <div>
                    <PlaylistForm onPlaylistCreated={handlePlaylistCreated} />
                    
                    <div className="card" style={{ marginTop: '2rem' }}>
                        <h2>📚 Your Playlists</h2>
                        {playlists.length === 0 && <p style={{ color: '#64748b', fontStyle: 'italic' }}>No playlists created yet.</p>}
                        <ul className="playlist-list">
                            {playlists.map(pl => (
                                <li 
                                    key={pl._id} 
                                    className={`playlist-item ${selectedPlaylistId === pl._id ? 'active' : ''}`}
                                    onClick={() => setSelectedPlaylistId(pl._id)}
                                >
                                    <div className="playlist-info">
                                        <h3>🎵 {pl.name}</h3>
                                        <p>👤 {pl.creator}</p>
                                    </div>
                                    {selectedPlaylistId === pl._id && <span style={{ fontSize: '1.25rem' }}>▶️</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Right Column: Details & Songs */}
                <div>
                    <PlaylistDetails playlistId={selectedPlaylistId} onPlaylistDeleted={handlePlaylistDeleted} />
                </div>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
