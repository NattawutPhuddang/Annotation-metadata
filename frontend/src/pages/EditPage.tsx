import React, { useState } from 'react';
import { Check, Download, Scissors } from 'lucide-react';
import { AudioItem } from '../types';
import { Pagination } from '../components/Pagination';
import { WaveformPlayer } from '../components/WaveformPlayer';

interface Props {
  data: AudioItem[];
  onSaveCorrection: (item: AudioItem, newText: string) => void;
  onDownload: (data: AudioItem[], filename: string) => void;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  onInspectText: (text: string) => Promise<string[]>;
}

const ITEMS_PER_PAGE = 15;

const EditPage: React.FC<Props> = ({ data, onSaveCorrection, onDownload, playAudio, playingFile, onInspectText }) => {
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [tokens, setTokens] = useState<Record<string, string[]>>({});
  const items = data.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, fn: string, val: string) => {
    if (e.key === 'F2' || (e.ctrlKey && e.key === 'b')) {
      e.preventDefault();
      const input = e.currentTarget;
      const s = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const sel = val.substring(s, end);
      if (sel) {
        const newVal = val.substring(0, s) + `(${sel},)` + val.substring(end);
        setEdits(prev => ({ ...prev, [fn]: newVal }));
        setTimeout(() => { input.setSelectionRange(s + sel.length + 2, s + sel.length + 2); }, 0);
      }
    }
  };

  const showTokens = async (fn: string, text: string) => {
    if (tokens[fn]) { setTokens(prev => { const c = {...prev}; delete c[fn]; return c; }); return; }
    const res = await onInspectText(text);
    setTokens(prev => ({ ...prev, [fn]: res }));
  };

  if (data.length === 0) return <div className="text-center p-10 text-slate-400">ไม่มีรายการแก้ไข</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold text-rose-600">Fail ({data.length})</h2>
        <button onClick={() => onDownload(data, 'fail.tsv')} className="btn-primary bg-rose-500"><Download size={18} className="mr-2"/> Download</button>
      </div>
      <div className="card-content border-rose-100">
        <table className="data-table w-full">
          <thead><tr><th className="w-16">#</th><th>Audio</th><th>Edit Text</th><th className="w-20">Save</th></tr></thead>
          <tbody>
            {items.map((item, idx) => {
              const val = edits[item.filename] ?? item.text;
              return (
                <tr key={item.filename}>
                  <td className="text-center text-slate-400 pt-4">{(page-1)*ITEMS_PER_PAGE + idx + 1}</td>
                  <td className="p-2 align-top" style={{minWidth: '300px'}}>
                    <div className="text-xs text-slate-400 font-mono mb-1">{item.filename}</div>
                    {item.audioPath && (
                      <WaveformPlayer 
                        audioPath={`http://localhost:3001/api/audio/${encodeURIComponent(item.audioPath)}`}
                        isPlaying={playingFile === item.filename}
                        onPlayChange={(p) => { if (p !== (playingFile === item.filename)) playAudio(item); }}
                      />
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <input 
                        className="w-full border border-rose-200 rounded px-3 py-2 focus:ring-2 focus:ring-rose-200 outline-none"
                        value={val}
                        onChange={e => setEdits(prev => ({...prev, [item.filename]: e.target.value}))}
                        onKeyDown={e => handleKey(e, item.filename, val)}
                      />
                      <button onClick={()=>showTokens(item.filename, val)} className="p-2 text-slate-400 hover:text-indigo-500 border rounded"><Scissors size={18}/></button>
                    </div>
                    {tokens[item.filename] && (
                      <div className="flex flex-wrap gap-1 mt-2 p-2 bg-slate-50 rounded">
                        {tokens[item.filename].map((t,i) => <span key={i} className="px-2 py-0.5 bg-white border rounded text-sm">{t}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="text-center align-top pt-2">
                    <button onClick={() => { onSaveCorrection(item, val); setEdits(p => { const c={...p}; delete c[item.filename]; return c; }); }} className="btn-action bg-indigo-50 text-indigo-600"><Check/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalPages={Math.ceil(data.length/ITEMS_PER_PAGE)} onPageChange={setPage} />
    </div>
  );
};
export default EditPage;