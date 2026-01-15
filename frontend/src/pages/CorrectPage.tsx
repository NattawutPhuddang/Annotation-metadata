import React, { useState } from 'react';
import { X, Download, Search } from 'lucide-react';
import { AudioItem } from '../types';
import { Pagination } from '../components/Pagination';
import { TokenizedText } from '../components/TokenizedText';
import { WaveformPlayer } from '../components/WaveformPlayer'; // Import Waveform

interface CorrectPageProps {
  data: AudioItem[];
  onMoveToFail: (item: AudioItem) => void;
  onDownload: (data: AudioItem[], filename: string) => void;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  onInspectText: (text: string) => Promise<string[]>;
}

const ITEMS_PER_PAGE = 15;

const CorrectPage: React.FC<CorrectPageProps> = ({
  data, onMoveToFail, onDownload, playAudio, playingFile, onInspectText
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const currentItems = data.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Search size={48} className="mb-4 opacity-20" />
        <p>ยังไม่มีรายการที่ถูกต้อง</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
          <span className="w-2 h-8 bg-emerald-400 rounded-full"></span>
          รายการที่ถูกต้อง ({data.length})
        </h2>
        <button onClick={() => onDownload(data, 'Correct.tsv')} className="btn-primary" style={{ width: 'auto', padding: '0.5rem 1.5rem', backgroundColor: 'var(--success-color)' }}>
          <Download size={18} className="mr-2" /> Download Correct.tsv
        </button>
      </div>

      <div className="card-content" style={{ borderColor: 'var(--success-light)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center w-16">#</th>
                <th>ชื่อไฟล์</th>
                <th className="text-center w-20">เสียง</th>
                <th>ข้อความ</th>
                <th className="text-center w-32">ย้ายไป Fail</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, idx) => {
                const globalIdx = (safePage - 1) * ITEMS_PER_PAGE + idx;
                const isPlaying = playingFile === item.filename;
                return (
                  <tr key={item.filename} className="hover:bg-slate-50">
                    <td className="text-center text-slate-400">{globalIdx + 1}</td>
                    <td className="text-mono text-sm">{item.filename}</td>
                    <td className="align-top pt-2" style={{ minWidth: '300px' }}>
                      {/* ใช้ WaveformPlayer ทุกแถว */}
                      {item.audioPath && (
                        <WaveformPlayer 
                          audioPath={`http://localhost:3001/api/audio/${encodeURIComponent(item.audioPath)}`}
                          isPlaying={isPlaying}
                          onPlayChange={(playing) => {
                             // เมื่อ Waveform เล่น/หยุด ให้แจ้ง App เพื่อคุม State
                             // logic: ถ้ากำลังเล่น (playing=true) ให้บอก App ว่า "เล่นไฟล์นี้นะ"
                             // ถ้าหยุด (playing=false) ให้บอก App ว่า "หยุด" (หรือถ้าเรากดหยุดเอง App ก็จะรู้จากการ toggle)
                             if (playing) {
                               // ถ้า Waveform เริ่มเล่น แต่ State ยังไม่ใช่ไฟล์นี้ ให้สั่งเล่น
                               if (!isPlaying) playAudio(item);
                             } else {
                               // ถ้า Waveform หยุด และ State ยังเป็นไฟล์นี้อยู่ ให้สั่งหยุด
                               if (isPlaying) playAudio(item); 
                             }
                          }}
                        />
                      )}
                    </td>
                    <td className="align-top pt-4">
                       <TokenizedText text={item.text} onInspect={onInspectText} />
                    </td>
                    <td className="text-center align-top pt-4">
                      <button onClick={() => onMoveToFail(item)} className="btn-action hover:bg-rose-50 hover:text-rose-500">
                        <X size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  );
};

export default CorrectPage;