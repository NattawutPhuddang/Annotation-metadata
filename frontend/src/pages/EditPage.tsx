import React, { useState } from 'react';
import { Play, Pause, Check, Download, Search, Scissors, Loader2 } from 'lucide-react';
import { AudioItem } from '../types';
import { Pagination } from '../components/Pagination';

interface EditPageProps {
  data: AudioItem[];
  onSaveCorrection: (item: AudioItem, newText: string) => void;
  onDownload: (data: AudioItem[], filename: string) => void;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  onInspectText: (text: string) => Promise<string[]>;
}

const ITEMS_PER_PAGE = 15;

const EditPage: React.FC<EditPageProps> = ({
  data, onSaveCorrection, onDownload, playAudio, playingFile, onInspectText
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [editingText, setEditingText] = useState<{ [key: string]: string }>({});
  
  // State สำหรับเก็บ tokens ของแต่ละแถว (ใช้ filename เป็น key)
  const [rowTokens, setRowTokens] = useState<{ [key: string]: string[] | null }>({});
  const [loadingRows, setLoadingRows] = useState<{ [key: string]: boolean }>({});

  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const currentItems = data.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleTextChange = (filename: string, text: string) => {
    setEditingText(prev => ({ ...prev, [filename]: text }));
    // เมื่อแก้ข้อความ ให้ลบ tokens เก่าออก เพื่อให้ user ต้องกด inspect ใหม่
    setRowTokens(prev => {
      const copy = { ...prev };
      delete copy[filename];
      return copy;
    });
  };

  const handleInspectRow = async (filename: string, text: string) => {
    // Toggle ปิดถ้าเปิดอยู่
    if (rowTokens[filename]) {
      setRowTokens(prev => {
        const copy = { ...prev };
        delete copy[filename];
        return copy;
      });
      return;
    }

    setLoadingRows(prev => ({ ...prev, [filename]: true }));
    const tokens = await onInspectText(text);
    setRowTokens(prev => ({ ...prev, [filename]: tokens }));
    setLoadingRows(prev => {
      const copy = { ...prev };
      delete copy[filename];
      return copy;
    });
  };

  const handleSave = (item: AudioItem) => {
    const newText = editingText[item.filename] ?? item.text;
    onSaveCorrection(item, newText);
    setEditingText(prev => { const c = {...prev}; delete c[item.filename]; return c; });
    setRowTokens(prev => { const c = {...prev}; delete c[item.filename]; return c; });
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Search size={48} className="mb-4 opacity-20" />
        <p>ไม่มีรายการที่ผิด</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
       <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
          <span className="w-2 h-8 bg-rose-400 rounded-full"></span>
          รายการที่ผิด ({data.length})
        </h2>
        <button onClick={() => onDownload(data, 'fail.tsv')} className="btn-primary" style={{ width: 'auto', padding: '0.5rem 1.5rem', backgroundColor: 'var(--danger-color)' }}>
          <Download size={18} className="mr-2" /> Download fail.tsv
        </button>
      </div>

      <div className="card-content" style={{ borderColor: 'var(--danger-light)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center w-16">#</th>
                <th>ชื่อไฟล์</th>
                <th className="text-center w-20">เสียง</th>
                <th>แก้ไขข้อความ</th>
                <th className="text-center w-32">บันทึก</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, idx) => {
                const globalIdx = (safePage - 1) * ITEMS_PER_PAGE + idx;
                const isPlaying = playingFile === item.filename;
                const val = editingText[item.filename] !== undefined ? editingText[item.filename] : item.text;
                const tokens = rowTokens[item.filename];
                const isLoading = loadingRows[item.filename];

                return (
                  <tr key={item.filename}>
                    <td className="text-center text-slate-400 align-top pt-5">{globalIdx + 1}</td>
                    <td className="text-mono text-sm align-top pt-5">{item.filename}</td>
                    <td className="text-center align-top pt-4">
                      <div className="flex-center">
                        <button onClick={() => playAudio(item)} className={`btn-play ${isPlaying ? 'active' : ''}`} style={{ backgroundColor: isPlaying ? 'var(--danger-color)' : 'var(--danger-bg)', color: isPlaying ? 'white' : 'var(--danger-color)' }}>
                          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="pt-3 pb-3">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleTextChange(item.filename, e.target.value)}
                          className="input-cell"
                          style={{ borderColor: 'var(--danger-light)' }}
                        />
                        <button
                          onClick={() => handleInspectRow(item.filename, val)}
                          className={`p-2 rounded-lg transition-colors border ${tokens ? 'bg-indigo-50 border-indigo-200 text-indigo-500' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-200'}`}
                          title="ดูการตัดคำ"
                        >
                          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Scissors size={18} />}
                        </button>
                      </div>
                      
                      {(tokens || isLoading) && (
                        <div className="mt-3 animate-fade-in relative">
                           {/* ลูกศรชี้ขึ้น */}
                           <div className="absolute -top-2 left-6 w-4 h-4 bg-sky-50 border-t border-l border-sky-100 transform rotate-45 z-10"></div>
                           
                           <div className="bg-white rounded-xl p-4 border border-sky-100 shadow-sm relative z-0">
                             {isLoading ? (
                               <div className="flex items-center gap-2 text-sky-500 text-sm">
                                 <Loader2 size={16} className="animate-spin" />
                                 กำลังตัดคำ...
                               </div>
                             ) : (
                               // ใช้ Class เดียวกับข้างบน
                               <div className="token-grid" style={{ marginTop: 0, padding: '0.5rem', backgroundColor: 'transparent', border: 'none' }}>
                                 {tokens && tokens.map((t, i) => (
                                   <div key={i} className="token-card" style={{ minWidth: 'auto', padding: '0.25rem 0.75rem' }}>
                                     <span className="token-text" style={{ fontSize: '0.9rem' }}>{t}</span>
                                     <span className="token-badge">{i + 1}</span>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                        </div>
                      )}
                    </td>
                    <td className="text-center align-top pt-4">
                      <button onClick={() => handleSave(item)} className="btn-save"><Check size={16} /> บันทึก</button>
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

export default EditPage;