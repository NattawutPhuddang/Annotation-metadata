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

const ITEMS_PER_PAGE = 10;

const AnnotationPage: React.FC<Props> = ({ pendingItems, onDecision, playAudio, playingFile, onInspectText }) => {
  const [page, setPage] = useState(1);
  const items = pendingItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const first = items[0];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!first) return;
      if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); playAudio(first); }
      if (e.code === 'Enter') { e.preventDefault(); onDecision(first, 'correct'); }
      if (e.code === 'Backspace') { e.preventDefault(); onDecision(first, 'incorrect'); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [first, playAudio, onDecision]);

  if (pendingItems.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="w-16 h-16 bg-green-50 text-green-400 rounded-full flex items-center justify-center mb-4 shadow-sm">
        <Check size={32} />
      </div>
      <h3 className="text-xl font-semibold text-slate-600">All caught up!</h3>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="minimal-card mb-8">
        <table className="custom-table">
          <thead>
            <tr>
              <th className="w-16 text-center">No.</th>
              <th className="w-[40%]">Audio Source</th>
              <th>Transcript</th>
              <th className="w-32 text-center">Decision</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isPlaying = playingFile === item.filename;
              return (
                <tr key={item.filename} className={`row-hover ${idx === 0 && !isPlaying ? 'bg-indigo-50/30' : ''}`}>
                  <td className="text-center align-middle">
                    <span className={`text-xs font-mono ${idx===0 ? 'text-primary font-semibold' : 'text-slate-300'}`}>
                      {(page-1)*ITEMS_PER_PAGE + idx + 1}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                       <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-500 font-medium truncate max-w-[250px]" title={item.filename}>
                            {item.filename}
                          </div>
                          <button 
                            onClick={() => playAudio(item)}
                            className={`btn-icon w-8 h-8 text-primary hover:bg-indigo-100 ${isPlaying ? 'bg-indigo-50' : ''}`}
                          >
                             {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5"/>}
                          </button>
                       </div>
                       
                       {/* Line Player */}
                       {item.audioPath ? (
                          <WaveformPlayer
                            audioUrl={`http://localhost:3001/api/audio/${encodeURIComponent(item.audioPath)}`}
                            isPlaying={isPlaying}
                            onPlayChange={(p) => { if (p !== isPlaying) playAudio(item); }}
                            progressColor="#818cf8" // Theme Color
                            height="h-1.5"
                          />
                       ) : <div className="text-xs text-red-300 h-2">Audio missing</div>}
                    </div>
                  </td>
                  <td className="align-middle">
                    <div className={`text-token pl-4 border-l-2 ${idx===0 ? 'border-primary' : 'border-indigo-100'} py-1`}>
                      <TokenizedText text={item.text} onInspect={onInspectText} isExpanded={idx===0}/>
                    </div>
                  </td>
                  <td className="align-middle">
                    <div className="flex justify-center gap-3">
                      <button onClick={()=>onDecision(item,'correct')} className="btn-icon btn-check" title="Correct">
                        <Check size={20} strokeWidth={2.5}/>
                      </button>
                      <button onClick={()=>onDecision(item,'incorrect')} className="btn-icon btn-cross" title="Incorrect">
                        <X size={20} strokeWidth={2.5}/>
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