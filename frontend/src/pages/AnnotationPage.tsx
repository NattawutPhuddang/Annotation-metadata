import React, { useState, useEffect } from 'react';
import { Play, Pause, Check, X } from 'lucide-react';
import { AudioItem } from '../types';
import { Pagination } from '../components/Pagination';
import { TokenizedText } from '../components/TokenizedText'; // Import ใหม่

interface AnnotationPageProps {
  pendingItems: AudioItem[];
  onDecision: (item: AudioItem, status: 'correct' | 'incorrect') => void;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  onInspectText: (text: string) => Promise<string[]>; // แก้ Type เป็น Promise
}

const ITEMS_PER_PAGE = 15;

const AnnotationPage: React.FC<AnnotationPageProps> = ({
  pendingItems,
  onDecision,
  playAudio,
  playingFile,
  onInspectText
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const totalPages = Math.ceil(pendingItems.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
  }, [pendingItems.length, totalPages, currentPage]);

  const currentItems = pendingItems.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  if (pendingItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Check size={48} className="mb-4 text-emerald-300" />
        <p className="text-lg font-medium text-slate-600">ตรวจสอบครบทุกรายการแล้ว!</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
          <span className="w-2 h-8 bg-indigo-400 rounded-full"></span>
          รอตรวจสอบ ({pendingItems.length})
        </h2>
      </div>

      <div className="card-content">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center w-16">#</th>
                <th>ชื่อไฟล์</th>
                <th className="text-center w-20">เสียง</th>
                <th>ข้อความ (คลิกเพื่อดูคำ)</th>
                <th className="text-center w-40">ตรวจสอบ</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, idx) => {
                const globalIdx = (safePage - 1) * ITEMS_PER_PAGE + idx;
                const isPlaying = playingFile === item.filename;
                return (
                  <tr key={item.filename}>
                    <td className="text-center text-slate-400">{globalIdx + 1}</td>
                    <td className="text-mono text-sm">{item.filename}</td>
                    <td className="text-center">
                      <div className="flex-center">
                        <button onClick={() => playAudio(item)} className={`btn-play ${isPlaying ? 'active' : ''}`}>
                          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="align-top pt-4"> 
                      {/* ใช้ Component ใหม่ตรงนี้ */}
                      <TokenizedText text={item.text} onInspect={onInspectText} />
                    </td>
                    <td className="text-center align-top pt-4">
                      <div className="flex-center">
                        <button onClick={() => onDecision(item, 'correct')} className="btn-action btn-check"><Check size={20} /></button>
                        <button onClick={() => onDecision(item, 'incorrect')} className="btn-action btn-cross"><X size={20} /></button>
                      </div>
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

export default AnnotationPage;