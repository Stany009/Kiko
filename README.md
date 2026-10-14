# Kiko - Kawaii Web Music Player

<p align="center">
  <strong>An ad-free, aesthetic music player with universal YouTube streaming, Supabase cloud sync, custom playlist curation, and a pastel kawaii UI.</strong>
</p>

---

## Features

- **Kawaii Aesthetic UI**: Soft pastel color themes (Strawberry Milk, Lavender Dream, Matcha Mint, Baby Blue, Honey Latte, Midnight Star), custom sticker badges, washi tape styling, and vinyl soundwave barcode.
- **Mandatory Authentication and Player Gating**: Custom split-screen auth modal (headphones and cassette bunny artwork) requiring login/signup before player usage.
- **Supabase Cloud Sync**: Real-time cloud persistence for user profiles, custom playlists, track order, and liked songs with Row Level Security (RLS).
- **Spotify-Style Playlist Experience**:
  - "Play All" tab button to instantly play active playlists from track 0.
  - Playlist hero header with large circular play button, track counter, and instant shuffle playback.
- **YouTube Music Search and Streaming**: Instant search dropdown with live scraping proxy and dual-engine playback (YouTube IFrame API + HTML5 Audio fallback).
- **Playlist Management**: One-click track addition to playlists with a quick-create modal.

---

## Architecture and Problem Solving

During development, several technical challenges were solved to achieve a seamless, ad-free web player experience:

### 1. Zero-Dependency YouTube Audio Scraping
- **Problem**: YouTube Data API v3 requires restrictive API quotas and billing accounts.
- **Solution**: Implemented a lightweight Node.js scraping proxy in `server.js` using native `fetch` and regex pattern matching on YouTube Initial Data, cached in-memory with TTL.

### 2. Player Gating without Breaking Audio Context
- **Problem**: Gating the player behind login could cause autoplay restrictions or broken state if audio initializes before authentication.
- **Solution**: Strictly gated audio playback routines (`play()`, `setTrack()`, and spacebar shortcut) so unauthenticated requests focus the auth modal, while keeping YouTube IFrame ready for immediate playback once logged in.

### 3. Secure Multi-User Cloud Synchronization
- **Problem**: Allowing users to store custom playlists and liked tracks without compromising data isolation.
- **Solution**: Designed a PostgreSQL schema with Supabase Row Level Security (RLS) policies enforcing `auth.uid() = user_id`, while securely injecting public client keys via `/api/config` without exposing raw `.env` contents to the browser bundle.

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- A free Supabase project (for cloud database and authentication)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Stany009/Kiko.git
   cd Kiko
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your Supabase project URL and anon key:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-public-key
   PORT=3000
   ```

3. **Set Up the Database:**
   Run the SQL statements from `supabase_schema.sql` in your Supabase SQL Editor to initialize `profiles`, `playlists`, `playlist_tracks`, and `liked_songs` with Row Level Security.

4. **Start the Application:**
   ```bash
   node server.js
   ```
   Open `http://localhost:3000` in your browser.

---

## Repository Structure

```
├── app.js               # Client playback engine, Supabase auth & UI logic
├── index.html           # Main semantic HTML structure & SVG artwork
├── style.css            # Kawaii design system, themes, animations & responsive rules
├── server.js            # Node HTTP server, YouTube search proxy & static file server
├── supabase_schema.sql  # Database schema and RLS policies
├── PROJECT_CONTEXT.md   # Architectural decisions and implementation notes
├── .env.example         # Template for environment variables
└── .gitignore           # Git ignore rules protecting secrets
```

---

## License
MIT License.

