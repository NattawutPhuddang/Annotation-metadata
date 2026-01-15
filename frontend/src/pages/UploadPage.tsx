import React, { useState } from 'react';
import { Upload, FolderOpen, Music, FileText, Search } from 'lucide-react'; // เพิ่ม Search icon
import { AudioItem } from '../types';
import { DirectoryPicker } from '../components/DirectoryPicker'; // Import Modal

interface UploadPageProps {
  metadata: AudioItem[];
  audioPath: string;
  setAudioPath: (path: string) => void;
  onMetadataUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onScan: () => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ 
  metadata, 
  audioPath, 
  setAudioPath, 
  onMetadataUpload, 
  onScan 
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false); // State เปิดปิด Modal

  return (
    <div className="page-container center-content bg-pastel-mix">
      <div className="glass-card">
        <div className="text-center mb-8">
          <div className="icon-box-lg">
            <Music size={32} />
          </div>
          <h1 className="text-title">Audio Annotation</h1>
          <p className="text-subtitle">เตรียมข้อมูลสำหรับตรวจสอบเสียง</p>
        </div>
        
        <div className="space-y-6">
          {/* Upload TSV */}
          <div>
            <label className="upload-area">
              <FileText size={32} style={{ color: '#a5b4fc', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>
                {metadata.length > 0 ? (
                  <span style={{ color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ✓ พร้อมแล้ว {metadata.length} รายการ
                  </span>
                ) : (
                  "อัพโหลดไฟล์ Metadata (.tsv)"
                )}
              </div>
              <input type="file" accept=".tsv" onChange={onMetadataUpload} className="hidden" />
            </label>
          </div>

          {/* Input Path with Browse Button */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 ml-1">โฟลเดอร์ไฟล์เสียง</label>
            <div className="flex gap-2">
              <div className="input-group flex-1">
                <div className="input-icon">
                  <FolderOpen size={20} />
                </div>
                <input
                  type="text"
                  value={audioPath}
                  onChange={(e) => setAudioPath(e.target.value)}
                  className="input-styled"
                  placeholder="C:\Users\Music\..."
                />
              </div>
              {/* ปุ่ม Browse */}
              <button 
                onClick={() => setIsPickerOpen(true)}
                className="px-4 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm flex items-center gap-2 font-medium"
              >
                <Search size={18} /> Browse
              </button>
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={onScan}
            disabled={!metadata.length || !audioPath}
            className="btn-primary"
          >
            เริ่มตรวจสอบ
          </button>
        </div>
      </div>

      {/* Directory Picker Modal */}
      <DirectoryPicker 
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(path) => setAudioPath(path)}
        initialPath={audioPath}
      />
    </div>
  );
};

export default UploadPage;