import React, { useState } from 'react';
import { X, Download, Play, Pause, Filter, FileText } from 'lucide-react';
import { AudioItem } from '../types';
import { Pagination } from '../components/Pagination';
import { TokenizedText } from '../components/TokenizedText';
import { WaveformPlayer } from '../components/WaveformPlayer';
// ถ้ามี Component DownloadButton จาก dev จะ import มาใช้ก็ได้ แต่ในที่นี้ใช้ปุ่ม HTML ปกติเพื่อความชัวร์ของ Layout

interface Props {
  data: AudioItem[];
  availableFiles: Set<string>; // จำเป็นสำหรับ Docker Logic
  onMoveToFail: (item: AudioItem) => void;
  onDownload: (data: AudioItem[], filename: string) => void;
  onDownloadPersonal: () => void; // 🟢 รับ Props ใหม่ (Docker)
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  onInspectText: (text: string) => Promise<string[]>;
}

const ITEMS_PER_PAGE = 10;

const CorrectPage: React.FC<Props> = ({ 
  data, 
  availableFiles, 
  onMoveToFail, 
  onDownload, 
  onDownloadPersonal, 
  playAudio, 
  playingFile, 
  onInspectText 
}) => {
  const [page, setPage] = useState(1);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // --- Logic การกรอง (จาก Docker) ---
  const displayData = showAllHistory 
    ? data 
    : data.filter(d => availableFiles.has(d.filename));

  const items = displayData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // --- Empty State (จาก Dev แต่ปรับให้รับกับ Logic Filter) ---
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 animate-fade-in">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <Download size={32} className="text-slate-300" />
        </div>
        No correct items yet.
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* --- Header & Toolbar (ใช้ของ Docker เพราะมีปุ่มครบกว่า) --- */}
      <div className="flex items-center justify-between mb-6 w-full">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-success">Correct Items</h2>
          <span className="px-2 py-1 bg-success-bg text-success text-xs font-bold rounded-full border border-emerald-100">
            {displayData.length}
          </span>
        </div>
        
        <div className="flex gap-2">
           {/* Filter Toggle */}
           <div className="bg-slate-100 p-1 rounded-lg flex gap-1 mr-2">
              <button 
                onClick={() => { setShowAllHistory(false); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${!showAllHistory ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Filter size={12} /> Local Audio
              </button>
              <button 
                onClick={() => { setShowAllHistory(true); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${showAllHistory ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Show All
              </button>
           </div>

           {/* 🟢 ปุ่ม Download My Log (Personal) */}
           <button 
             onClick={onDownloadPersonal} 
             className="btn-icon w-auto px-3 gap-2 text-sm bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 shadow-sm"
             title="Download ONLY my contribution"
           >
             <FileText size={16}/> My Log
           </button>

           {/* ปุ่ม Download Global */}
           <button onClick={() => onDownload(displayData, 'Correct.tsv')} className="btn-icon w-auto px-4 gap-2 text-sm bg-success text-white hover:bg-emerald-600 shadow-none">
            <Download size={16}/> Global TSV
           </button>
        </div>
      </div>

      <div className="minimal-card mb-8">
        <table className="custom-table">
          <thead>
            <tr>
              <th className="w-16 text-center">No.</th>
              <th className="w-[40%]">Audio Source</th>
              <th>Transcript</th>
              <th className="w-20 text-center">Revert</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isPlaying = playingFile === item.filename;
              // ใช้ Logic เช็คไฟล์ของ Docker เพื่อความแม่นยำ
              const hasAudio = availableFiles.has(item.filename);
              
              return (
                <tr key={item.filename} className={`row-hover ${!hasAudio ? 'opacity-60 bg-slate-50/50' : ''}`}>
                  <td className="text-center align-middle">
                    <span className="text-xs font-mono text-slate-300">
                      {(page - 1) * ITEMS_PER_PAGE + idx + 1}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                       <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-500 font-medium truncate" title={item.filename}>
                            {item.filename}
                          </div>
                          {hasAudio && (
                            <button 
                              onClick={() => playAudio(item)}
                              className={`btn-icon w-8 h-8 text-success hover:bg-emerald-100 ${isPlaying ? 'bg-emerald-50' : ''}`}
                            >
                              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5"/>}
                            </button>
                          )}
                       </div>
                       
                       {/* Waveform logic (ผสม: ใช้เงื่อนไข Docker แต่ใช้ Props สีสวยๆ จาก Dev) */}
                       {item.audioPath && hasAudio ? (
                          <WaveformPlayer
                            audioUrl={item.audioPath}
                            isPlaying={isPlaying}
                            onPlayChange={(p: boolean) => { if (p !== isPlaying) playAudio(item); }}
                            progressColor="#10b981" 
                          />
                       ) : (
                          <span className="text-xs text-slate-300 italic flex items-center gap-1">
                            {hasAudio ? <span className="text-emerald-300">Audio ready</span> : <><X size={10}/> File not on disk</>}
                          </span>
                       )}
                    </div>
                  </td>
                  <td className="align-middle">
                    <div className="text-token pl-4 border-l-2 border-emerald-100 py-1">
                      <TokenizedText
                        text={item.text}
                        onInspect={onInspectText}
                      />
                    </div>
                  </td>
                  <td className="text-center align-middle">
                    <button
                      onClick={async () => await onMoveToFail(item)}
                      className="btn-icon bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white"
                    >
                      <X size={20} strokeWidth={2.5} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center pb-10">
        <Pagination currentPage={page} totalPages={Math.ceil(displayData.length/ITEMS_PER_PAGE)} onPageChange={setPage} />
      </div>
    </div>
  );
};
export default CorrectPage;
