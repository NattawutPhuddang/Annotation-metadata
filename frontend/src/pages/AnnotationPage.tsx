import React, { useState, useEffect } from 'react';
import { Check, X, Play, Pause } from 'lucide-react';
import { AudioItem } from '../types';
import { Pagination } from '../components/Pagination';
import { TokenizedText } from '../components/TokenizedText';
import { WaveformPlayer } from '../components/WaveformPlayer';

interface Props {
  pendingItems: AudioItem[];
  onDecision: (item: AudioItem, status: 'correct' | 'incorrect') => void;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  onInspectText: (text: string) => Promise<string[]>;
}

const ITEMS_PER_PAGE = 10; // ลดจำนวนลงเล็กน้อยเพื่อให้หน้าดูไม่แน่น

const AnnotationPage: React.FC<Props> = ({ pendingItems, onDecision, playAudio, playingFile, onInspectText }) => {
  const [page, setPage] = useState(1);
  const items = pendingItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const first = items[0];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!first) return;
      if (e.code === 'Space') { e.preventDefault(); playAudio(first); }
      if (e.code === 'Enter') { e.preventDefault(); onDecision(first, 'correct'); }
      if (e.code === 'Backspace') { e.preventDefault(); onDecision(first, 'incorrect'); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [first, playAudio, onDecision]);

  if (pendingItems.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-green-50 text-green-400 rounded-full flex items-center justify-center mb-4">
        <Check size={32} />
      </div>
      <h3 className="text-xl font-semibold text-slate-600">All caught up!</h3>
      <p className="text-slate-400 mt-2">No pending items to review.</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* Minimal Card Container */}
      <div className="minimal-card mb-8">
        <table className="custom-table">
          <thead>
            <tr>
              <th className="w-16 text-center">No.</th>
              <th className="w-1/3">Audio Source</th>
              <th>Transcript</th>
              <th className="w-32 text-center">Decision</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isPlaying = playingFile === item.filename;
              return (
                <tr key={item.filename} className="row-hover">
                  <td className="text-center">
                    <span className="text-xs font-mono text-slate-300">
                      {(page-1)*ITEMS_PER_PAGE + idx + 1}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-4 items-center">
                      <button 
                        onClick={() => playAudio(item)}
                        className={`btn-play flex-shrink-0 flex items-center justify-center transition-all ${isPlaying ? 'playing' : ''}`}
                      >
                         {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1"/>}
                      </button>
                      <div className="min-w-0">
                         <div className="text-xs text-slate-400 mb-1 truncate max-w-[200px]" title={item.filename}>
                           {item.filename}
                         </div>
                         {/* Waveform placeholder area - if you use WaveformPlayer, style it to be minimal */}
                         <div className="h-6 w-full bg-slate-100 rounded-md overflow-hidden relative">
                            {item.audioPath && isPlaying && <div className="absolute inset-0 bg-indigo-100 opacity-50 animate-pulse"/>}
                         </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-token pl-2 border-l-2 border-indigo-100">
                      <TokenizedText text={item.text} onInspect={onInspectText} isExpanded={idx===0}/>
                    </div>
                  </td>
                  <td>
                    <div className="flex justify-center gap-3">
                      <button onClick={()=>onDecision(item,'correct')} className="btn-icon btn-check" title="Correct (Enter)">
                        <Check size={18} strokeWidth={3}/>
                      </button>
                      <button onClick={()=>onDecision(item,'incorrect')} className="btn-icon btn-cross" title="Incorrect (Backspace)">
                        <X size={18} strokeWidth={3}/>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-center pb-10">
        <Pagination currentPage={page} totalPages={Math.ceil(pendingItems.length/ITEMS_PER_PAGE)} onPageChange={setPage} />
      </div>
    </div>
  );
};
export default AnnotationPage;