import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Timeline from './components/Timeline';
import Scrubber from './components/Scrubber';
import Lightbox from './components/Lightbox';
import PairingModal from './components/PairingModal';
import AdminSwitchModal from './components/AdminSwitchModal';
import WatchedFoldersView from './components/WatchedFoldersView';
import AlbumsView from './components/AlbumsView';
import { 
  getPhotos, 
  getTimelineDates, 
  getStats, 
  toggleFavorite, 
  toggleTrash, 
  deletePhotoPermanently, 
  uploadPhotos,
  addPhotosToAlbum
} from './api';
import { UploadCloud, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('photos');
  const [photos, setPhotos] = useState([]);
  const [timelineDates, setTimelineDates] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activePhoto, setActivePhoto] = useState(null);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isAdminSwitchOpen, setIsAdminSwitchOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  // Load photos based on tab and filters
  const loadData = useCallback(async () => {
    try {
      const isTrashed = currentTab === 'trash';
      const isFavorite = currentTab === 'favorites' ? true : undefined;

      const [photosData, datesData, statsData] = await Promise.all([
        getPhotos({
          trashed: isTrashed,
          favorite: isFavorite,
          month: currentMonth || undefined,
          search: searchTerm || undefined,
          limit: 300,
        }),
        getTimelineDates(),
        getStats(),
      ]);

      setPhotos(photosData.items || []);
      setTimelineDates(datesData || []);
      setStats(statsData || null);
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }, [currentTab, currentMonth, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time WebSocket connection for live sync
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket = null;

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[Lumina Photos] WebSocket connected for real-time sync');
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === 'photo_added') {
            console.log('[Lumina Photos] Real-time photo added:', payload.data.filename);
            setPhotos((prev) => {
              if (prev.some((p) => p.id === payload.data.id)) return prev;
              return [payload.data, ...prev];
            });
            getStats().then(setStats);
            getTimelineDates().then(setTimelineDates);
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      socket.onerror = () => {
        console.log('[Lumina Photos] WS offline, fallback to HTTP');
      };
    } catch (e) {
      console.log('WS init error', e);
    }

    return () => {
      if (socket) socket.close();
    };
  }, []);

  // Selection handlers
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllGroup = (ids, selectAll) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (selectAll) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Actions
  const handleToggleFavorite = async (id, isFav) => {
    try {
      await toggleFavorite(id, isFav);
      setPhotos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_favorite: isFav ? 1 : 0 } : p))
      );
      if (activePhoto?.id === id) {
        setActivePhoto((prev) => ({ ...prev, is_favorite: isFav ? 1 : 0 }));
      }
      getStats().then(setStats);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleTrash = async (id, isTrashed) => {
    try {
      await toggleTrash(id, isTrashed);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      getStats().then(setStats);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBatchTrash = async (ids) => {
    try {
      await Promise.all(ids.map((id) => toggleTrash(id, true)));
      setPhotos((prev) => prev.filter((p) => !ids.includes(p.id)));
      handleClearSelection();
      getStats().then(setStats);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestoreFromTrash = async (ids) => {
    try {
      await Promise.all(ids.map((id) => toggleTrash(id, false)));
      setPhotos((prev) => prev.filter((p) => !ids.includes(p.id)));
      handleClearSelection();
      getStats().then(setStats);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePermanentDelete = async (ids) => {
    if (!confirm(`Permanently delete ${ids.length} photo(s)? This cannot be undone.`)) return;
    try {
      await Promise.all(ids.map((id) => deletePhotoPermanently(id)));
      setPhotos((prev) => prev.filter((p) => !ids.includes(p.id)));
      handleClearSelection();
      getStats().then(setStats);
    } catch (e) {
      console.error(e);
    }
  };

  // Upload handler
  const handleUploadFiles = async (files) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      await uploadPhotos(files, (progress) => {
        setUploadProgress(progress);
      });
      await loadData();
    } catch (e) {
      alert(e.response?.data?.detail || 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Global Drag & Drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const licenseStatus = stats?.license?.status || 'active';
  const isServerPaused = licenseStatus === 'paused' || licenseStatus === 'expired';

  return (
    <div
      className="min-h-screen bg-neutral-900 text-neutral-100 flex flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Fullscreen Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-blue-600/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white border-4 border-dashed border-white m-4 rounded-3xl animate-in fade-in pointer-events-none">
          <UploadCloud className="w-20 h-20 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold">Drop photos or videos to upload</h2>
          <p className="text-sm opacity-90 mt-1">Files are saved directly to your PC server</p>
        </div>
      )}

      {/* License Switch Status Warning Banner (if Paused or Expired) */}
      {isServerPaused && (
        <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Server Paused ({licenseStatus.toUpperCase()}):</strong> Auto-backup and uploads are suspended by the licensing switch. Your existing photos are safe and accessible.
            </span>
          </div>
          <button
            onClick={() => setIsAdminSwitchOpen(true)}
            className="underline font-semibold hover:text-white cursor-pointer ml-4"
          >
            Manage Switch / Renew
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onOpenPairing={() => setIsPairingOpen(true)}
        onOpenAdminSwitch={() => setIsAdminSwitchOpen(true)}
        onUploadFiles={handleUploadFiles}
        stats={stats}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} stats={stats} />

        {/* View Routing */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {currentTab === 'photos' && (
            <>
              <Timeline
                photos={photos}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAllGroup={handleSelectAllGroup}
                onOpenLightbox={setActivePhoto}
                onToggleFavorite={handleToggleFavorite}
                onBatchTrash={handleBatchTrash}
                onClearSelection={handleClearSelection}
              />
              <Scrubber
                timelineDates={timelineDates}
                currentMonth={currentMonth}
                onSelectMonth={setCurrentMonth}
              />
            </>
          )}

          {currentTab === 'favorites' && (
            <Timeline
              photos={photos}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAllGroup={handleSelectAllGroup}
              onOpenLightbox={setActivePhoto}
              onToggleFavorite={handleToggleFavorite}
              onBatchTrash={handleBatchTrash}
              onClearSelection={handleClearSelection}
              emptyMessage="No favorites yet"
            />
          )}

          {currentTab === 'trash' && (
            <Timeline
              photos={photos}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAllGroup={handleSelectAllGroup}
              onOpenLightbox={setActivePhoto}
              showTrashActions={true}
              onRestoreFromTrash={handleRestoreFromTrash}
              onPermanentDelete={handlePermanentDelete}
              onClearSelection={handleClearSelection}
              emptyMessage="Trash is empty"
            />
          )}

          {currentTab === 'folders' && (
            <WatchedFoldersView onFolderUpdated={loadData} />
          )}

          {currentTab === 'albums' && (
            <AlbumsView onOpenLightbox={setActivePhoto} />
          )}

          {currentTab === 'explore' && (
            <div className="p-8 max-w-4xl mx-auto text-center">
              <h2 className="text-xl font-bold text-white">Explore Memories</h2>
              <p className="text-xs text-neutral-400 mt-1">
                Filter by camera models, capture dates, or locations.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                <div
                  onClick={() => setCurrentTab('favorites')}
                  className="p-6 rounded-2xl bg-neutral-800/40 border border-neutral-800 hover:border-neutral-700 cursor-pointer"
                >
                  <h3 className="font-semibold text-white">Favorites</h3>
                  <p className="text-xs text-neutral-400 mt-1">{stats?.favorite_photos || 0} starred items</p>
                </div>
                <div
                  onClick={() => setCurrentTab('albums')}
                  className="p-6 rounded-2xl bg-neutral-800/40 border border-neutral-800 hover:border-neutral-700 cursor-pointer"
                >
                  <h3 className="font-semibold text-white">Albums</h3>
                  <p className="text-xs text-neutral-400 mt-1">{stats?.total_albums || 0} custom collections</p>
                </div>
                <div
                  onClick={() => setCurrentTab('folders')}
                  className="p-6 rounded-2xl bg-neutral-800/40 border border-neutral-800 hover:border-neutral-700 cursor-pointer"
                >
                  <h3 className="font-semibold text-white">PC Folders</h3>
                  <p className="text-xs text-neutral-400 mt-1">{stats?.watched_folders || 0} live watched</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Fullscreen Lightbox */}
      {activePhoto && (
        <Lightbox
          photo={activePhoto}
          photos={photos}
          onClose={() => setActivePhoto(null)}
          onToggleFavorite={handleToggleFavorite}
          onToggleTrash={handleToggleTrash}
          onNavigate={setActivePhoto}
        />
      )}

      {/* Mobile Pairing Modal */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
      />

      {/* Admin Switch & Monetization Modal */}
      <AdminSwitchModal
        isOpen={isAdminSwitchOpen}
        onClose={() => setIsAdminSwitchOpen(false)}
        currentLicense={stats?.license}
        onRefreshStats={loadData}
      />
    </div>
  );
}
