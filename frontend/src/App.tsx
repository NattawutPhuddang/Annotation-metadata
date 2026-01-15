import React, { useState, useRef } from 'react';
import './App.css';
import { AudioItem } from './types';
import UploadPage from './pages/UploadPage';
import AnnotationPage from './pages/AnnotationPage';
import CorrectPage from './pages/CorrectPage';
import EditPage from './pages/EditPage';
import { List, CheckCircle, AlertCircle, LogOut, Save } from 'lucide-react';

// ลบ import TokenizeModal ออกไปแล้ว

type Tab = 'pending' | 'correct' | 'fail';

const App: React.FC = () => {
  // --- State ---
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<Tab>('pending');
  
  const [metadata, setMetadata] = useState<AudioItem[]>([]);
  const [audioPath, setAudioPath] = useState<string>('');
  
  // Data Buckets
  const [audioFiles, setAudioFiles] = useState<AudioItem[]>([]);
  const [correctData, setCorrectData] = useState<AudioItem[]>([]);
  const [incorrectData, setIncorrectData] = useState<AudioItem[]>([]);
  
  // Status
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Player
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // --- Logic Helpers ---

  const generateTSV = (data: AudioItem[]) => {
    return 'filename\ttext\n' + data.map(i => `${i.filename}\t${i.text}`).join('\n');
  };

  const saveToBackend = async (filename: string, data: AudioItem[]) => {
    try {
      setIsSaving(true);
      const content = generateTSV(data);
      await fetch('http://localhost:3001/api/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content }),
      });
      setLastSaved(new Date());
    } catch (err) {
      console.error(`Failed to auto-save ${filename}`, err);
    } finally {
      setIsSaving(false);
    }
  };

  const performAutoSave = (newCorrect: AudioItem[], newIncorrect: AudioItem[]) => {
    saveToBackend('Correct.tsv', newCorrect);
    saveToBackend('fail.tsv', newIncorrect);
  };

  const pendingItems = audioFiles.filter(item => 
    !correctData.some(c => c.filename === item.filename) &&
    !incorrectData.some(i => i.filename === item.filename)
  );

  // --- Handlers ---

  const handleTSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (!event.target) return;
        const text = event.target.result as string;
        const rows = text.split('\n').filter(row => row.trim());
        const parsed: AudioItem[] = rows.slice(1).map(row => {
          const cols = row.split('\t');
          return { filename: cols[0] || '', text: cols[1] || '' };
        });
        setMetadata(parsed);
      };
      reader.readAsText(file);
    }
  };

  const scanAudioFiles = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/scan-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: audioPath }),
      });
      if (!response.ok) throw new Error('Scan failed');
      const list: string[] = await response.json();
      
      const matched: AudioItem[] = list.map(path => {
        const name = path.split(/[/\\]/).pop() || '';
        const meta = metadata.find(m => m.filename === name);
        return { filename: name, text: meta?.text || '', audioPath: path };
      }).filter(item => item.text);

      if (matched.length > 0) {
        setAudioFiles(matched);
        setHasStarted(true);
        setCurrentTab('pending');
      } else {
        alert('ไม่พบไฟล์เสียงที่ตรงกับ metadata');
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการสแกนไฟล์');
    }
  };

  const playAudio = (item: AudioItem) => {
    if (!audioRef.current || !item.audioPath) return;
    const url = `http://localhost:3001/api/audio/${encodeURIComponent(item.audioPath)}`;
    
    if (playingFile === item.filename) {
      audioRef.current.pause();
      setPlayingFile(null);
    } else {
      audioRef.current.src = url;
      audioRef.current.play().catch(console.error);
      setPlayingFile(item.filename);
    }
  };

  const downloadTSV = (data: AudioItem[], filename: string) => {
    const content = generateTSV(data);
    const blob = new Blob([content], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  // --- Inspect Text Function (FIXED TYPE) ---
  // แก้ไขให้คืนค่า Promise<string[]> เพื่อให้ตรงกับที่หน้าอื่นๆ ต้องการ
  const handleInspectText = async (text: string): Promise<string[]> => {
    try {
      const response = await fetch('http://localhost:3001/api/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      // ตรวจสอบว่าได้ array จริงไหม ถ้าใช่ส่งกลับ ถ้าไม่ใช่ส่ง array ว่าง
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Tokenize error', error);
      return [];
    }
  };

  // --- Actions ---

  const handleDecision = (item: AudioItem, status: 'correct' | 'incorrect') => {
    let newCorrect = correctData;
    let newIncorrect = incorrectData;

    if (status === 'correct') {
      newCorrect = [...correctData, item];
      setCorrectData(newCorrect);
    } else {
      newIncorrect = [...incorrectData, item];
      setIncorrectData(newIncorrect);
    }
    performAutoSave(newCorrect, newIncorrect);
  };

  const handleMoveToFail = (item: AudioItem) => {
    const newCorrect = correctData.filter(i => i.filename !== item.filename);
    const newIncorrect = [...incorrectData, item];
    setCorrectData(newCorrect);
    setIncorrectData(newIncorrect);
    performAutoSave(newCorrect, newIncorrect);
  };

  const handleSaveCorrection = (item: AudioItem, newText: string) => {
    const newItem = { ...item, text: newText };
    const newIncorrect = incorrectData.filter(i => i.filename !== item.filename);
    const newCorrect = [...correctData, newItem];
    setIncorrectData(newIncorrect);
    setCorrectData(newCorrect);
    performAutoSave(newCorrect, newIncorrect);
  };

  // --- Render ---

  if (!hasStarted) {
    return (
      <UploadPage
        metadata={metadata}
        audioPath={audioPath}
        setAudioPath={setAudioPath}
        onMetadataUpload={handleTSVUpload}
        onScan={scanAudioFiles}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <audio ref={audioRef} onEnded={() => setPlayingFile(null)} className="hidden" />
      
      {/* Navbar */}
      <div className="nav-container">
        <div className="nav-content">
          <div className="nav-logo">
            <div className="logo-icon">
              <List size={20} strokeWidth={3} />
            </div>
            <span>Audio<span style={{color: 'var(--primary-color)'}}>Annotator</span></span>
          </div>

          <div className="nav-tabs-container">
            <button
              onClick={() => setCurrentTab('pending')}
              className={`nav-tab tab-pending ${currentTab === 'pending' ? 'active' : ''}`}
            >
              <span>รอตรวจสอบ</span>
              <span className="tab-badge">{pendingItems.length}</span>
            </button>
            
            <button
              onClick={() => setCurrentTab('correct')}
              className={`nav-tab tab-correct ${currentTab === 'correct' ? 'active' : ''}`}
            >
              <span>ถูกต้อง</span>
              <span className="tab-badge">{correctData.length}</span>
            </button>
            
            <button
              onClick={() => setCurrentTab('fail')}
              className={`nav-tab tab-fail ${currentTab === 'fail' ? 'active' : ''}`}
            >
              <span>แก้ไข</span>
              <span className="tab-badge">{incorrectData.length}</span>
            </button>
          </div>

          <div className="nav-actions">
            {(isSaving || lastSaved) && (
              <div className="status-indicator">
                {isSaving ? (
                  <>
                    <Save size={14} className="animate-spin text-indigo-500" />
                    <span className="text-indigo-500">Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="text-slate-500">Saved</span>
                  </>
                )}
              </div>
            )}

            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--slate-200)' }}></div>

            <button 
              onClick={() => { if(window.confirm('ต้องการกลับไปหน้าแรกหรือไม่?')) setHasStarted(false); }}
              className="btn-action hover:bg-rose-50 hover:text-rose-500"
              title="ออก / เริ่มใหม่"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto p-6 max-w-6xl">
        {currentTab === 'pending' && (
          <AnnotationPage
            pendingItems={pendingItems}
            onDecision={handleDecision}
            playAudio={playAudio}
            playingFile={playingFile}
            onInspectText={handleInspectText} 
          />
        )}

        {currentTab === 'correct' && (
          <CorrectPage
            data={correctData}
            onMoveToFail={handleMoveToFail}
            onDownload={downloadTSV}
            playAudio={playAudio}
            playingFile={playingFile}
            onInspectText={handleInspectText}
          />
        )}

        {currentTab === 'fail' && (
          <EditPage
            data={incorrectData}
            onSaveCorrection={handleSaveCorrection}
            onDownload={downloadTSV}
            playAudio={playAudio}
            playingFile={playingFile}
            onInspectText={handleInspectText}
          />
        )}
      </div>
    </div>
  );
};

export default App;