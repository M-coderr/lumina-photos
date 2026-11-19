import React, { useState, useEffect } from 'react';
import { 
  FolderHeart, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  ArrowLeft,
  X
} from 'lucide-react';
import { getAlbums, createAlbum, getAlbum, deleteAlbum } from '../api';
import Timeline from './Timeline';

export default function AlbumsView({ onOpenLightbox }) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumDetails, setAlbumDetails] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    loadAlbums();
  }, []);

  const loadAlbums = async () => {
    try {
      setLoading(true);
      const data = await getAlbums();
      setAlbums(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAlbum = async (album) => {
    setSelectedAlbum(album);
    try {
      const details = await getAlbum(album.id);
      setAlbumDetails(details);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAlbum = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await createAlbum(newTitle.trim(), newDesc.trim());
      setNewTitle('');
      setNewDesc('');
      setShowCreateModal(false);
      await loadAlbums();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAlbum = async (e, albumId) => {
    e.stopPropagation();
    if (!confirm('Delete this album? Photos inside will not be deleted.')) return;
    try {
      await deleteAlbum(albumId);
      if (selectedAlbum?.id === albumId) {
        setSelectedAlbum(null);
        setAlbumDetails(null);
      }
      await loadAlbums();
    } catch (e) {
      console.error(e);
    }
  };

  if (selectedAlbum && albumDetails) {
    return (
      <div className="flex-1 flex flex-col w-full">
        {/* Album Header */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedAlbum(null);
                setAlbumDetails(null);
              }}
              className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-white">{albumDetails.title}</h2>
              <p className="text-xs text-neutral-400">
                {albumDetails.photos?.length || 0} photos • {albumDetails.description || 'No description'}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => handleDeleteAlbum(e, selectedAlbum.id)}
            className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
            title="Delete album"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Photos in Album */}
        <Timeline
          photos={albumDetails.photos || []}
          onOpenLightbox={onOpenLightbox}
          emptyMessage="No photos in this album yet"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <FolderHeart className="w-6 h-6 text-indigo-400" />
            <span>Albums</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Organize your memories into custom collections.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Album</span>
        </button>
      </div>

      {/* Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="text-center py-12 text-xs text-neutral-500">Loading albums...</div>
        ) : albums.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/40">
            <FolderHeart className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-neutral-300">No albums yet</h4>
            <p className="text-xs text-neutral-500 mt-1">
              Create an album and select photos to group them together.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer"
            >
              Create your first album
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((album) => (
              <div
                key={album.id}
                onClick={() => handleSelectAlbum(album)}
                className="group relative flex flex-col rounded-2xl overflow-hidden bg-neutral-800/40 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-all hover:scale-[1.02]"
              >
                {/* Cover Photo */}
                <div className="aspect-square bg-neutral-800 relative flex items-center justify-center overflow-hidden">
                  {album.cover_photo_id ? (
                    <img
                      src={`/api/photos/${album.cover_photo_id}/thumbnail/preview`}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-neutral-600" />
                  )}
                </div>

                {/* Details */}
                <div className="p-3">
                  <h4 className="font-semibold text-sm text-white truncate">{album.title}</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">{album.photo_count} photos</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <h3 className="font-semibold text-base text-white">Create New Album</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAlbum} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Album Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Summer Vacation 2024"
                  className="w-full bg-neutral-800 text-sm text-white rounded-xl px-3.5 py-2.5 border border-neutral-700 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. Trip to the mountains"
                  className="w-full bg-neutral-800 text-sm text-white rounded-xl px-3.5 py-2.5 border border-neutral-700 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-md"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
