import React, { useState, useEffect } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  Info, 
  Download, 
  Trash2, 
  Camera, 
  MapPin, 
  Calendar, 
  HardDrive, 
  Maximize2
} from 'lucide-react';

export default function Lightbox({
  photo,
  photos = [],
  onClose,
  onToggleFavorite,
  onToggleTrash,
  onNavigate
}) {
  const [showInfo, setShowInfo] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'i' || e.key === 'I') setShowInfo((prev) => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, photos]);

  if (!photo) return null;

  const currentIndex = photos.findIndex((p) => p.id === photo.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const handlePrev = () => {
    if (hasPrev) onNavigate(photos[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) onNavigate(photos[currentIndex + 1]);
  };

  const isVideo = photo.mime_type && photo.mime_type.startsWith('video/');
  const formattedDate = photo.taken_at ? new Date(photo.taken_at).toLocaleString() : 'Undated';
  const fileSizeMB = (photo.file_size / (1024 * 1024)).toFixed(2);
  const megapixels = photo.width && photo.height ? ((photo.width * photo.height) / 1000000).toFixed(1) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none animate-in fade-in duration-200">
      {/* Top Controls Bar */}
      <div className="h-14 px-4 flex items-center justify-between text-neutral-300 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-800/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-neutral-200 truncate max-w-xs sm:max-w-md">
            {photo.filename}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleFavorite(photo.id, !photo.is_favorite)}
            className={`p-2 rounded-full hover:bg-neutral-800/80 transition-colors cursor-pointer ${
              photo.is_favorite ? 'text-amber-400' : 'hover:text-white'
            }`}
            title="Favorite"
          >
            <Star className={`w-5 h-5 ${photo.is_favorite ? 'fill-amber-400' : ''}`} />
          </button>

          <a
            href={`/api/photos/${photo.id}/file`}
            download={photo.filename}
            className="p-2 rounded-full hover:bg-neutral-800/80 hover:text-white transition-colors cursor-pointer"
            title="Download original file"
          >
            <Download className="w-5 h-5" />
          </a>

          <button
            onClick={() => {
              onToggleTrash(photo.id, true);
              onClose();
            }}
            className="p-2 rounded-full hover:bg-neutral-800/80 hover:text-rose-400 transition-colors cursor-pointer"
            title="Move to trash"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowInfo((prev) => !prev)}
            className={`p-2 rounded-full hover:bg-neutral-800/80 transition-colors cursor-pointer ${
              showInfo ? 'bg-blue-600/30 text-blue-400' : 'hover:text-white'
            }`}
            title="Photo information & EXIF (I)"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Previous Button */}
        {hasPrev && (
          <button
            onClick={handlePrev}
            className="absolute left-4 z-20 p-3 rounded-full bg-black/40 hover:bg-black/80 text-white backdrop-blur-sm transition-all hover:scale-110 cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Media Preview */}
        <div className="w-full h-full flex items-center justify-center p-4">
          {isVideo ? (
            <video
              src={`/api/photos/${photo.id}/file`}
              controls
              autoPlay
              className="max-h-full max-w-full rounded-lg shadow-2xl"
            />
          ) : (
            <img
              src={`/api/photos/${photo.id}/thumbnail/preview`}
              alt={photo.filename}
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-all"
            />
          )}
        </div>

        {/* Next Button */}
        {hasNext && (
          <button
            onClick={handleNext}
            className="absolute right-4 z-20 p-3 rounded-full bg-black/40 hover:bg-black/80 text-white backdrop-blur-sm transition-all hover:scale-110 cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Slide-out EXIF Info Sidebar */}
        {showInfo && (
          <div className="absolute right-0 top-0 bottom-0 w-80 sm:w-96 bg-neutral-900/95 backdrop-blur-xl border-l border-neutral-800 p-6 overflow-y-auto text-neutral-300 z-30 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <h3 className="font-semibold text-base text-white">Info & EXIF</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6 mt-5 text-sm">
              {/* Date & Time */}
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">{formattedDate}</p>
                  <p className="text-xs text-neutral-500">Date Taken</p>
                </div>
              </div>

              {/* File Specs */}
              <div className="flex items-start gap-3">
                <HardDrive className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">{photo.filename}</p>
                  <p className="text-xs text-neutral-400">
                    {photo.width} × {photo.height} {megapixels ? `• ${megapixels} MP` : ''} • {fileSizeMB} MB
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">Source: {photo.source_type}</p>
                </div>
              </div>

              {/* Camera Details */}
              {(photo.camera_model || photo.camera_make || photo.aperture) && (
                <div className="flex items-start gap-3">
                  <Camera className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-white">
                      {photo.camera_make} {photo.camera_model}
                    </p>
                    {photo.lens_model && (
                      <p className="text-xs text-neutral-400">{photo.lens_model}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-neutral-300 mt-2">
                      {photo.aperture && (
                        <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">
                          {photo.aperture}
                        </span>
                      )}
                      {photo.exposure_time && (
                        <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">
                          {photo.exposure_time}
                        </span>
                      )}
                      {photo.focal_length && (
                        <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">
                          {photo.focal_length}
                        </span>
                      )}
                      {photo.iso && (
                        <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">
                          ISO {photo.iso}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* GPS Coordinates */}
              {photo.latitude !== null && photo.longitude !== null && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-white">Location Coordinates</p>
                    <p className="text-xs text-neutral-400">
                      {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs text-blue-400 hover:underline"
                    >
                      View on Google Maps →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
