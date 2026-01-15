import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
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

const ITEMS_PER_PAGE = 15;

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

  if (pendingItems.length === 0) return <div className="text-center p-10 text-slate-400">ตรวจสอบครบแล้ว!</div>;

  return (
    <div className="animate-fade-in">
      <div className="card-content">
        <table className="data-table w-full">
          <thead>
            <tr><th className="w-16">#</th><th>Audio</th><th>Text</th><th className="w-32">Action</th></tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isPlaying = playingFile === item.filename;
              return (
                <tr key={item.filename}>
                  <td className="text-center text-slate-400">{(page-1)*ITEMS_PER_PAGE + idx + 1}</td>
                  <td className="p-2" style={{minWidth: '350px'}}>
                    <div className="text-xs text-slate-400 font-mono mb-1">{item.filename}</div>
                    {item.audioPath ? (
                      <WaveformPlayer 
                        audioPath={`http://localhost:3001/api/audio/${encodeURIComponent(item.audioPath)}`}
                        isPlaying={isPlaying}
                        onPlayChange={(p) => { if (p !== isPlaying) playAudio(item); }}
                      />
                    ) : <span className="text-red-400">File not found</span>}
                  </td>
                  <td className="align-top pt-4">
                    <TokenizedText text={item.text} onInspect={onInspectText} isExpanded={idx===0}/>
                  </td>
                  <td className="text-center align-middle">
                    <div className="flex justify-center gap-2">
                      <button onClick={()=>onDecision(item,'correct')} className="btn-action bg-emerald-100 text-emerald-600"><Check/></button>
                      <button onClick={()=>onDecision(item,'incorrect')} className="btn-action bg-rose-100 text-rose-600"><X/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalPages={Math.ceil(pendingItems.length/ITEMS_PER_PAGE)} onPageChange={setPage} />
    </div>
  );
};
export default AnnotationPage;