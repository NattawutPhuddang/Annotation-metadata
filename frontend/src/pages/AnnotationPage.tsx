import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { AudioItem } from '../types';
import { Pagination } from '../components/Pagination';
import { TokenizedText } from '../components/TokenizedText';
import { WaveformPlayer } from '../components/WaveformPlayer'; // นี่คือตัวใหม่ที่เราแก้เป็น AudioPlayer แล้ว

interface AnnotationPageProps {
  pendingItems: AudioItem[];
  onDecision: (item: AudioItem, status: 'correct' | 'incorrect') => void;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  onInspectText: (text: string) => Promise<string[]>;
}

const ITEMS_PER_PAGE = 15;

const AnnotationPage: React.FC<AnnotationPageProps> = ({
  pendingItems, onDecision, playAudio, playingFile, onInspectText
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const currentItems = pendingItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const firstItem = currentItems[0];

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (!firstItem) return;
      if (e.code === 'Space') {
        e.preventDefault();
        playAudio(firstItem);
      } else if (e.code === 'Enter') {
        e.preventDefault();
        onDecision(firstItem, 'correct');
      } else if (e.code === 'Backspace') {
        e.preventDefault();
        onDecision(firstItem, 'incorrect');
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [firstItem, playAudio, onDecision]);

  if (pendingItems.length === 0) return <div className="text-center p-10 text-slate-400">หมดแล้วครับ!</div>;

  return (
    <div className="animate-fade-in">
      <div className="card-content">
        <table className="data-table w-full">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="p-3 w-16 text-center">#</th>
              <th className="p-3">Audio</th>
              <th className="p-3">Text</th>
              <th className="p-3 w-32 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, idx) => {
               const isPlaying = playingFile === item.filename;
               return (
                 <tr key={item.filename} className="border-b hover:bg-slate-50">
                   <td className="p-3 text-center text-slate-400">{(currentPage-1)*ITEMS_PER_PAGE + idx + 1}</td>
                   <td className="p-3" style={{minWidth: '350px'}}>
                     <div className="mb-1 text-xs text-slate-400 font-mono">{item.filename}</div>
                     {item.audioPath ? (
                       <WaveformPlayer 
                         audioPath={`http://localhost:3001/api/audio/${encodeURIComponent(item.audioPath)}`}
                         isPlaying={isPlaying}
                         onPlayChange={(playing) => {
                            // Logic: ถ้า Player บอกว่าเล่น แต่ State ยังไม่เล่น -> สั่งเล่น
                            // ถ้า Player บอกหยุด -> สั่งหยุด
                            if (playing && !isPlaying) playAudio(item);
                            if (!playing && isPlaying) playAudio(item);
                         }}
                       />
                     ) : <span className="text-red-400 text-sm">File not found</span>}
                   </td>
                   <td className="p-3 align-top pt-5">
                      <TokenizedText text={item.text} onInspect={onInspectText} isExpanded={idx===0}/>
                   </td>
                   <td className="p-3 text-center align-middle">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => onDecision(item, 'correct')} className="p-2 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"><Check size={18}/></button>
                        <button onClick={() => onDecision(item, 'incorrect')} className="p-2 bg-rose-100 text-rose-600 rounded hover:bg-rose-200"><X size={18}/></button>
                      </div>
                   </td>
                 </tr>
               );
            })}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={currentPage} totalPages={Math.ceil(pendingItems.length / ITEMS_PER_PAGE)} onPageChange={setCurrentPage} />
    </div>
  );
};

export default AnnotationPage;