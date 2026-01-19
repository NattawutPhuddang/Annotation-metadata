import React, { useState, useEffect } from 'react';
import { Folder, FileAudio, CornerLeftUp, Check, X, Loader2 } from 'lucide-react';

interface DirectoryPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

interface DirContent {
  path: string;
  parent: string;
  folders: string[];
  files: string[];
}

export const DirectoryPicker: React.FC<DirectoryPickerProps> = ({ isOpen, onClose, onSelect, initialPath }) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath || '');
  const [content, setContent] = useState<DirContent | null>(null);
  const [loading, setLoading] = useState(false);

  // โหลดข้อมูลเมื่อเปิด Modal หรือเปลี่ยน Path
  useEffect(() => {
    if (isOpen) {
      fetchDir(currentPath);
    }
  }, [isOpen, currentPath]);

  const fetchDir = async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3003/api/list-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPath: path })
      });
      const data = await res.json();
      if (data.path) {
        setContent(data);
        // ถ้า path ว่าง (โหลดครั้งแรก) ให้อัปเดต currentPath ตามที่ server ตอบกลับมา
        if (!path) setCurrentPath(data.path);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="bg-indigo-50 p-6 border-b border-indigo-100">
          <h3 className="text-xl font-bold text-indigo-800 flex items-center gap-2">
            <Folder className="text-indigo-500" /> เลือกโฟลเดอร์ไฟล์เสียง
          </h3>
          <div className="mt-2 text-sm text-slate-600 bg-white/50 p-2 rounded-lg border border-indigo-100 font-mono truncate">
            {content?.path || 'Loading...'}
          </div>
        </div>

        {/* Body (List) */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          {loading ? (
            <div className="flex justify-center py-10 text-indigo-400">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : (
            <div className="space-y-2">
              {/* ปุ่มย้อนกลับ */}
              <button 
                onClick={() => setCurrentPath(content?.parent || '')}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all text-slate-500"
                disabled={!content?.parent}
              >
                <CornerLeftUp size={20} /> <span className="font-medium">.. (ย้อนกลับ)</span>
              </button>

              {/* รายชื่อโฟลเดอร์ */}
              {content?.folders.map(folder => (
                <button
                  key={folder}
                  onClick={() => {
                    // ตรวจสอบ Separator ว่าควรเป็น / หรือ \ (หรือใช้ / ไปเลย Node.js จัดการได้)
                    const separator = (content.path.endsWith('\\') || content.path.endsWith('/')) ? '' : '/';
                    setCurrentPath(content.path + separator + folder);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group text-left"
                >
                  <div className="bg-indigo-100 text-indigo-500 p-2 rounded-lg group-hover:bg-indigo-200 transition-colors">
                    <Folder size={20} />
                  </div>
                  <span className="text-slate-700 font-medium truncate">{folder}</span>
                </button>
              ))}

              {/* แสดงไฟล์เสียง (กดไม่ได้ แค่โชว์) */}
              {content?.files.map(file => (
                <div key={file} className="flex items-center gap-3 p-3 px-4 opacity-60">
                  <FileAudio size={18} className="text-slate-400" />
                  <span className="text-slate-500 text-sm truncate">{file}</span>
                </div>
              ))}

              {content?.folders.length === 0 && content?.files.length === 0 && (
                <div className="text-center py-8 text-slate-400">โฟลเดอร์ว่างเปล่า</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 font-medium transition-colors"
          >
            ยกเลิก
          </button>
          <button 
            onClick={() => { onSelect(content?.path || ''); onClose(); }}
            className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 transition-transform active:scale-95"
            disabled={!content?.path}
          >
            <Check size={18} /> เลือกโฟลเดอร์นี้
          </button>
        </div>
      </div>
    </div>
  );
};