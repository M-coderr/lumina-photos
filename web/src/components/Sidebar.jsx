import React from 'react';
import { 
  Image as ImageIcon, 
  Compass, 
  FolderHeart, 
  Star, 
  FolderSync, 
  Trash2,
  HardDrive
} from 'lucide-react';

export default function Sidebar({ currentTab, setCurrentTab, stats }) {
  const navItems = [
    { id: 'photos', label: 'Photos', icon: ImageIcon, count: stats?.total_photos },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'albums', label: 'Albums', icon: FolderHeart, count: stats?.total_albums },
    { id: 'favorites', label: 'Favorites', icon: Star, count: stats?.favorite_photos },
    { id: 'folders', label: 'Watched Folders', icon: FolderSync, count: stats?.watched_folders },
    { id: 'trash', label: 'Trash', icon: Trash2, count: stats?.trashed_photos },
  ];

  return (
    <aside className="w-64 border-r border-neutral-800 bg-neutral-900/60 flex flex-col justify-between p-3 select-none">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 font-semibold shadow-inner'
                  : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-blue-500/20 text-blue-300' : 'bg-neutral-800 text-neutral-400'}`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Storage info card at sidebar bottom */}
      <div className="p-3.5 rounded-2xl bg-neutral-800/50 border border-neutral-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
            <span>PC Storage</span>
          </div>
          <span className="text-white font-semibold">{stats?.readable_storage || '0 MB'}</span>
        </div>
        <div className="w-full h-1.5 bg-neutral-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: '15%' }} />
        </div>
        <p className="text-[11px] text-neutral-500 leading-tight">
          Unlimited offline storage on your PC. No cloud fees.
        </p>
      </div>
    </aside>
  );
}
