// Spotify Universal Kawaii Web Player
// Inspired by Pastel Coquette / Aesthetic Widgets & Retro Cards
// Ad-Free, Dual Engine (YouTube Streaming + HTML5 Audio), Universal Music Search

// Inaudible silent audio loop used to maintain mobile OS background audio sessions
const SILENT_AUDIO_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

class KawaiiSpotify {
  constructor() {
    this.htmlAudio = document.getElementById('audio-engine');
    this.ytPlayer = null;
    this.isYtReady = false;

    // Track state
    this.activePlaylist = [];
    this.currentTrackIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 0; // 0: none, 1: repeat all, 2: repeat one
    this.isVideoMode = false;
    this.isMuted = false;
    this.volume = parseFloat(localStorage.getItem('spotify_volume') || '0.8');

    // Cached categories for 2-column view
    this.catalog = {
      trending: [],
      pop: [],
      chill: [],
      search: []
    };
    this.currentTab = 'trending';

    // User data
    this.likedTrackIds = new Set(JSON.parse(localStorage.getItem('spotify_liked_tracks') || '[]'));
    this.likedTracksMap = new Map(JSON.parse(localStorage.getItem('spotify_liked_objects') || '[]'));
    this.customPlaylists = JSON.parse(localStorage.getItem('spotify_user_playlists') || '[]');

    // Supabase & Cloud Auth State
    this.supabase = null;
    this.supabaseConfig = null;
    this.user = null;
    this.authMode = 'login';
    this.pendingAddTrack = null;
    this.viewingPlaylist = null;

    // Ticker for scrubber
    this.playbackInterval = null;

    this.initDOM();
    this.initThemes();
    this.initEventListeners();
    this.initMediaSession();
    this.initAuthAndPlaylistModals();
    this.initYouTubeAPI();
    this.loadInitialCatalog();
    this.updateLikedBadge();
    this.updatePlaylistsCountBadge();
    this.initSupabase();
  }

  initDOM() {
    // Top Bar & Search
    this.searchInput = document.getElementById('search-input');
    this.clearSearchBtn = document.getElementById('clear-search-btn');
    this.searchDropdown = document.getElementById('search-dropdown');
    this.searchWrapper = document.getElementById('search-wrapper');

    // Kawaii Player Widget Elements
    this.pbArt = document.getElementById('pb-art');
    this.pbTitle = document.getElementById('pb-title');
    this.pbArtist = document.getElementById('pb-artist');
    this.pbLike = document.getElementById('pb-like');
    this.btnPlay = document.getElementById('btn-play');
    this.playIcon = document.getElementById('play-icon');
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.btnShuffle = document.getElementById('btn-shuffle');
    this.btnRepeat = document.getElementById('btn-repeat');
    this.timeCurrent = document.getElementById('time-current');
    this.timeTotal = document.getElementById('time-total');
    this.seekContainer = document.getElementById('seek-container');
    this.seekFill = document.getElementById('seek-fill');
    this.seekHandle = document.getElementById('seek-handle');

    // Video Mode Toggle
    this.btnToggleVideo = document.getElementById('btn-toggle-video');
    this.ytPlayerContainer = document.getElementById('yt-player-container');

    // Volume & Local Upload
    this.btnMute = document.getElementById('btn-mute');
    this.volIcon = document.getElementById('vol-icon');
    this.volContainer = document.getElementById('volume-container');
    this.volFill = document.getElementById('volume-fill');
    this.volHandle = document.getElementById('volume-handle');

    // Mini Controls on Retro Suggest Card
    this.miniPrev = document.getElementById('mini-prev');
    this.miniRw = document.getElementById('mini-rw');
    this.miniPlay = document.getElementById('mini-play');
    this.miniFf = document.getElementById('mini-ff');
    this.miniHeart = document.getElementById('mini-heart');
    this.suggestHeading = document.getElementById('suggest-header-title');
    this.suggestSubtext = document.getElementById('suggest-header-sub');
    this.suggestCloudImg = document.getElementById('suggest-cloud-img');

    // 2-Column Song Grid & Tabs
    this.twoColSongsList = document.getElementById('two-column-songs-list');
    this.tabTrending = document.getElementById('tab-trending');
    this.tabPop = document.getElementById('tab-pop');
    this.tabChill = document.getElementById('tab-chill');
    this.tabLiked = document.getElementById('tab-liked');
    this.tabPlaylists = document.getElementById('tab-playlists');
    this.tabSearch = document.getElementById('tab-search');
    this.likedCountBadge = document.getElementById('liked-count-badge');
    this.userPlCount = document.getElementById('user-pl-count');
    this.btnPlayAllCurrent = document.getElementById('btn-play-all-current');

    // Supabase & Kiko Auth Modal Elements
    this.btnUserAuth = document.getElementById('btn-user-auth');
    this.authPillHeart = document.getElementById('auth-pill-heart');
    this.authPillText = document.getElementById('auth-pill-text');
    this.authModal = document.getElementById('auth-modal');
    this.authForm = document.getElementById('auth-form');
    this.authEmailInput = document.getElementById('auth-email');
    this.authPasswordInput = document.getElementById('auth-password');
    this.authStatusMsg = document.getElementById('auth-status-msg');
    this.authSubmitBtn = document.getElementById('auth-submit-btn');
    this.signupForm = document.getElementById('signup-form');
    this.signupNameInput = document.getElementById('signup-name');
    this.signupEmailInput = document.getElementById('signup-email');
    this.signupPasswordInput = document.getElementById('signup-password');
    this.signupConfirmPasswordInput = document.getElementById('signup-confirm-password');
    this.signupAgreeInput = document.getElementById('signup-agree');
    this.signupStatusMsg = document.getElementById('signup-status-msg');
    this.profileModal = document.getElementById('profile-modal');
    this.btnCloseProfileModal = document.getElementById('btn-close-profile-modal');
    this.userDisplayEmail = document.getElementById('user-display-email');
    this.btnSignout = document.getElementById('btn-signout');
    this.tabLogin = document.getElementById('tab-login');
    this.tabSignup = document.getElementById('tab-signup');

    // Playlists & Add Song Modals
    this.btnOpenCreatePlaylist = document.getElementById('btn-open-create-playlist');
    this.createPlaylistModal = document.getElementById('create-playlist-modal');
    this.btnClosePlaylistModal = document.getElementById('btn-close-playlist-modal');
    this.btnCancelCreatePlaylist = document.getElementById('btn-cancel-create-playlist');
    this.createPlaylistForm = document.getElementById('create-playlist-form');
    this.newPlNameInput = document.getElementById('new-pl-name');
    this.newPlDescInput = document.getElementById('new-pl-desc');
    this.plModalMsg = document.getElementById('pl-modal-msg');
    this.addToPlaylistModal = document.getElementById('add-to-playlist-modal');
    this.btnCloseAddModal = document.getElementById('btn-close-add-modal');
    this.playlistPickerList = document.getElementById('playlist-picker-list');
    this.addSongTargetTitle = document.getElementById('add-song-target-title');
    this.btnModalQuickNewPlaylist = document.getElementById('btn-modal-quick-new-playlist');

    // Plus (+) Buttons to add current song to playlist
    this.pbAddPl = document.getElementById('pb-add-pl');
    this.miniAddPl = document.getElementById('mini-add-pl');

    this.updateVolumeUI(this.volume);
  }

