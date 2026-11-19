import React, { useRef } from 'react';
import { 
  Search, 
  Upload, 
  QrCode, 
  HardDrive, 
  SlidersHorizontal,
  X,
  Sparkles
} from 'lucide-react';

export default function Navbar({
  searchTerm,
  setSearchTerm,
  onOpenPairing,
  onOpenAdminSwitch,
  onUploadFiles,
  stats,
  isUploading,
  uploadProgress
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'trial':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'paused':
      case 'expired':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse';
      default:
        return 'bg-neutral-800 text-neutral-400 border-neutral-700';
    }
  };

  const status = stats?.license?.status || 'active';

  return (
    <header className="h-16 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Brand */}
      <div className="flex items-center gap-3 w-64 min-w-[200px]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-amber-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-semibold text-lg tracking-tight text-white flex items-center gap-1.5">
            Lumina <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">Photos</span>
          </span>
          <p className="text-[11px] text-neutral-400 leading-none">Your PC Cloud</p>
        </div>
      </div>

      {/* Search Bar (Google Photos inspired) */}
      <div className="flex-1 max-w-2xl mx-4">
        <div className="relative group">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-blue-400 transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search your photos, camera, dates..."
            className="w-full bg-neutral-800/80 hover:bg-neutral-800 text-neutral-100 placeholder-neutral-400 text-sm rounded-full pl-10 pr-10 py-2.5 border border-neutral-700/60 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* The Switch Indicator / Admin Button */}
        <button
          onClick={onOpenAdminSwitch}
          title="Server Switch & Monetization Controls"
          className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer ${getStatusColor(status)}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="capitalize">{status}</span>
        </button>

        {/* Storage Badge */}
        {stats && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-medium">
            <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
            <span>{stats.readable_storage}</span>
          </div>
        )}

        {/* Mobile Pairing Button */}
        <button
          onClick={onOpenPairing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
        >
          <QrCode className="w-4 h-4 text-indigo-400" />
          <span className="hidden sm:inline">Pair Mobile</span>
        </button>

        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || status === 'paused' || status === 'expired'}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all shadow-md cursor-pointer ${
            status === 'paused' || status === 'expired'
              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
          }`}
        >
          <Upload className={`w-4 h-4 ${isUploading ? 'animate-bounce' : ''}`} />
          <span>{isUploading ? `${uploadProgress}% Uploading...` : 'Upload'}</span>
        </button>
      </div>
    </header>
  );
}
