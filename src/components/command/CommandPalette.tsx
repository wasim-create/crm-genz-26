import React, { useState, useEffect } from 'react';
import { Dealership } from '../../types/crm';
import { Search, Sparkles, Building, MapPin, ArrowRight, Flame } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  dealerships: Dealership[];
  onSelectDealership: (dealership: Dealership) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  dealerships,
  onSelectDealership
}) => {
  const [query, setQuery] = useState('');

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter based on query or natural language intents
  const results = dealerships.filter(d => {
    if (!query.trim()) return false;
    const q = query.toLowerCase();

    // Natural language filters
    if (q.includes('hot')) {
      return d.heatLevel === 'Hot';
    }
    if (q.includes('100') || q.includes('volume') || q.includes('large')) {
      return d.usedCarsOnLot >= 100;
    }
    if (q.includes('group') || q.includes('holman')) {
      return d.dealershipType === 'Dealer Group';
    }

    // Keyword match
    return (
      d.dealershipName.toLowerCase().includes(q) ||
      d.city.toLowerCase().includes(q) ||
      d.state.toLowerCase().includes(q) ||
      d.zipCode.includes(q)
    );
  }).slice(0, 6);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-start justify-center pt-20 p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a natural language query (e.g. 'hot deals', 'large volume lots', or dealership name)..."
            className="w-full text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono text-slate-400 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="p-2 max-h-80 overflow-y-auto custom-scrollbar">
          {!query.trim() ? (
            <div className="p-6 text-center space-y-2">
              <Sparkles className="w-6 h-6 text-indigo-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">Try Natural Language Searches:</p>
              <div className="flex flex-wrap justify-center gap-1.5 text-[11px] text-slate-500">
                <span className="bg-slate-100 px-2 py-0.5 rounded cursor-pointer hover:bg-slate-200" onClick={() => setQuery('hot deals')}>
                  "hot deals"
                </span>
                <span className="bg-slate-100 px-2 py-0.5 rounded cursor-pointer hover:bg-slate-200" onClick={() => setQuery('large volume lots')}>
                  "large volume lots (100+)"
                </span>
                <span className="bg-slate-100 px-2 py-0.5 rounded cursor-pointer hover:bg-slate-200" onClick={() => setQuery('holman')}>
                  "holman dealer groups"
                </span>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No matching dealerships found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {results.map(d => (
                <div
                  key={d.id}
                  onClick={() => {
                    onSelectDealership(d);
                    onClose();
                  }}
                  className="p-3 hover:bg-blue-50/60 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Building className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{d.dealershipName}</span>
                        {d.heatLevel === 'Hot' && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 rounded font-bold">HOT</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {d.city}, {d.state} • {d.usedCarsOnLot} cars • {d.stage}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