  initThemes() {
    const savedTheme = localStorage.getItem('kawaii_theme') || 'pink';
    document.documentElement.dataset.theme = savedTheme;

    const pills = document.querySelectorAll('.theme-pill');
    pills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.theme === savedTheme);
      pill.addEventListener('click', () => {
        const theme = pill.dataset.theme;
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('kawaii_theme', theme);
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      });
    });
  }

  initYouTubeAPI() {
    const setupPlayer = () => {
      this.ytPlayer = new YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            this.isYtReady = true;
            this.ytPlayer.setVolume(this.volume * 100);
          },
          onStateChange: (event) => {
            // YT.PlayerState.ENDED = 0, PLAYING = 1, PAUSED = 2
            if (event.data === 0) {
              this.onTrackEnded();
            } else if (event.data === 1) {
              this.isPlaying = true;
              this.updatePlayStateUI();
              this.startTicker();
            } else if (event.data === 2) {
              // If document is hidden (user on home screen or locked phone),
              // preserve playing state so MediaSession lockscreen controls remain active
              if (!document.hidden) {
                this.isPlaying = false;
                this.updatePlayStateUI();
                this.stopTicker();
              }
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      setupPlayer();
    } else {
      window.onYouTubeIframeAPIReady = setupPlayer;
    }
  }

  async loadInitialCatalog() {
    const netBadge = document.getElementById('net-badge');
    try {
      if (netBadge) netBadge.querySelector('span:last-child').textContent = 'LOADING...';
      const res = await fetch('/api/trending');
      const data = await res.json();

      if (data.hits && data.hits.length) {
        this.catalog.trending = data.hits;
        this.catalog.pop = data.pop || [];
        this.catalog.chill = data.chill || [];

        this.activePlaylist = [...data.hits];
        this.renderTwoColumnGrid(this.catalog.trending);
        this.setTrack(0, false, this.activePlaylist);

        if (netBadge) {
          netBadge.querySelector('span:last-child').textContent = 'UNLIMITED LIVE';
        }
      }
    } catch (e) {
      console.warn('Initial load notice, using fallback search:', e);
      this.searchFallback('top hits billboard');
    }
  }

  async searchFallback(query) {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.tracks && data.tracks.length) {
        this.catalog.trending = data.tracks;
        this.activePlaylist = data.tracks;
        this.renderTwoColumnGrid(data.tracks);
        this.setTrack(0, false, data.tracks);
      }
    } catch (err) {
      console.warn('Fallback search error:', err);
    }
  }

  initEventListeners() {
    // Playback Controls
    this.btnPlay.addEventListener('click', () => this.togglePlay());
    this.btnPrev.addEventListener('click', () => this.prevTrack());
    this.btnNext.addEventListener('click', () => this.nextTrack());
    this.btnShuffle.addEventListener('click', () => this.toggleShuffle());
    this.btnRepeat.addEventListener('click', () => this.toggleRepeat());
    this.pbLike.addEventListener('click', () => this.toggleLikeCurrent());
    if (this.btnPlayAllCurrent) {
      this.btnPlayAllCurrent.addEventListener('click', () => this.playCurrentTab());
    }

    // Mini controls on Retro Suggest Card (Image 2)
    if (this.miniPlay) this.miniPlay.addEventListener('click', () => this.togglePlay());
    if (this.miniPrev) this.miniPrev.addEventListener('click', () => this.prevTrack());
    if (this.miniFf) this.miniFf.addEventListener('click', () => this.nextTrack());
    if (this.miniRw) {
      this.miniRw.addEventListener('click', () => {
        const cur = this.getCurrentTrack();
        if (!cur) return;
        if (cur.type === 'youtube' && this.ytPlayer && this.isYtReady) {
          const t = Math.max(0, (this.ytPlayer.getCurrentTime() || 0) - 10);
          this.ytPlayer.seekTo(t, true);
        } else if (this.htmlAudio.currentTime) {
          this.htmlAudio.currentTime = Math.max(0, this.htmlAudio.currentTime - 10);
        }
      });
    }
    if (this.miniHeart) this.miniHeart.addEventListener('click', () => this.toggleLikeCurrent());

    // Toggle Video Mode inside the Kawaii Artwork Frame
    if (this.btnToggleVideo) {
      this.btnToggleVideo.addEventListener('click', () => {
        this.isVideoMode = !this.isVideoMode;
        this.ytPlayerContainer.classList.toggle('video-active', this.isVideoMode);
        this.btnToggleVideo.classList.toggle('active', this.isVideoMode);
      });
    }

    // Scrubber
    this.setupScrubber(this.seekContainer, (percent) => {
      const cur = this.getCurrentTrack();
      if (!cur) return;
      const targetSec = percent * (cur.durationSec || 210);

      if (cur.type === 'youtube' && this.ytPlayer && this.isYtReady) {
        this.ytPlayer.seekTo(targetSec, true);
      } else if (this.htmlAudio.duration) {
        this.htmlAudio.currentTime = percent * this.htmlAudio.duration;
      }
    });

    // Volume
    this.setupScrubber(this.volContainer, (percent) => {
      this.isMuted = false;
      this.volume = Math.max(0, Math.min(1, percent));
      localStorage.setItem('spotify_volume', this.volume);
      this.applyVolume(this.volume);
      this.updateVolumeUI(this.volume);
    });

    this.btnMute.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      const eff = this.isMuted ? 0 : this.volume;
      this.applyVolume(eff);
      this.updateVolumeUI(eff);
    });

    // Search bar with live YouTube Music style dropdown
    let debounceTimer = null;
    this.searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();
      this.clearSearchBtn.classList.toggle('visible', !!query);

      if (!query) {
        if (this.searchDropdown) this.searchDropdown.classList.remove('active');
        if (this.tabSearch) this.tabSearch.style.display = 'none';
        this.switchTab('trending');
        return;
      }

      debounceTimer = setTimeout(() => {
        if (this.searchDropdown) {
          this.searchDropdown.classList.add('active');
          this.searchDropdown.innerHTML = `<div class="search-drop-loading">Searching songs for "${query}"... ♡</div>`;
        }
        this.executeSearch(query);
      }, 350);
    });

    this.searchInput.addEventListener('focus', () => {
      if (this.catalog.search.length && this.searchInput.value.trim() && this.searchDropdown) {
        this.searchDropdown.classList.add('active');
      }
    });

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (this.catalog.search.length) {
          this.setTrack(0, true, this.catalog.search);
          if (this.searchDropdown) this.searchDropdown.classList.remove('active');
        }
      } else if (e.key === 'Escape') {
        if (this.searchDropdown) this.searchDropdown.classList.remove('active');
      }
    });

    document.addEventListener('click', (e) => {
      if (this.searchDropdown && !e.target.closest('#search-wrapper')) {
        this.searchDropdown.classList.remove('active');
      }
    });

    this.clearSearchBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.clearSearchBtn.classList.remove('visible');
      if (this.searchDropdown) this.searchDropdown.classList.remove('active');
      this.switchTab(this.currentTab === 'search' ? 'trending' : this.currentTab);
    });

    // Tabs for 2-column list
    const tabs = [
      { el: this.tabTrending, id: 'trending' },
      { el: this.tabPop, id: 'pop' },
      { el: this.tabChill, id: 'chill' },
      { el: this.tabLiked, id: 'liked' },
      { el: this.tabPlaylists, id: 'playlists' },
      { el: this.tabSearch, id: 'search' }
    ];

    tabs.forEach(({ el, id }) => {
      if (el) {
        el.addEventListener('click', () => this.switchTab(id));
      }
    });

    // Local files
    const fileUpload = document.getElementById('file-upload');
    if (fileUpload) {
      fileUpload.addEventListener('change', (e) => this.handleLocalFiles(e.target.files));
    }

    // HTML5 Audio events for local files
    this.htmlAudio.addEventListener('ended', () => this.onTrackEnded());
    this.htmlAudio.addEventListener('timeupdate', () => {
      const cur = this.getCurrentTrack();
      if (cur && cur.type !== 'youtube') {
        const current = this.htmlAudio.currentTime;
        const total = this.htmlAudio.duration || 1;
        this.updateScrubberUI(current, total);
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.code === 'ArrowRight' && e.ctrlKey) {
        this.nextTrack();
      } else if (e.code === 'ArrowLeft' && e.ctrlKey) {
        this.prevTrack();
      } else if (e.code === 'KeyM') {
        this.btnMute.click();
      }
    });

    // Background playback & mobile visibility management
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.isPlaying) {
          if (this.htmlAudio && this.htmlAudio.paused && this.htmlAudio.src === SILENT_AUDIO_WAV) {
            this.htmlAudio.play().catch(() => {});
          }
          if (this.ytPlayer && this.isYtReady && typeof this.ytPlayer.playVideo === 'function') {
            setTimeout(() => {
              if (this.isPlaying) {
                try { this.ytPlayer.playVideo(); } catch (_) {}
              }
            }, 100);
          }
        }
      } else {
        if (this.isPlaying && this.ytPlayer && this.isYtReady && typeof this.ytPlayer.playVideo === 'function') {
          try { this.ytPlayer.playVideo(); } catch (_) {}
        }
      }
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.pl-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    if (tabId === 'trending') {
      this.renderTwoColumnGrid(this.catalog.trending);
    } else if (tabId === 'pop') {
      this.renderTwoColumnGrid(this.catalog.pop);
    } else if (tabId === 'chill') {
      this.renderTwoColumnGrid(this.catalog.chill);
    } else if (tabId === 'liked') {
      const likedList = Array.from(this.likedTracksMap.values());
      this.renderTwoColumnGrid(likedList);
    } else if (tabId === 'playlists') {
      this.renderPlaylistsGrid();
    } else if (tabId === 'search') {
      this.renderTwoColumnGrid(this.catalog.search);
    }
  }

  async executeSearch(query) {
    if (!query) {
      if (this.searchDropdown) this.searchDropdown.classList.remove('active');
      if (this.tabSearch) this.tabSearch.style.display = 'none';
      this.switchTab('trending');
      return;
    }

    if (this.tabSearch) {
      this.tabSearch.style.display = 'inline-block';
      this.tabSearch.textContent = `Search: "${query.slice(0, 10)}"`;
    }
    this.switchTab('search');
    this.twoColSongsList.innerHTML = `<div class="loading-state">Searching catalog for "${query}"... ♡</div>`;

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!data.tracks || !data.tracks.length) {
        this.twoColSongsList.innerHTML = `<div class="loading-state">No songs found for "${query}". Try another title! ♡</div>`;
        if (this.searchDropdown) {
          this.searchDropdown.innerHTML = `<div class="search-drop-empty">No results found for "${query}" ♡</div>`;
        }
        return;
      }

      this.catalog.search = data.tracks;
      this.renderSearchDropdown(data.tracks);
      this.renderTwoColumnGrid(data.tracks);
    } catch (err) {
      this.twoColSongsList.innerHTML = `<div class="loading-state">Search service offline. Check local server.</div>`;
      if (this.searchDropdown) {
        this.searchDropdown.innerHTML = `<div class="search-drop-empty">Search service error. Check local server.</div>`;
      }
    }
  }

  // Live YouTube Music style instant search dropdown
  renderSearchDropdown(tracks) {
    if (!this.searchDropdown) return;
    this.searchDropdown.innerHTML = '';
    this.searchDropdown.classList.add('active');

    if (!tracks || !tracks.length) {
      this.searchDropdown.innerHTML = '<div class="search-drop-empty">No matching songs found ♡</div>';
      return;
    }

    tracks.slice(0, 6).forEach((track, idx) => {
      const item = document.createElement('div');
      item.className = 'search-drop-item';
      item.innerHTML = `
        <img src="${track.cover}" class="search-drop-thumb" alt="${track.title}" loading="lazy">
        <div class="search-drop-info">
          <span class="search-drop-title" title="${track.title}">${track.title}</span>
          <span class="search-drop-artist" title="${track.artist}">${track.artist} • ${track.duration || '3:30'}</span>
        </div>
        <button class="search-drop-play" title="Play Now">▷</button>
      `;

      item.addEventListener('click', () => {
        if (this.searchInput) this.searchInput.blur();
        this.setTrack(idx, true, tracks);
        this.searchDropdown.classList.remove('active');
        this.searchInput.value = track.title;

        // Smoothly scroll to player card on mobile so user sees the track immediately
        const playerCard = document.querySelector('.kawaii-spotify-card');
        if (playerCard && window.innerWidth <= 768) {
          playerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      this.searchDropdown.appendChild(item);
    });
  }

  // Renders the 2-Column Song Grid (Image 2 style)
  renderTwoColumnGrid(tracks) {
    if (!this.twoColSongsList) return;
    this.twoColSongsList.innerHTML = '';

    if (!tracks || !tracks.length) {
      this.twoColSongsList.innerHTML = `<div class="loading-state">No songs in this list yet ♡</div>`;
      return;
    }

    const cur = this.getCurrentTrack();

    tracks.forEach((track, idx) => {
      const isCurrent = cur && cur.id === track.id;
      const isLiked = this.likedTrackIds.has(track.id);

      const item = document.createElement('div');
      item.className = `cute-song-item ${isCurrent ? 'active' : ''}`;
      item.dataset.trackId = track.id;
      item.innerHTML = `
        <img src="${track.cover}" class="song-item-thumb" alt="${track.title}" loading="lazy">
        <div class="song-item-meta">
          <span class="song-item-label" title="${track.title}"><strong>Song:</strong> ${track.title}</span>
          <span class="artist-item-label" title="${track.artist}"><strong>Artist:</strong> ${track.artist}</span>
        </div>
        <div class="song-item-actions">
          <button class="song-item-add-pl" title="Add to Playlist">➕</button>
          <button class="song-item-heart ${isLiked ? 'liked' : ''}" title="${isLiked ? 'Unlike' : 'Like'}">
            ${isLiked ? '♥' : '♡'}
          </button>
        </div>
      `;

      // Click to play or action
      item.addEventListener('click', (e) => {
        if (e.target.closest('.song-item-add-pl')) {
          e.stopPropagation();
          this.openAddToPlaylistModal(track);
          return;
        }
        if (e.target.closest('.song-item-heart')) {
          e.stopPropagation();
          this.toggleLikeTrack(track);
          return;
        }
        this.setTrack(idx, true, tracks);
      });

      this.twoColSongsList.appendChild(item);
    });
  }

  getCurrentTrack() {
    return this.activePlaylist[this.currentTrackIndex] || null;
  }

  setTrack(index, autoPlay = true, playlistContext = null) {
    if (autoPlay && !this.user) {
      this.openAuthModal();
      return;
    }

    if (playlistContext) {
      this.activePlaylist = playlistContext;
    }
    if (index < 0 || index >= this.activePlaylist.length) return;

    this.currentTrackIndex = index;
    const track = this.activePlaylist[index];

    // Update Kawaii Kiko Card UI
    this.pbArt.src = track.cover;
    this.pbTitle.textContent = track.title;
    this.pbArtist.textContent = track.artist;
    this.timeTotal.textContent = track.duration || "3:45";

    // Update Retro Suggestion Card UI
    if (this.suggestHeading) this.suggestHeading.textContent = track.title;
    if (this.suggestSubtext) this.suggestSubtext.textContent = track.artist;
    if (this.suggestCloudImg) this.suggestCloudImg.src = track.cover;

    const isLiked = this.likedTrackIds.has(track.id);
    this.pbLike.classList.toggle('liked', isLiked);
    if (this.miniHeart) this.miniHeart.textContent = isLiked ? '♥' : '♡';

    this.updateActiveGridItems();
    this.updateMediaSession(track);

    // Audio stream dispatch
    if (track.type === 'youtube') {
      if (this.htmlAudio) {
        if (this.htmlAudio.src !== SILENT_AUDIO_WAV) {
          this.htmlAudio.src = SILENT_AUDIO_WAV;
          this.htmlAudio.loop = true;
        }
        if (autoPlay) {
          this.htmlAudio.play().catch(() => {});
        }
      }
      if (this.ytPlayer && this.isYtReady) {
        if (autoPlay) {
          this.ytPlayer.loadVideoById(track.youtubeId);
          this.isPlaying = true;
          this.updatePlayStateUI();
        } else {
          this.ytPlayer.cueVideoById(track.youtubeId);
        }
      }
    } else {
      // Local audio file
      if (this.ytPlayer && this.isYtReady) {
        this.ytPlayer.pauseVideo();
      }
      this.htmlAudio.loop = false;
      this.htmlAudio.src = track.src;
      if (autoPlay) {
        this.htmlAudio.play().then(() => {
          this.isPlaying = true;
          this.updatePlayStateUI();
        }).catch(() => {});
      }
    }
  }

  play() {
    if (!this.user) {
      this.openAuthModal();
      return;
    }
    const cur = this.getCurrentTrack();
    if (!cur) return;
    if (cur.type === 'youtube' && this.ytPlayer && this.isYtReady) {
      this.ytPlayer.playVideo();
      if (this.htmlAudio) {
        if (this.htmlAudio.src !== SILENT_AUDIO_WAV) {
          this.htmlAudio.src = SILENT_AUDIO_WAV;
          this.htmlAudio.loop = true;
        }
        this.htmlAudio.play().catch(() => {});
      }
    } else {
      this.htmlAudio.play().catch(() => {});
    }
    this.isPlaying = true;
    this.updatePlayStateUI();
  }

  pause() {
    const cur = this.getCurrentTrack();
    if (cur && cur.type === 'youtube' && this.ytPlayer && this.isYtReady) {
      this.ytPlayer.pauseVideo();
      if (this.htmlAudio && this.htmlAudio.src === SILENT_AUDIO_WAV) {
        this.htmlAudio.pause();
      }
    } else {
      this.htmlAudio.pause();
    }
    this.isPlaying = false;
    this.updatePlayStateUI();
  }

  togglePlay() {
    if (!this.user) {
      this.openAuthModal();
      return;
    }
    if (this.isPlaying) this.pause();
    else this.play();
  }

  playCurrentTab() {
    if (!this.user) {
      this.openAuthModal();
      return;
    }

    let tracks = [];
    if (this.currentTab === 'trending') tracks = this.catalog.trending;
    else if (this.currentTab === 'pop') tracks = this.catalog.pop;
    else if (this.currentTab === 'chill') tracks = this.catalog.chill;
    else if (this.currentTab === 'liked') tracks = Array.from(this.likedTracksMap.values());
    else if (this.currentTab === 'search') tracks = this.catalog.search;
    else if (this.currentTab === 'playlists') {
      if (this.customPlaylists.length && this.customPlaylists[0].tracks?.length) {
        tracks = this.customPlaylists[0].tracks;
      }
    }

    if (!tracks || !tracks.length) {
      alert('This playlist is currently empty! Add songs to start listening ♡');
      return;
    }

    if (this.activePlaylist === tracks && this.isPlaying) {
      this.pause();
    } else {
      this.setTrack(0, true, tracks);
    }
  }

  updatePlayStateUI() {
    document.body.classList.toggle('is-playing', this.isPlaying);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    }

    if (this.isPlaying) {
      this.playIcon.innerHTML = `<path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7H5.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7h-2.6z"/>`;
      this.btnPlay.title = "Pause";
      if (this.miniPlay) this.miniPlay.textContent = "❚❚";
      if (this.btnPlayAllCurrent) {
        this.btnPlayAllCurrent.classList.add('playing');
        this.btnPlayAllCurrent.innerHTML = '❚❚ Pause';
      }
    } else {
      this.playIcon.innerHTML = `<path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"/>`;
      this.btnPlay.title = "Play";
      if (this.miniPlay) this.miniPlay.textContent = "▷";
      if (this.btnPlayAllCurrent) {
        this.btnPlayAllCurrent.classList.remove('playing');
        this.btnPlayAllCurrent.innerHTML = '▶ Play All';
      }
    }
  }

  nextTrack() {
    if (this.isShuffle) {
      let rand = Math.floor(Math.random() * this.activePlaylist.length);
      if (rand === this.currentTrackIndex && this.activePlaylist.length > 1) {
        rand = (rand + 1) % this.activePlaylist.length;
      }
      this.setTrack(rand, true);
    } else {
      const next = (this.currentTrackIndex + 1) % this.activePlaylist.length;
      this.setTrack(next, true);
    }
  }

  prevTrack() {
    const prev = (this.currentTrackIndex - 1 + this.activePlaylist.length) % this.activePlaylist.length;
    this.setTrack(prev, true);
  }

  initMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        const cur = this.getCurrentTrack();
        if (!cur) return;
        if (details.seekTime != null) {
          if (cur.type === 'youtube' && this.ytPlayer && this.isYtReady) {
            this.ytPlayer.seekTo(details.seekTime, true);
          } else if (this.htmlAudio) {
            this.htmlAudio.currentTime = details.seekTime;
          }
        }
      });
    } catch (e) {
      console.warn('MediaSession init notice:', e);
    }
  }

  updateMediaSession(track) {
    if (!('mediaSession' in navigator) || !track) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Kiko Music',
        artist: track.artist || 'Unknown Artist',
        album: 'Kiko Player',
        artwork: [
          { src: track.cover || '', sizes: '512x512', type: 'image/jpeg' }
        ]
      });
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    } catch (e) {
      console.warn('MediaSession update notice:', e);
    }
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this.btnShuffle.classList.toggle('active', this.isShuffle);
  }

  toggleRepeat() {
    this.repeatMode = (this.repeatMode + 1) % 3;
    this.btnRepeat.classList.toggle('active', this.repeatMode > 0);
  }

  onTrackEnded() {
    if (this.repeatMode === 2) {
      this.setTrack(this.currentTrackIndex, true);
    } else if (this.repeatMode === 1 || this.currentTrackIndex < this.activePlaylist.length - 1 || this.isShuffle) {
      this.nextTrack();
    } else {
      this.pause();
    }
  }

  startTicker() {
    this.stopTicker();
    this.playbackInterval = setInterval(() => {
      const cur = this.getCurrentTrack();
      if (!cur) return;
      if (cur.type === 'youtube' && this.ytPlayer && this.isYtReady && typeof this.ytPlayer.getCurrentTime === 'function') {
        const current = this.ytPlayer.getCurrentTime() || 0;
        const total = this.ytPlayer.getDuration() || cur.durationSec || 1;
        this.updateScrubberUI(current, total);
      }
    }, 400);
  }

  stopTicker() {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
  }

  updateScrubberUI(current, total) {
    const percent = Math.min(100, Math.max(0, (current / total) * 100));
    this.seekFill.style.width = `${percent}%`;
    this.seekHandle.style.left = `${percent}%`;
    this.timeCurrent.textContent = this.formatTime(current);
  }

  setupScrubber(container, onSeek) {
    let isDragging = false;
    const calculate = (clientX) => {
      const rect = container.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(pos);
    };

    // Mouse events
    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      calculate(e.clientX);
      const onMove = (ev) => { if (isDragging) calculate(ev.clientX); };
      const onUp = () => {
        isDragging = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    // Touch events for mobile screens
    container.addEventListener('touchstart', (e) => {
      if (!e.touches.length) return;
      isDragging = true;
      calculate(e.touches[0].clientX);
      const onTouchMove = (ev) => {
        if (isDragging && ev.touches.length) {
          ev.preventDefault();
          calculate(ev.touches[0].clientX);
        }
      };
      const onTouchEnd = () => {
        isDragging = false;
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
      };
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
    }, { passive: true });
  }

  applyVolume(vol) {
    if (this.htmlAudio) this.htmlAudio.volume = vol;
    if (this.ytPlayer && this.isYtReady && typeof this.ytPlayer.setVolume === 'function') {
      this.ytPlayer.setVolume(vol * 100);
      if (vol === 0) this.ytPlayer.mute();
      else this.ytPlayer.unMute();
    }
  }

  updateVolumeUI(vol) {
    const percent = vol * 100;
    this.volFill.style.width = `${percent}%`;
    this.volHandle.style.left = `${percent}%`;
    if (vol === 0) {
      this.volIcon.innerHTML = `<path d="M3 9v6h4l5 5V4L7 9H3zm13.59 3l3.71-3.71-1.41-1.41L15.17 10.59 11.46 6.88l-1.41 1.41L13.76 12l-3.71 3.71 1.41 1.41 3.71-3.71 3.71 3.71 1.41-1.41z"/>`;
    } else {
      this.volIcon.innerHTML = `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>`;
    }
  }

  toggleLikeCurrent() {
    const cur = this.getCurrentTrack();
    if (!cur) return;
    this.toggleLikeTrack(cur);
  }

  toggleLikeTrack(track) {
    if (this.likedTrackIds.has(track.id)) {
      this.likedTrackIds.delete(track.id);
      this.likedTracksMap.delete(track.id);
    } else {
      this.likedTrackIds.add(track.id);
      this.likedTracksMap.set(track.id, track);
    }

    localStorage.setItem('spotify_liked_tracks', JSON.stringify([...this.likedTrackIds]));
    localStorage.setItem('spotify_liked_objects', JSON.stringify([...this.likedTracksMap.entries()]));

    const isLiked = this.likedTrackIds.has(track.id);
    const cur = this.getCurrentTrack();
    if (cur && cur.id === track.id) {
      this.pbLike.classList.toggle('liked', isLiked);
      if (this.miniHeart) this.miniHeart.textContent = isLiked ? '♥' : '♡';
    }

    // Cloud sync with Supabase if logged in
    if (this.supabase && this.user) {
      if (isLiked) {
        this.supabase.from('liked_songs').upsert({
          user_id: this.user.id,
          track_id: track.id,
          track_data: track
        }).then(({ error }) => {
          if (error) console.warn('Supabase like error:', error.message);
        });
      } else {
        this.supabase.from('liked_songs').delete().match({
          user_id: this.user.id,
          track_id: track.id
        }).then(({ error }) => {
          if (error) console.warn('Supabase unlike error:', error.message);
        });
      }
    }

    this.updateLikedBadge();
    this.updateActiveGridItems();

    if (this.currentTab === 'liked') {
      this.renderTwoColumnGrid(Array.from(this.likedTracksMap.values()));
    }
  }

  updateLikedBadge() {
    if (this.likedCountBadge) {
      this.likedCountBadge.textContent = this.likedTrackIds.size;
    }
  }

  updateActiveGridItems() {
    const cur = this.getCurrentTrack();
    if (!cur) return;
    document.querySelectorAll('.cute-song-item').forEach(item => {
      const id = item.dataset.trackId;
      item.classList.toggle('active', id === cur.id);
      const heartBtn = item.querySelector('.song-item-heart');
      if (heartBtn) {
        const liked = this.likedTrackIds.has(id);
        heartBtn.classList.toggle('liked', liked);
        heartBtn.textContent = liked ? '♥' : '♡';
      }
    });
  }

  formatTime(secs) {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  handleLocalFiles(files) {
    if (!files || !files.length) return;
    const added = [];

    Array.from(files).forEach((file, i) => {
      const url = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      const newTrack = {
        id: `local-${Date.now()}-${i}`,
        title: cleanName,
        artist: "Local Device File",
        album: "Local Music",
        duration: "3:00",
        durationSec: 180,
        cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=480",
        src: url,
        type: 'local'
      };
      added.push(newTrack);
    });

    this.activePlaylist = [...added, ...this.activePlaylist];
    this.catalog.trending = [...added, ...this.catalog.trending];
    this.renderTwoColumnGrid(this.activePlaylist);
    this.setTrack(0, true, this.activePlaylist);
  }

  // ========================================================
  // SUPABASE CLIENT & AUTH
  // ========================================================

  async initSupabase() {
    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      this.supabaseConfig = config;

      if (config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
        const cleanUrl = config.supabaseUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
        this.supabase = window.supabase.createClient(cleanUrl, config.supabaseAnonKey.trim());

        // Listen for Auth changes
        this.supabase.auth.onAuthStateChange((event, session) => {
          this.handleAuthState(session);
        });

        // Check active session
        const { data: { session } } = await this.supabase.auth.getSession();
        this.handleAuthState(session);
      } else {
        console.info('Supabase: Running in local offline storage mode (add keys in .env for cloud sync).');
      }

      // Automatically show signup screen on website load if not logged in
      if (!this.user) {
        setTimeout(() => {
          if (!this.user) {
            this.setAuthMode('signup');
            this.openAuthModal();
          }
        }, 400);
      }
    } catch (err) {
      console.warn('Could not initialize Supabase:', err.message);
    }
  }

  handleAuthState(session) {
    this.user = session?.user || null;

    if (this.user) {
      if (this.btnUserAuth) {
        this.btnUserAuth.classList.add('logged-in');
        if (this.authPillHeart) this.authPillHeart.textContent = '♥';
        const name = this.user.user_metadata?.full_name;
        const display = name ? name.split(' ')[0] : (this.user.email ? this.user.email.split('@')[0] : 'Profile');
        if (this.authPillText) this.authPillText.textContent = display;
      }
      if (this.userDisplayEmail) this.userDisplayEmail.textContent = this.user.email || 'user';
      this.closeAuthModal();
      this.syncSupabaseData();
    } else {
      if (this.btnUserAuth) {
        this.btnUserAuth.classList.remove('logged-in');
        if (this.authPillHeart) this.authPillHeart.textContent = '♡';
        if (this.authPillText) this.authPillText.textContent = 'Login';
      }
      this.pause();
      this.openAuthModal();
    }
  }

  async syncSupabaseData() {
    if (!this.supabase || !this.user) return;

    try {
      // 1. Fetch liked songs
      const { data: likedData, error: likedErr } = await this.supabase
        .from('liked_songs')
        .select('*');

      if (!likedErr && likedData) {
        likedData.forEach(item => {
          this.likedTrackIds.add(item.track_id);
          if (item.track_data) {
            this.likedTracksMap.set(item.track_id, item.track_data);
          }
        });
        localStorage.setItem('spotify_liked_tracks', JSON.stringify([...this.likedTrackIds]));
        localStorage.setItem('spotify_liked_objects', JSON.stringify([...this.likedTracksMap.entries()]));
        this.updateLikedBadge();
        this.updateActiveGridItems();
      }

      // 2. Fetch playlists
      const { data: plData, error: plErr } = await this.supabase
        .from('playlists')
        .select('*, playlist_tracks(*)')
        .order('created_at', { ascending: false });

      if (!plErr && plData) {
        this.customPlaylists = plData.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          cover: p.cover_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=320',
          tracks: (p.playlist_tracks || []).map(pt => pt.track_data).filter(Boolean)
        }));
        localStorage.setItem('spotify_user_playlists', JSON.stringify(this.customPlaylists));
        this.updatePlaylistsCountBadge();

        if (this.currentTab === 'playlists') {
          this.renderPlaylistsGrid();
        }
      }
    } catch (err) {
      console.warn('Sync error with Supabase:', err.message);
    }
  }

  initAuthAndPlaylistModals() {
    // Auth Modal & User Profile Button
    if (this.btnUserAuth) {
      this.btnUserAuth.addEventListener('click', () => {
        if (this.user) {
          this.openProfileModal();
        } else {
          this.openAuthModal();
        }
      });
    }

    if (this.btnCloseProfileModal) {
      this.btnCloseProfileModal.addEventListener('click', () => this.closeProfileModal());
    }

    if (this.tabLogin) {
      this.tabLogin.addEventListener('click', () => this.setAuthMode('login'));
    }
    if (this.tabSignup) {
      this.tabSignup.addEventListener('click', () => this.setAuthMode('signup'));
    }
    if (this.authForm) {
      this.authForm.addEventListener('submit', (e) => this.handleAuthSubmit(e));
    }
    if (this.signupForm) {
      this.signupForm.addEventListener('submit', (e) => this.handleSignupSubmit(e));
    }
    if (this.btnSignout) {
      this.btnSignout.addEventListener('click', () => this.handleSignOut());
    }

    // Toggle password visibility (eye icons)
    document.querySelectorAll('.kiko-eye-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        const isPw = input.type === 'password';
        input.type = isPw ? 'text' : 'password';
        btn.style.opacity = isPw ? '1' : '0.6';
      });
    });

    // Google Sign-in Buttons
    const handleGoogleAuth = async () => {
      if (!this.supabase) {
        alert('Supabase is not configured yet! Please check .env credentials.');
        return;
      }
      try {
        const { error } = await this.supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin }
        });
        if (error) alert(error.message);
      } catch (err) {
        alert(err.message);
      }
    };
    document.getElementById('btn-google-login')?.addEventListener('click', handleGoogleAuth);
    document.getElementById('btn-google-signup')?.addEventListener('click', handleGoogleAuth);
    document.getElementById('link-forgot-pw')?.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Password reset link can be sent to your email via Supabase Auth settings ♡');
    });

    // Create Playlist Modal
    if (this.btnOpenCreatePlaylist) {
      this.btnOpenCreatePlaylist.addEventListener('click', () => this.openCreatePlaylistModal());
    }
    if (this.btnClosePlaylistModal) {
      this.btnClosePlaylistModal.addEventListener('click', () => this.closeCreatePlaylistModal());
    }
    if (this.btnCancelCreatePlaylist) {
      this.btnCancelCreatePlaylist.addEventListener('click', () => this.closeCreatePlaylistModal());
    }
    if (this.createPlaylistForm) {
      this.createPlaylistForm.addEventListener('submit', (e) => this.handleCreatePlaylistSubmit(e));
    }

    // Add To Playlist Modal
    if (this.btnCloseAddModal) {
      this.btnCloseAddModal.addEventListener('click', () => this.closeAddToPlaylistModal());
    }

    // Plus (+) button on main player card
    if (this.pbAddPl) {
      this.pbAddPl.addEventListener('click', () => {
        const cur = this.getCurrentTrack();
        if (cur) this.openAddToPlaylistModal(cur);
      });
    }

    // Plus (+) button on top suggest mini player
    if (this.miniAddPl) {
      this.miniAddPl.addEventListener('click', () => {
        const cur = this.getCurrentTrack();
        if (cur) this.openAddToPlaylistModal(cur);
      });
    }

    // Quick "+ Create New Playlist ♡" button inside Add to Playlist picker modal
    if (this.btnModalQuickNewPlaylist) {
      this.btnModalQuickNewPlaylist.addEventListener('click', () => {
        this.closeAddToPlaylistModal();
        this.openCreatePlaylistModal();
      });
    }

    // Backdrop click to close modals (auth gating overlay is NEVER closed if !this.user)
    [this.profileModal, this.createPlaylistModal, this.addToPlaylistModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.style.display = 'none';
          }
        });
      }
    });

    // Close on Escape key (auth gating overlay is NEVER closed if !this.user)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.user && this.authModal) this.authModal.style.display = 'none';
        if (this.profileModal) this.profileModal.style.display = 'none';
        if (this.createPlaylistModal) this.createPlaylistModal.style.display = 'none';
        if (this.addToPlaylistModal) this.addToPlaylistModal.style.display = 'none';
      }
    });
  }

  openAuthModal() {
    if (!this.authModal) return;
    this.authModal.style.display = 'flex';
  }

  closeAuthModal() {
    // Required gating: cannot close without authenticated session!
    if (!this.user) return;
    if (this.authModal) this.authModal.style.display = 'none';
  }

  openProfileModal() {
    if (this.profileModal) this.profileModal.style.display = 'flex';
  }

  closeProfileModal() {
    if (this.profileModal) this.profileModal.style.display = 'none';
  }

  setAuthMode(mode) {
    this.authMode = mode;
    const loginBox = document.getElementById('kiko-login-box');
    const signupBox = document.getElementById('kiko-signup-box');
    const artLogin = document.getElementById('kiko-art-login');
    const artReg = document.getElementById('kiko-art-register');

    if (mode === 'signup') {
      if (loginBox) loginBox.style.display = 'none';
      if (signupBox) signupBox.style.display = 'block';
      if (artLogin) artLogin.style.display = 'none';
      if (artReg) artReg.style.display = 'block';
    } else {
      if (loginBox) loginBox.style.display = 'block';
      if (signupBox) signupBox.style.display = 'none';
      if (artLogin) artLogin.style.display = 'block';
      if (artReg) artReg.style.display = 'none';
    }

    if (this.authStatusMsg) {
      this.authStatusMsg.textContent = '';
      this.authStatusMsg.className = 'auth-status-msg';
    }
    if (this.signupStatusMsg) {
      this.signupStatusMsg.textContent = '';
      this.signupStatusMsg.className = 'auth-status-msg';
    }
  }

  showAuthStatus(msg, type = 'error', isSignup = false) {
    const el = isSignup ? this.signupStatusMsg : this.authStatusMsg;
    if (!el) return;
    el.textContent = msg;
    el.className = `auth-status-msg ${type}`;
  }

  async handleAuthSubmit(e) {
    e.preventDefault();
    const email = this.authEmailInput?.value.trim();
    const password = this.authPasswordInput?.value.trim();

    if (!email || !password) {
      this.showAuthStatus('Please enter email and password ♡', 'error', false);
      return;
    }

    if (!this.supabase) {
      this.showAuthStatus('Supabase keys not yet configured in .env! Add SUPABASE_URL & SUPABASE_ANON_KEY to .env.', 'error', false);
      return;
    }

    this.showAuthStatus('Connecting to Kiko Cloud... ♡', 'success', false);

    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) {
        this.showAuthStatus(error.message, 'error', false);
      } else {
        this.showAuthStatus('Welcome back to Kiko! ♡', 'success', false);
        this.handleAuthState(data.session);
        setTimeout(() => this.closeAuthModal(), 600);
      }
    } catch (err) {
      this.showAuthStatus(err.message, 'error', false);
    }
  }

  async handleSignupSubmit(e) {
    e.preventDefault();
    const name = this.signupNameInput?.value.trim();
    const email = this.signupEmailInput?.value.trim();
    const password = this.signupPasswordInput?.value.trim();
    const confirmPassword = this.signupConfirmPasswordInput?.value.trim();
    const agree = this.signupAgreeInput?.checked;

    if (!agree) {
      this.showAuthStatus('Please agree to the Terms of Service to continue ♡', 'error', true);
      return;
    }

    if (!email || !password) {
      this.showAuthStatus('Please fill in all required fields ♡', 'error', true);
      return;
    }

    if (password !== confirmPassword) {
      this.showAuthStatus('Passwords do not match! Please check again ♡', 'error', true);
      return;
    }

    if (!this.supabase) {
      this.showAuthStatus('Supabase keys not yet configured in .env!', 'error', true);
      return;
    }

    this.showAuthStatus('Creating your Kiko space... ♡', 'success', true);

    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name || '' }
        }
      });

      if (error) {
        this.showAuthStatus(error.message, 'error', true);
      } else {
        if (data && data.session) {
          this.showAuthStatus('Account created! Welcome to Kiko ♡', 'success', true);
          this.handleAuthState(data.session);
          setTimeout(() => this.closeAuthModal(), 800);
        } else {
          this.showAuthStatus('Account created! Welcome to Kiko ♡ (Logging in...)', 'success', true);
          setTimeout(() => {
            if (data.user) this.handleAuthState({ user: data.user });
            this.closeAuthModal();
          }, 1000);
        }
      }
    } catch (err) {
      this.showAuthStatus(err.message, 'error', true);
    }
  }

  async handleSignOut() {
    this.pause();
    if (this.supabase) {
      await this.supabase.auth.signOut();
    }
    this.handleAuthState(null);
    this.closeProfileModal();
    this.setAuthMode('login');
    this.openAuthModal();
  }

  // ========================================================
  // PLAYLIST MANAGEMENT
  // ========================================================

  openCreatePlaylistModal() {
    if (!this.createPlaylistModal) return;
    this.createPlaylistModal.style.display = 'flex';
    if (this.newPlNameInput) this.newPlNameInput.value = '';
    if (this.newPlDescInput) this.newPlDescInput.value = '';
    if (this.plModalMsg) {
      this.plModalMsg.textContent = '';
      this.plModalMsg.className = 'auth-status-msg';
    }
    setTimeout(() => this.newPlNameInput?.focus(), 100);
  }

  closeCreatePlaylistModal() {
    if (this.createPlaylistModal) this.createPlaylistModal.style.display = 'none';
  }

  async handleCreatePlaylistSubmit(e) {
    e.preventDefault();
    const name = this.newPlNameInput?.value.trim();
    const desc = this.newPlDescInput?.value.trim();

    if (!name) return;

    const defaultCovers = [
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=320',
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=320',
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=320',
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=320'
    ];
    const cover = defaultCovers[Math.floor(Math.random() * defaultCovers.length)];

    let newPl = {
      id: `pl-${Date.now()}`,
      title: name,
      description: desc,
      cover: cover,
      tracks: this.pendingAddTrack ? [this.pendingAddTrack] : []
    };

    // If Supabase is connected & user logged in, save to Supabase
    if (this.supabase && this.user) {
      try {
        const { data, error } = await this.supabase.from('playlists').insert([{
          user_id: this.user.id,
          title: name,
          description: desc,
          cover_url: cover
        }]).select().single();

        if (!error && data) {
          newPl.id = data.id;
          if (this.pendingAddTrack) {
            await this.supabase.from('playlist_tracks').insert([{
              playlist_id: data.id,
              track_id: this.pendingAddTrack.id,
              track_data: this.pendingAddTrack,
              position: 0
            }]);
          }
        }
      } catch (err) {
        console.warn('Could not insert playlist to Supabase:', err.message);
      }
    }

    this.pendingAddTrack = null;
    this.customPlaylists.unshift(newPl);
    localStorage.setItem('spotify_user_playlists', JSON.stringify(this.customPlaylists));
    this.updatePlaylistsCountBadge();
    this.closeCreatePlaylistModal();
    this.switchTab('playlists');
  }

  async deletePlaylist(id, e) {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this lovely playlist? ♡')) return;

    if (this.supabase && this.user) {
      try {
        await this.supabase.from('playlists').delete().eq('id', id);
      } catch (err) {
        console.warn('Error deleting playlist from Supabase:', err.message);
      }
    }

    this.customPlaylists = this.customPlaylists.filter(p => p.id !== id);
    localStorage.setItem('spotify_user_playlists', JSON.stringify(this.customPlaylists));
    this.updatePlaylistsCountBadge();
    this.renderPlaylistsGrid();
  }

  openAddToPlaylistModal(track) {
    this.pendingAddTrack = track;
    if (!this.addToPlaylistModal) return;

    if (this.addSongTargetTitle) {
      this.addSongTargetTitle.textContent = `Adding "${track.title}" to:`;
    }

    if (!this.playlistPickerList) return;
    this.playlistPickerList.innerHTML = '';

    if (!this.customPlaylists.length) {
      this.playlistPickerList.innerHTML = `
        <div style="text-align:center; padding: 14px; font-size: 13px; color: var(--text-muted);">
          No playlists created yet! ♡
          <div style="margin-top: 10px;">
            <button class="kawaii-primary-btn" id="picker-create-btn" type="button">+ Create a Playlist Now</button>
          </div>
        </div>
      `;
      const btn = document.getElementById('picker-create-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          this.closeAddToPlaylistModal();
          this.openCreatePlaylistModal();
        });
      }
    } else {
      this.customPlaylists.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'playlist-picker-item';
        item.innerHTML = `
          <span class="playlist-picker-name">${pl.title}</span>
          <span class="playlist-picker-count">${pl.tracks ? pl.tracks.length : 0} songs</span>
        `;
        item.addEventListener('click', () => {
          this.addTrackToPlaylist(pl.id, this.pendingAddTrack);
        });
        this.playlistPickerList.appendChild(item);
      });
    }

    this.addToPlaylistModal.style.display = 'flex';
  }

  closeAddToPlaylistModal() {
    if (this.addToPlaylistModal) this.addToPlaylistModal.style.display = 'none';
    this.pendingAddTrack = null;
  }

  async addTrackToPlaylist(playlistId, track) {
    const pl = this.customPlaylists.find(p => p.id === playlistId);
    if (!pl) return;

    if (!pl.tracks) pl.tracks = [];

    // Check if song already in playlist
    if (!pl.tracks.some(t => t.id === track.id)) {
      pl.tracks.push(track);
      localStorage.setItem('spotify_user_playlists', JSON.stringify(this.customPlaylists));

      // Supabase sync
      if (this.supabase && this.user) {
        try {
          await this.supabase.from('playlist_tracks').insert([{
            playlist_id: playlistId,
            track_id: track.id,
            track_data: track,
            position: pl.tracks.length
          }]);
        } catch (err) {
          console.warn('Error saving track to Supabase playlist:', err.message);
        }
      }
    }

    this.closeAddToPlaylistModal();
    if (this.currentTab === 'playlists') {
      this.renderPlaylistsGrid();
    }
  }

  renderPlaylistsGrid() {
    if (!this.twoColSongsList) return;
    this.twoColSongsList.innerHTML = '';

    if (!this.customPlaylists.length) {
      this.twoColSongsList.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
          <p style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 12px;">You haven't created any playlists yet! ♡</p>
          <button class="kawaii-primary-btn" style="max-width: 220px; margin: 0 auto;" id="btn-empty-create-pl">+ Create First Playlist</button>
        </div>
      `;
      const btn = document.getElementById('btn-empty-create-pl');
      if (btn) btn.addEventListener('click', () => this.openCreatePlaylistModal());
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'playlist-cards-grid';

    this.customPlaylists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'user-pl-card';
      const songCount = pl.tracks ? pl.tracks.length : 0;

      card.innerHTML = `
        <button class="user-pl-delete-btn" title="Delete Playlist">✕</button>
        <div class="user-pl-thumb-wrap">
          <img src="${pl.cover}" class="user-pl-thumb" alt="${pl.title}" loading="lazy">
          <button class="user-pl-play-btn" title="Play Playlist">▷</button>
        </div>
        <div class="user-pl-meta">
          <span class="user-pl-title" title="${pl.title}">${pl.title}</span>
          <span class="user-pl-count">${songCount} song${songCount === 1 ? '' : 's'}</span>
        </div>
      `;

      // Play playlist on play button click
      const playBtn = card.querySelector('.user-pl-play-btn');
      playBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (pl.tracks && pl.tracks.length) {
          this.setTrack(0, true, pl.tracks);
        } else {
          alert('This playlist is empty! Add songs to it using the ➕ icon on any song. ♡');
        }
      });

      // Delete button
      const deleteBtn = card.querySelector('.user-pl-delete-btn');
      deleteBtn?.addEventListener('click', (e) => this.deletePlaylist(pl.id, e));

      // View playlist tracks
      card.addEventListener('click', () => this.renderPlaylistDetail(pl));

      grid.appendChild(card);
    });

    this.twoColSongsList.appendChild(grid);
  }

  renderPlaylistDetail(playlist) {
    if (!this.twoColSongsList) return;
    this.twoColSongsList.innerHTML = '';

    const tracksCount = playlist.tracks ? playlist.tracks.length : 0;
    const isThisPlaying = this.isPlaying && this.activePlaylist === playlist.tracks;

    // Spotify-style Playlist Hero Banner
    const hero = document.createElement('div');
    hero.className = 'pl-detail-hero';
    hero.innerHTML = `
      <img src="${playlist.cover}" class="pl-detail-cover" alt="${playlist.title}">
      <div class="pl-detail-info">
        <span class="pl-badge">PLAYLIST</span>
        <h2 class="pl-title-text">${playlist.title}</h2>
        <p class="pl-desc-text">${playlist.description || 'Lovely curated music collection on Kiko ♡'}</p>
        <div class="pl-stats-text">${tracksCount} song${tracksCount === 1 ? '' : 's'} • Kiko Web Player</div>
      </div>
    `;
    this.twoColSongsList.appendChild(hero);

    // Spotify-style Actions Bar (Big circular play button, shuffle, back)
    const actionsBar = document.createElement('div');
    actionsBar.className = 'pl-spotify-actions-bar';
    actionsBar.innerHTML = `
      <button class="pl-big-play-btn" id="btn-pl-big-play" title="${isThisPlaying ? 'Pause' : 'Play Playlist'}">
        <svg viewBox="0 0 24 24">
          ${isThisPlaying 
            ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>' 
            : '<path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"/>'}
        </svg>
      </button>
      <button class="pl-action-pill" id="btn-pl-shuffle" title="Shuffle Play">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
        Shuffle
      </button>
      <button class="pl-back-btn" id="btn-back-playlists">← Back to Playlists</button>
    `;
    this.twoColSongsList.appendChild(actionsBar);

    const backBtn = actionsBar.querySelector('#btn-back-playlists');
    backBtn?.addEventListener('click', () => this.renderPlaylistsGrid());

    const bigPlayBtn = actionsBar.querySelector('#btn-pl-big-play');
    bigPlayBtn?.addEventListener('click', () => {
      if (!this.user) { this.openAuthModal(); return; }
      if (!playlist.tracks || !playlist.tracks.length) {
        alert('This playlist is empty! Add songs to it using the ➕ icon on any song. ♡');
        return;
      }
      if (this.activePlaylist === playlist.tracks && this.isPlaying) {
        this.pause();
      } else {
        this.setTrack(0, true, playlist.tracks);
      }
      this.renderPlaylistDetail(playlist);
    });

    const shuffleBtn = actionsBar.querySelector('#btn-pl-shuffle');
    shuffleBtn?.addEventListener('click', () => {
      if (!this.user) { this.openAuthModal(); return; }
      if (!playlist.tracks || !playlist.tracks.length) {
        alert('This playlist is empty! Add songs to it using the ➕ icon on any song. ♡');
        return;
      }
      const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
      this.isShuffle = true;
      this.btnShuffle.classList.add('active');
      this.setTrack(0, true, shuffled);
      this.renderPlaylistDetail(playlist);
    });

    if (!playlist.tracks || !playlist.tracks.length) {
      const emptyNotice = document.createElement('div');
      emptyNotice.style.gridColumn = '1 / -1';
      emptyNotice.style.textAlign = 'center';
      emptyNotice.style.padding = '30px';
      emptyNotice.style.color = 'var(--text-muted)';
      emptyNotice.innerHTML = `This playlist is empty! Browse songs and tap ➕ to add them here ♡`;
      this.twoColSongsList.appendChild(emptyNotice);
      return;
    }

    const cur = this.getCurrentTrack();

    playlist.tracks.forEach((track, idx) => {
      const isCurrent = cur && cur.id === track.id;
      const isLiked = this.likedTrackIds.has(track.id);

      const item = document.createElement('div');
      item.className = `cute-song-item ${isCurrent ? 'active' : ''}`;
      item.dataset.trackId = track.id;
      item.innerHTML = `
        <img src="${track.cover}" class="song-item-thumb" alt="${track.title}" loading="lazy">
        <div class="song-item-meta">
          <span class="song-item-label" title="${track.title}"><strong>Song:</strong> ${track.title}</span>
          <span class="artist-item-label" title="${track.artist}"><strong>Artist:</strong> ${track.artist}</span>
        </div>
        <div class="song-item-actions">
          <button class="song-item-add-pl" title="Add to Playlist">➕</button>
          <button class="song-item-heart ${isLiked ? 'liked' : ''}" title="${isLiked ? 'Unlike' : 'Like'}">
            ${isLiked ? '♥' : '♡'}
          </button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.song-item-add-pl')) {
          e.stopPropagation();
          this.openAddToPlaylistModal(track);
          return;
        }
        if (e.target.closest('.song-item-heart')) {
          e.stopPropagation();
          this.toggleLikeTrack(track);
          return;
        }
        this.setTrack(idx, true, playlist.tracks);
        this.renderPlaylistDetail(playlist);
      });

      this.twoColSongsList.appendChild(item);
    });
  }

  updatePlaylistsCountBadge() {
    if (this.userPlCount) {
      this.userPlCount.textContent = this.customPlaylists.length;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.spotify = new KawaiiSpotify();
});
