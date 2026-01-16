import React, { useRef } from 'react';
import { 
  Music, 
  FileText, 
  FolderOpen, 
  Loader2, 
  CheckCircle2, 
  UploadCloud,
  ArrowRight
} from 'lucide-react';
import { AudioItem } from '../types';
// อย่าลืม import ไฟล์ css ในไฟล์ entry point หลัก (เช่น main.tsx หรือ App.tsx) 
// import './app.css'; 

interface UploadPageProps {
  metadata: AudioItem[];
  audioPath: string;
  setAudioPath: (path: string) => void;
  onMetadataUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onScan: () => void;
  isScanning?: boolean;
  onFolderSelect: (files: FileList) => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ 
  metadata, 
  audioPath, 
  onMetadataUpload, 
  onScan,
  isScanning = false,
  onFolderSelect
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check Status
  const isMetaReady = metadata.length > 0;
  const isAudioReady = audioPath && audioPath !== '';
  const canStart = isMetaReady && isAudioReady && !isScanning;

  // Handlers
  const handleFolderClick = () => fileInputRef.current?.click();
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFolderSelect(e.target.files);
    }
  };

  return (
    // 1. ใช้ Class: page-container, center-content, bg-pastel-mix
    <div className="page-container center-content bg-pastel-mix">
      
      {/* 2. ใช้ Class: glass-card */}
      <div className="glass-card">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          {/* icon-box-lg */}
          <div className="icon-box-lg">
            <Music size={32} strokeWidth={2} />
          </div>
          {/* text-title & text-subtitle */}
          <h1 className="text-title">Audio Annotator</h1>
          <p className="text-subtitle">Setup your workspace to begin</p>
        </div>

        <div className="space-y-6" >
          
          {/* --- Step 1: Metadata Upload --- */}
          {/* ใช้ Class: upload-area */}
          <label 
            className="upload-area group relative"
            style={isMetaReady ? { 
              borderColor: 'var(--success)', 
              backgroundColor: 'var(--success-bg)' 
            } : {}}
          >
            <div className={`mb-3 transition-colors ${isMetaReady ? 'text-emerald-600' : 'text-slate-400'}`}>
              {isMetaReady ? <CheckCircle2 size={40} /> : <FileText size={40} />}
            </div>
            
            <div className="text-center z-10">
              <span className={`text-sm font-bold block ${isMetaReady ? 'text-emerald-700' : 'text-slate-600'}`}>
                {isMetaReady ? 'Metadata Loaded' : 'Upload Metadata'}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">
                {isMetaReady ? `${metadata.length} items ready` : 'Drag & drop or click to browse .tsv'}
              </span>
            </div>

            {/* Hidden Input */}
            <input type="file" accept=".tsv" onChange={onMetadataUpload} className="hidden" />
            
            {!isMetaReady && (
              <div className="absolute right-4 top-4 text-slate-300 group-hover:text-indigo-400 transition-colors">
                <UploadCloud size={20} />
              </div>
            )}
          </label>


          {/* --- Step 2: Audio Folder Selection --- */}
          {/* ใช้ Class: input-group & input-styled */}
          <div className="relative" style={{ marginTop: '1.5rem' }}>
            <div 
              className="input-group cursor-pointer" 
              onClick={handleFolderClick}
            >
              <div className="input-icon" style={{ color: isAudioReady ? 'var(--success)' : 'var(--text-light)' }}>
                {isAudioReady ? <CheckCircle2 size={20} /> : <FolderOpen size={20} />}
              </div>
              <input
                type="text"
                readOnly
                value={isAudioReady ? audioPath : "Select audio source folder..."}
                className="input-styled cursor-pointer hover:border-indigo-300"
                style={isAudioReady ? { 
                  borderColor: 'var(--success)', 
                  color: 'var(--success-text)',
                  backgroundColor: 'var(--success-bg)'
                } : {}}
              />

              {!isAudioReady && (
                <div className="absolute right-4 top-3.5 text-slate-300">
                  <ArrowRight size={18} />
                </div>
              )}
            </div>

            {/* Native File Input (Hidden) */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFolderChange}
              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
            />
          </div>

          {/* --- Action Button --- */}
          {/* ใช้ Class: btn-primary */}
          <button
            onClick={onScan}
            disabled={!canStart}
            className="btn-primary flex items-center justify-center gap-2 mt-8"
            style={!canStart ? { backgroundColor: 'var(--text-light)', boxShadow: 'none' } : {}}
          >
            {isScanning ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Start Annotation</span>
            )}
          </button>

        </div>
      </div>

      {/* Footer */}

    </div>
  );
};

export default UploadPage;