import React, { useState } from 'react';

export default function Scrubber({ timelineDates = [], onSelectMonth, currentMonth }) {
  const [hoveredDate, setHoveredDate] = useState(null);

  if (timelineDates.length <= 1) return null;

  return (
    <div className="fixed right-3 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col items-end gap-1 text-[11px] font-semibold text-neutral-500 select-none py-4">
      {currentMonth && (
        <button
          onClick={() => onSelectMonth(null)}
          className="text-[10px] text-blue-400 hover:underline mb-2 px-2 py-0.5 rounded bg-blue-500/10 cursor-pointer"
        >
          View All
        </button>
      )}

      {timelineDates.map((item) => {
        const isSelected = currentMonth === item.month;
        const [year, month] = item.month.split('-');
        const monthName = new Date(year, parseInt(month) - 1, 1).toLocaleString('default', { month: 'short' });

        return (
          <div
            key={item.month}
            className="relative flex items-center group cursor-pointer"
            onMouseEnter={() => setHoveredDate(item)}
            onMouseLeave={() => setHoveredDate(null)}
            onClick={() => onSelectMonth(isSelected ? null : item.month)}
          >
            {/* Hover tooltip showing full month + photo count */}
            {hoveredDate?.month === item.month && (
              <div className="absolute right-7 bg-neutral-800 text-white px-2.5 py-1 rounded-md text-xs whitespace-nowrap shadow-xl border border-neutral-700 pointer-events-none animate-in fade-in">
                {monthName} {year} ({item.count} photos)
              </div>
            )}

            {/* Scrubber tick / indicator */}
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white font-bold scale-110 shadow-md'
                  : 'hover:text-neutral-200 hover:bg-neutral-800/80'
              }`}
            >
              <span>{monthName}</span>
              <span className="text-[9px] opacity-70">{year.slice(2)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
