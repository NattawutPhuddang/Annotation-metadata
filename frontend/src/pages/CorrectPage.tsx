import React, { useState } from 'react';
import { X, Download } from 'lucide-react';
import { AudioItem } from '../types';
import { Pagination } from '../components/Pagination';
import { TokenizedText } from '../components/TokenizedText';
import { WaveformPlayer } from '../components/WaveformPlayer';

interface Props {
  data: AudioItem[];
  onMoveToFail: (item: AudioItem) => void;
  onDownload: (data: AudioItem[], filename: string) => void;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  onInspectText: (text: string) => Promise<string[]>;
}

const ITEMS_PER_PAGE = 15;

const CorrectPage: React.FC<Props> = ({ data, onMoveToFail, onDownload, playAudio, playingFile, onInspectText }) => {
  const [page, setPage] = useState(1);
  const items = data.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (data.length === 0) return <div className="text-center p-10 text-slate-400">ยังไม่มีรายการที่ถูกต้อง</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold text-emerald-600">Correct ({data.length})</h2>
        <button onClick={() => onDownload(data, 'Correct.tsv')} className="btn-primary bg-emerald-500"><Download size={18} className="mr-2"/> Download</button>
      </div>
      <div className="card-content border-emerald-100">
        <table className="data-table w-full">
          <thead><tr><th className="w-16">#</th><th>Audio</th><th>Text</th><th className="w-20">Revert</th></tr></thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.filename}>
                <td className="text-center text-slate-400">{(page-1)*ITEMS_PER_PAGE + idx + 1}</td>
                <td className="p-2" style={{minWidth: '300px'}}>
                  <div className="text-xs text-slate-400 font-mono mb-1">{item.filename}</div>
                  {item.audioPath && (
                    <WaveformPlayer 
                      audioPath={`http://localhost:3001/api/audio/${encodeURIComponent(item.audioPath)}`}
                      isPlaying={playingFile === item.filename}
                      onPlayChange={(p) => { if (p !== (playingFile === item.filename)) playAudio(item); }}
                    />
                  )}
                </td>
                <td className="align-top pt-4"><TokenizedText text={item.text} onInspect={onInspectText} /></td>
                <td className="text-center align-middle">
                  <button onClick={() => onMoveToFail(item)} className="btn-action text-rose-500 hover:bg-rose-50"><X/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalPages={Math.ceil(data.length/ITEMS_PER_PAGE)} onPageChange={setPage} />
    </div>
  );
};
export default CorrectPage;