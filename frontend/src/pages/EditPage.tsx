import React, { useState } from 'react';
import { Check, Download, Play, Pause, Filter, AlertCircle } from 'lucide-react';
import { AudioItem } from '../types';
import { Pagination } from '../components/Pagination';
import { WaveformPlayer } from '../components/WaveformPlayer';
import { TokenizedText } from '../components/TokenizedText';
// ไม่ต้องใช้ DownloadButton แบบ Component เพื่อความยืดหยุ่นในการจัด Layout กับปุ่ม Filter

interface Props {
  data: AudioItem[];
  availableFiles: Set<string>;
  onSaveCorrection: (item: AudioItem, newText: string) => void;
  onDownload: (data: AudioItem[], filename: string) => void;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  onInspectText: (text: string) => Promise<string[]>;
}

const ITEMS_PER_PAGE = 10;

const EditPage: React.FC<Props> = ({ 
  data, 
  availableFiles, 
  onSaveCorrection, 
  onDownload, 
  playAudio, 
  playingFile, 
  onInspectText 
}) => {
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showAllHistory, setShowAllHistory] = useState(false); // 🟢 State สำหรับ Toggle Filter

  // 🟢 Logic การกรอง (Features จาก Docker)
  const displayData = showAllHistory 
    ? data 
    : data.filter(d => availableFiles.has(d.filename));

  const items = displayData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, fn: string, val: string) => {
    if (e.key === 'F2' || (e.ctrlKey && e.key === 'b')) {
      e.preventDefault();
      const input = e.currentTarget;
      const s = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const sel = val.substring(s, end);
      if (sel) {
        const newVal = val.substring(0, s) + `(${sel},)` + val.substring(end);
        setEdits(prev => ({ ...prev, [fn]: newVal }));
        setTimeout(() => { 
            input.focus();
            input.setSelectionRange(s + sel.length + 2, s + sel.length + 2); 
        }, 0);
      }
    }
  };

  return (
    <div className="animate-fade-in">
      {/* --- Header Toolbar (ใช้แบบ Docker เพื่อให้มีปุ่ม Filter) --- */}
      <div className="flex justify-between items-center mb-6 px-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-danger">Needs Correction</h2>
          <span className="px-2 py-1 bg-danger-bg text-danger text-xs font-bold rounded-full">{displayData.length}</span>
        </div>
        
        <div className="flex gap-3">
           {/* 🟢 Toggle Filter Button Group */}
           <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
              <button 
                onClick={() => { setShowAllHistory(false); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${!showAllHistory ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Filter size={12} /> Local Audio Only
              </button>
              <button 
                onClick={() => { setShowAllHistory(true); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${showAllHistory ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Show All
              </button>
           </div>

           {/* ปุ่ม Download */}
           <button onClick={() => onDownload(displayData, 'fail.tsv')} className="btn-icon w-auto px-4 gap-2 text-sm bg-danger text-white hover:bg-rose-600 shadow-none">
             <Download size={16}/> Download TSV
           </button>
        </div>
      </div>

      <div className="minimal-card mb-8">
        <table className="custom-table">
          <thead>
            <tr>
              <th className="w-16 text-center">No.</th>
              <th className="w-[30%]">Audio Source</th>
              <th>Correction & Tokens</th>
              <th className="w-20 text-center">Save</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const val = edits[item.filename] ?? item.text;
              const isPlaying = playingFile === item.filename;
              const hasAudio = availableFiles.has(item.filename); // เช็คไฟล์จริง

              return (
                <tr key={item.filename} className={`row-hover ${!hasAudio ? 'opacity-60 bg-slate-50/50' : ''}`}>
                  <td className="text-center align-middle">
                    <span className="text-xs font-mono text-slate-300">{(page-1)*ITEMS_PER_PAGE + idx + 1}</span>
                  </td>
                  <td className="align-top pt-4">
                    <div className="flex flex-col gap-2">
                       <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-500 font-medium truncate" title={item.filename}>
                            {item.filename}
                          </div>
                          {hasAudio && (
                            <button 
                              onClick={() => playAudio(item)}
                              className={`btn-icon w-8 h-8 text-danger hover:bg-rose-50 ${isPlaying ? 'bg-rose-50' : ''}`}
                            >
                              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5"/>}
                            </button>
                          )}
                       </div>
                       
                       {/* Waveform Player: ใช้สีแดง (rose) สำหรับหน้า Fail */}
                       {item.audioPath && hasAudio ? (
                          <div className="bg-rose-50/30 rounded-lg p-2 border border-rose-100/50">
                             <WaveformPlayer
                               audioUrl={item.audioPath}
                               isPlaying={isPlaying}
                               onPlayChange={(p: boolean) => { if (p !== isPlaying) playAudio(item); }}
                               progressColor="#f43f5e"
                               height="h-3"
                             />
                          </div>
                       ) : <span className="text-xs text-rose-300/50 italic flex items-center gap-1"><AlertCircle size={10}/> File not on disk</span>}
                    </div>
                  </td>
                  <td className="align-top pt-4">
                    <div className="mb-4">
                      <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block tracking-wider">Edit Text</label>
                      <textarea
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition-all font-mono text-base leading-relaxed"
                        style={{ width: '530px', height: '45px', resize: 'none' }}
                        value={val}
                        onChange={e => setEdits(prev => ({...prev, [item.filename]: e.target.value}))}
                        onKeyDown={e => handleKey(e, item.filename, val)}
                        placeholder="Type correction here..."
                        spellCheck={false}
                      />
                    </div>
                    
                    <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block tracking-wider">Inspect Tokens</label>
                          <TokenizedText 
                            text={val} 
                            onInspect={onInspectText} 
                            isExpanded={false}
                          />
                    </div>
                  </td>
                  <td className="text-center align-middle">
                    <button 
                      onClick={() => { onSaveCorrection(item, val); setEdits(p => { const c={...p}; delete c[item.filename]; return c; }); }} 
                      className="btn-icon bg-indigo-50 text-indigo-600 hover:bg-indigo-500 hover:text-white w-10 h-10 shadow-sm hover:shadow-md"
                      title="Save Correction"
                    >
                      <Check size={20} strokeWidth={2.5}/>
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
export default EditPage;