import React, { useState, useEffect } from 'react';
import { 
  FolderSync, 
  FolderPlus, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  FolderOpen,
  ArrowRight
} from 'lucide-react';
import { getWatchedFolders, addWatchedFolder, scanWatchedFolder, removeWatchedFolder } from '../api';

export default function WatchedFoldersView({ onFolderUpdated }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [folderPathInput, setFolderPathInput] = useState('');
  const [folderNameInput, setFolderNameInput] = useState('');
  const [scanningId, setScanningId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const data = await getWatchedFolders();
      setFolders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFolder = async (e) => {
    e.preventDefault();
    if (!folderPathInput.trim()) return;

    try {
      setErrorMsg(null);
      await addWatchedFolder(folderPathInput.trim(), folderNameInput.trim() || undefined);
      setFolderPathInput('');
      setFolderNameInput('');
      setShowAddModal(false);
      await loadFolders();
      if (onFolderUpdated) onFolderUpdated();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to add folder. Check path.');
    }
  };

  const handleScan = async (folderId) => {
    try {
      setScanningId(folderId);
      await scanWatchedFolder(folderId);
      await loadFolders();
      if (onFolderUpdated) onFolderUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setScanningId(null);
    }
  };

  const handleRemove = async (folderId) => {
    if (!confirm('Stop watching this folder? Your existing indexed photos will be kept.')) return;
    try {
      await removeWatchedFolder(folderId);
      await loadFolders();
      if (onFolderUpdated) onFolderUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <FolderSync className="w-6 h-6 text-blue-400" />
            <span>Watched PC Folders</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Lumina monitors these folders in real-time. Any new photos or videos dropped into them appear automatically on your timeline and mobile app.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Add Folder</span>
        </button>
      </div>

      {/* List */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-xs text-neutral-500">Loading watched folders...</div>
        ) : folders.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/40">
            <FolderOpen className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-neutral-300">No watched folders configured</h4>
            <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
              Add your existing Pictures folder, external hard drives, or phone sync directories to start auto-indexing.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer"
            >
              Select a folder to watch
            </button>
          </div>
        ) : (
          folders.map((f) => (
            <div
              key={f.id}
              className="p-4 rounded-2xl bg-neutral-800/40 border border-neutral-800 flex items-center justify-between hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                  <FolderSync className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-white truncate">{f.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      Live Watch Active
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">{f.folder_path}</p>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    {f.photo_count} photos indexed • Last scanned: {f.last_scanned_at ? new Date(f.last_scanned_at).toLocaleTimeString() : 'Pending'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleScan(f.id)}
                  disabled={scanningId === f.id}
                  className="p-2 rounded-xl hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title="Rescan now"
                >
                  <RefreshCw className={`w-4 h-4 ${scanningId === f.id ? 'animate-spin text-blue-400' : ''}`} />
                </button>
                <button
                  onClick={() => handleRemove(f.id)}
                  className="p-2 rounded-xl hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Remove from watched list"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Folder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <h3 className="font-semibold text-base text-white">Add Watched Folder on PC</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddFolder} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Absolute Folder Path on PC
                </label>
                <input
                  type="text"
                  required
                  value={folderPathInput}
                  onChange={(e) => setFolderPathInput(e.target.value)}
                  placeholder="e.g. E:\Projects\Google Photos Clone\data\sample_photos"
                  className="w-full bg-neutral-800 text-sm text-white rounded-xl px-3.5 py-2.5 border border-neutral-700 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Display Label (Optional)
                </label>
                <input
                  type="text"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  placeholder="e.g. My Sample Photos"
                  className="w-full bg-neutral-800 text-sm text-white rounded-xl px-3.5 py-2.5 border border-neutral-700 focus:outline-none focus:border-blue-500"
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs border border-rose-500/20">
                  {errorMsg}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-md"
                >
                  Start Watching
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function X({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
