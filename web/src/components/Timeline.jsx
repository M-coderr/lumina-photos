import React, { useMemo } from 'react';
import { 
  Star, 
  CheckCircle2, 
  Play, 
  Trash2, 
  Download, 
  Plus, 
  X,
  Calendar,
  ImageOff
} from 'lucide-react';

function formatDateHeader(isoDateString) {
  try {
    const d = new Date(isoDateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Unknown Date';
  }
}

export default function Timeline({
  photos = [],
  selectedIds = new Set(),
  onToggleSelect,
  onSelectAllGroup,
  onOpenLightbox,
  onToggleFavorite,
  onBatchTrash,
  onBatchAddToAlbum,
  onClearSelection,
  emptyMessage = "No photos found",
  showTrashActions = false,
  onRestoreFromTrash,
  onPermanentDelete
}) {
  // Group photos by date string
  const groupedPhotos = useMemo(() => {
    const groups = {};
    for (const photo of photos) {
      const dateKey = photo.taken_at ? photo.taken_at.split('T')[0] : 'undated';
      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateKey,
          label: formatDateHeader(photo.taken_at),
          items: [],
        };
      }
      groups[dateKey].items.push(photo);
    }
    return Object.values(groups);
  }, [photos]);

  const hasSelection = selectedIds.size > 0;

  if (photos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center select-none">
        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4 text-neutral-500">
          <ImageOff className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-medium text-neutral-300">{emptyMessage}</h3>
        <p className="text-sm text-neutral-500 max-w-sm mt-1">
          Drop photos here or add a folder in "Watched Folders" to automatically index pictures from your PC or mobile app.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 relative pb-24 px-6 pt-4 max-w-[1600px] mx-auto w-full">
      {/* Floating Batch Actions Bar (Google Photos style) */}
      {hasSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-neutral-800/95 backdrop-blur-md border border-neutral-700 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <button
            onClick={onClearSelection}
            className="text-neutral-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>{selectedIds.size} selected</span>
          </button>

          <div className="h-5 w-px bg-neutral-700" />

          {!showTrashActions ? (
            <>
              <button
                onClick={() => onBatchAddToAlbum && onBatchAddToAlbum(Array.from(selectedIds))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Album</span>
              </button>
              <button
                onClick={() => onBatchTrash && onBatchTrash(Array.from(selectedIds))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Move to Trash</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onRestoreFromTrash && onRestoreFromTrash(Array.from(selectedIds))}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 cursor-pointer"
              >
                Restore Selected
              </button>
              <button
                onClick={() => onPermanentDelete && onPermanentDelete(Array.from(selectedIds))}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              >
                Delete Permanently
              </button>
            </>
          )}
        </div>
      )}

      {/* Date-grouped timeline sections */}
      {groupedPhotos.map((group) => {
        const allSelected = group.items.every((p) => selectedIds.has(p.id));

        return (
          <section key={group.dateKey} className="mb-8">
            {/* Sticky Date Header */}
            <div className="sticky top-16 z-20 bg-neutral-900/90 backdrop-blur-md py-2.5 mb-2 flex items-center justify-between border-b border-neutral-800/60">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-neutral-200 tracking-tight">
                  {group.label}
                </h2>
                <span className="text-xs text-neutral-500 font-normal">
                  {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <button
                onClick={() => onSelectAllGroup && onSelectAllGroup(group.items.map((p) => p.id), !allSelected)}
                className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-neutral-800 cursor-pointer"
              >
                {allSelected ? 'Deselect date' : 'Select date'}
              </button>
            </div>

            {/* Photo Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {group.items.map((photo) => {
                const isSelected = selectedIds.has(photo.id);
                const isVideo = photo.mime_type && photo.mime_type.startsWith('video/');

                return (
                  <div
                    key={photo.id}
                    className={`group relative aspect-square rounded-xl overflow-hidden bg-neutral-800 cursor-pointer transition-transform duration-150 hover:scale-[1.02] shadow-sm select-none ${
                      isSelected ? 'ring-3 ring-blue-500' : ''
                    }`}
                    onClick={() => {
                      if (hasSelection) {
                        onToggleSelect(photo.id);
                      } else {
                        onOpenLightbox(photo);
                      }
                    }}
                  >
                    {/* Thumbnail Image */}
                    <img
                      src={`/api/photos/${photo.id}/thumbnail/micro`}
                      alt={photo.filename}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />

                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Top Checkbox for Selection */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(photo.id);
                      }}
                      className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white opacity-100'
                          : 'bg-black/40 text-neutral-300 opacity-0 group-hover:opacity-100 hover:bg-black/70'
                      }`}
                    >
                      <CheckCircle2 className={`w-5 h-5 ${isSelected ? 'fill-blue-600 text-white' : ''}`} />
                    </button>

                    {/* Favorite Star Button (Top Right) */}
                    {!showTrashActions && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(photo.id, !photo.is_favorite);
                        }}
                        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          photo.is_favorite
                            ? 'text-amber-400 opacity-100 drop-shadow'
                            : 'text-neutral-300 opacity-0 group-hover:opacity-100 hover:text-amber-400 bg-black/40'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${photo.is_favorite ? 'fill-amber-400' : ''}`} />
                      </button>
                    )}

                    {/* Video Duration / Play Badge */}
                    {isVideo && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] font-medium text-white">
                        <Play className="w-3 h-3 fill-white" />
                        <span>VIDEO</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
