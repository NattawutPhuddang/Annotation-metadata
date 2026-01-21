import React, { useState } from 'react';
import { UploadCloud, Folder, FileText, Play } from 'lucide-react';
import { useAnnotation } from '../../context/AnnotationContext';
import { audioService } from '../../api/audioService';
import { AudioItem } from '../../types';
import './UploadPage.css';

const UploadPage: React.FC = () => {
  const { 
    setAudioFiles, setHasStarted, setAudioPath, 
    setLoading, logout, audioPath 
  } = useAnnotation();

  const [metadata, setMetadata] = useState<AudioItem[]>([]);
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<File[]>([]);
  const [localPathInput, setLocalPathInput] = useState(audioPath || "");

  // 1. Handle Metadata (TSV) Upload
  const handleMetadataUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = text.split('\n');
        const parsed = rows.slice(1).map(row => {
          const [filename, textContent] = row.split('\t');
          return (filename && textContent) ? { filename: filename.trim(), text: textContent.trim() } : null;
        }).filter(Boolean) as AudioItem[];
        setMetadata(parsed);
      };
      reader.readAsText(file);
    }
  };

  // 2. Handle Folder Select (Local)
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedLocalFiles(Array.from(files));
      // Extract folder name from the first file
      const folderName = files[0].webkitRelativePath.split('/')[0] || "Selected Folder";
      setLocalPathInput(`${folderName} (${files.length} files)`);
    }
  };

  // 3. Main Logic: Scan & Match
  const handleScan = async () => {
    if (metadata.length === 0) {
      alert("Please upload a Metadata (.tsv) file first.");
      return;
    }
    
    setLoading(true, "Scanning audio files...");
    
    try {
      let matchedItems: AudioItem[] = [];

      // A. Local Files Mode
      if (selectedLocalFiles.length > 0) {
        const fileMap = new Map<string, File>();
        selectedLocalFiles.forEach(f => {
            fileMap.set(f.name, f);
            // Also map without extension just in case
            const nameNoExt = f.name.substring(0, f.name.lastIndexOf('.'));
            if(nameNoExt) fileMap.set(nameNoExt, f);
        });

        matchedItems = metadata.map(m => {
            const file = fileMap.get(m.filename);
            return file ? { ...m, audioPath: URL.createObjectURL(file) } : null;
        }).filter(Boolean) as AudioItem[];

        setAudioPath(localPathInput); // Save display name
      } 
      // B. Server Path Mode
      else {
        if (!localPathInput.trim()) {
            alert("Please specify a folder path.");
            setLoading(false);
            return;
        }

        const serverFiles = await audioService.scanAudio(localPathInput);
        const serverFileMap = new Map<string, string>();
        serverFiles.forEach(p => {
            const fname = p.split(/[/\\]/).pop() || "";
            serverFileMap.set(fname, p);
            const nameNoExt = fname.substring(0, fname.lastIndexOf('.'));
            if (nameNoExt) serverFileMap.set(nameNoExt, p);
        });

        matchedItems = metadata.map(m => {
            const path = serverFileMap.get(m.filename);
            return path ? { ...m, audioPath: path } : null;
        }).filter(Boolean) as AudioItem[];
        
        setAudioPath(localPathInput);
      }

      if (matchedItems.length > 0) {
        // Pre-tokenize a few items for speed
        const initialBatch = matchedItems.slice(0, 50).map(i => i.text);
        await audioService.tokenizeBatch(initialBatch); // Fire and forget (cache will fill)

        setAudioFiles(matchedItems);
        setHasStarted(true); // Switch to Main Layout
      } else {
        alert("No matching audio files found. Please check filenames.");
      }

    } catch (e) {
      console.error(e);
      alert("Error scanning files.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container animate-fade-in">
      <div className="upload-card">
        <div className="upload-header">
          <div className="upload-icon">
             <UploadCloud size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-700">Setup Workspace</h2>
          <p className="text-slate-400 text-sm">Upload metadata and select audio source</p>
        </div>

        {/* 1. Metadata Upload */}
        <div className="mb-6">
          <label className="input-label flex items-center gap-2">
            <FileText size={14}/> Metadata (.tsv)
          </label>
          <div className="dropzone-area" onClick={() => document.getElementById('meta-upload')?.click()}>
            <input 
              id="meta-upload" 
              type="file" 
              accept=".tsv,.txt" 
              className="hidden" 
              onChange={handleMetadataUpload}
            />
            {metadata.length > 0 ? (
                <div className="file-status text-center">
                    Loaded {metadata.length} items
                </div>
            ) : (
                <span className="dropzone-text">Click to upload .tsv file</span>
            )}
          </div>
        </div>

        {/* 2. Audio Source Selection */}
        <div className="mb-8">
          <label className="input-label flex items-center gap-2">
            <Folder size={14}/> Audio Source
          </label>
          <div className="dropzone-area" onClick={() => document.getElementById('folder-upload')?.click()}>
            <input
              id="folder-upload"
              type="file"
              // @ts-ignore
              webkitdirectory=""
              directory=""
              className="hidden"
              onChange={handleFolderSelect}
            />
            {selectedLocalFiles.length > 0 ? (
              <div className="file-status text-center">
                Loaded {selectedLocalFiles.length} files
              </div>
            ) : (
              <span className="dropzone-text">Click to select audio folder</span>
            )}
          </div>
        </div>

        <button 
          className="start-btn flex items-center justify-center gap-2"
          onClick={handleScan}
          disabled={metadata.length === 0}
        >
          Start Annotation <Play size={16} />
        </button>

        <div onClick={logout} className="logout-link">
            Change User
        </div>
      </div>
    </div>
  );
};

export default UploadPage;