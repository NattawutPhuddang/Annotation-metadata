import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { AudioItem } from './types';
import UploadPage from './pages/UploadPage';
import AnnotationPage from './pages/AnnotationPage';
import CorrectPage from './pages/CorrectPage';
import EditPage from './pages/EditPage';
import { LogOut, Save, Music } from 'lucide-react';

type Tab = 'pending' | 'correct' | 'fail';

const App: React.FC = () => {
  // --- Data Stores ---
  const [hasStarted, setHasStarted] = useState<boolean>(() => JSON.parse(localStorage.getItem('hasStarted') || 'false'));
  const [currentTab, setCurrentTab] = useState<Tab>('pending');
  
  const [metadata, setMetadata] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('metadata') || '[]'));
  // audioPath ใช้เก็บข้อความแสดงผลเฉยๆ (เช่น "Selected: Music (50 files)")
  const [audioPath, setAudioPath] = useState<string>(() => localStorage.getItem('audioPath') || '');
  
  // เก็บรายการไฟล์เสียง
  const [audioFiles, setAudioFiles] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('audioFiles') || '[]'));
  
  const [correctData, setCorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('correctData') || '[]'));
  const [incorrectData, setIncorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('incorrectData') || '[]'));
  const [changes, setChanges] = useState<Array<{original: string, changed: string}>>(() => JSON.parse(localStorage.getItem('changes') || '[]'));
  
  const [isSaving, setIsSaving] = useState(false);
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // เก็บไฟล์จริง (File Objects) ที่เลือกมาจาก Browser popup (ใช้ชั่วคราว ไม่ลง LocalStorage)
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<File[]>([]);

  // --- Persistence ---
  useEffect(() => { localStorage.setItem('hasStarted', JSON.stringify(hasStarted)); }, [hasStarted]);
  useEffect(() => { localStorage.setItem('metadata', JSON.stringify(metadata)); }, [metadata]);
  useEffect(() => { localStorage.setItem('audioPath', audioPath); }, [audioPath]);
  
  useEffect(() => { 
    // เก็บเฉพาะ Metadata ลง Storage (ไม่เก็บ URL เพราะ Blob URL จะเสียเมื่อปิดเว็บ)
    const safeToSave = audioFiles.map(a => ({ ...a, audioPath: '' }));
    localStorage.setItem('audioFiles', JSON.stringify(safeToSave)); 
  }, [audioFiles]);
  
  useEffect(() => { localStorage.setItem('correctData', JSON.stringify(correctData)); }, [correctData]);
  useEffect(() => { localStorage.setItem('incorrectData', JSON.stringify(incorrectData)); }, [incorrectData]);
  useEffect(() => { localStorage.setItem('changes', JSON.stringify(changes)); }, [changes]);

  // --- 1. Fix Stale URLs & Load Data (สำคัญมาก: แก้ปัญหา Error ไฟล์ไม่เจอ) ---
  useEffect(() => {
    // เช็คว่ามีไฟล์ค้างเก่าที่เปิดไม่ได้หรือไม่
    const savedAudioFiles = JSON.parse(localStorage.getItem('audioFiles') || '[]');
    if (savedAudioFiles.length > 0) {
      const samplePath = savedAudioFiles[0].audioPath || '';
      // ถ้าเจอ Blob URL เก่า หรือ Path ติดเครื่องที่ Browser บล็อก -> ล้างทิ้ง
      if (samplePath.startsWith('blob:') || samplePath.includes(':')) {
        console.log('Clearing stale audio paths...');
        setAudioFiles([]); 
        setHasStarted(false);
        setAudioPath('');
        localStorage.removeItem('audioFiles');
      }
    }

    // โหลดไฟล์ TSV จาก Backend
    const loadTSV = async (name: string) => {
      try {
        const res = await fetch(`http://localhost:3001/api/load-file?filename=${name}`);
        if (!res.ok) return [];
        const txt = await res.text();
        return txt.split('\n').slice(1).map(r => {
          const [f, t] = r.split('\t');
          return (f && t) ? { filename: f, text: t } : null;
        }).filter(Boolean) as AudioItem[];
      } catch { return []; }
    };
    Promise.all([loadTSV('Correct.tsv'), loadTSV('fail.tsv')]).then(([c, f]) => {
      if (c.length) setCorrectData(c);
      if (f.length) setIncorrectData(f);
    });
  }, []);

  // --- 2. Check Refresh (แจ้งเตือนถ้ารีเฟรชแล้วไฟล์หาย) ---
  useEffect(() => {
    if (hasStarted && audioFiles.length > 0 && !audioFiles[0].audioPath) {
        alert("⚠️ กรุณาเลือกโฟลเดอร์ไฟล์เสียงใหม่อีกครั้ง\n(เนื่องจาก Browser รีเฟรชหน้าจอทำให้การเชื่อมต่อไฟล์หลุดไป)");
        setHasStarted(false);
        setAudioFiles([]);
        setAudioPath('');
    }
  }, [hasStarted, audioFiles]);

  // --- Logic Functions ---
  const fileMap = useMemo(() => {
    const m = new Map<string, string>();
    audioFiles.forEach(f => { if(f.audioPath) m.set(f.filename, f.audioPath); });
    return m;
  }, [audioFiles]);

  const enrich = (items: AudioItem[]) => items.map(i => ({ ...i, audioPath: i.audioPath || fileMap.get(i.filename) }));

  const saveFile = async (name: string, data: AudioItem[]) => {
    setIsSaving(true);
    const content = 'filename\ttext\n' + data.map(i => `${i.filename}\t${i.text}`).join('\n');
    await fetch('http://localhost:3001/api/save-file', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ filename: name, content })
    });
    setIsSaving(false);
  };

  const autoSave = (c: AudioItem[], f: AudioItem[]) => {
    saveFile('Correct.tsv', c);
    saveFile('fail.tsv', f);
  };

  const playAudio = (item: AudioItem) => {
    setPlayingFile(curr => curr === item.filename ? null : item.filename);
  };

  const handleDecision = (item: AudioItem, status: 'correct' | 'incorrect') => {
    const newC = status === 'correct' ? [...correctData, item] : correctData.filter(i => i.filename !== item.filename);
    const newF = status === 'incorrect' ? [...incorrectData, item] : incorrectData.filter(i => i.filename !== item.filename);
    setCorrectData(newC);
    setIncorrectData(newF);
    autoSave(newC, newF);
  };

  const handleCorrection = (item: AudioItem, newText: string) => {
    const matches = [...newText.matchAll(/\(([^,]+),([^)]+)\)/g)];
    if (matches.length > 0) {
      const newChanges = [...changes, ...matches.map(m => ({ original: m[1], changed: m[2] }))];
      setChanges(newChanges);
      const content = 'Wrong\tCorrect\n' + newChanges.map(c => `${c.original}\t${c.changed}`).join('\n');
      fetch('http://localhost:3001/api/save-file', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ filename: 'ListOfChange.tsv', content })
      });
    }
    const cleanText = newText.replace(/\([^)]+\)/g, '');
    const newItem = { ...item, text: cleanText };
    const newF = incorrectData.filter(i => i.filename !== item.filename);
    const newC = [...correctData, newItem];
    setIncorrectData(newF);
    setCorrectData(newC);
    autoSave(newC, newF);
  };

  const handleInspect = async (text: string) => {
    try {
      const res = await fetch('http://localhost:3001/api/tokenize', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ text })
      });
      return await res.json();
    } catch { return []; }
  };

  const downloadTSV = (data: AudioItem[], name: string) => {
    const content = 'filename\ttext\n' + data.map(i => `${i.filename}\t${i.text}`).join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
  };

  // --- Filtering ---
  const pending = enrich(audioFiles.filter(i => 
    !correctData.some(c => c.filename === i.filename) && !incorrectData.some(f => f.filename === i.filename)
  ));
  const correct = enrich(correctData);
  const incorrect = enrich(incorrectData);

  // --- Render ---
  if (!hasStarted) return (
    <UploadPage 
      metadata={metadata} 
      audioPath={audioPath} 
      setAudioPath={setAudioPath}
      isScanning={isScanning}
      // รับไฟล์จาก Popup Windows และอัปเดต UI
      onFolderSelect={(fileList) => {
         setSelectedLocalFiles(Array.from(fileList));
         if (fileList.length > 0) {
            const name = fileList[0].webkitRelativePath.split('/')[0] || 'Selected Folder';
            setAudioPath(`${name} (${fileList.length} files)`);
         }
      }}
      onMetadataUpload={(e) => {
        const f = e.target.files?.[0];
        if (f) {
          const r = new FileReader();
          r.onload = (ev) => {
            const rows = (ev.target?.result as string).split('\n');
            setMetadata(rows.slice(1).map(x => { const [n, t] = x.split('\t'); return {filename: n, text: t}; }).filter(x=>x.filename));
          };
          r.readAsText(f);
        }
      }}
      // เมื่อกดปุ่ม Start
      onScan={async () => {
        setIsScanning(true);
        await new Promise(r => setTimeout(r, 500)); // Delay UI นิดหน่อย

        try {
          if (selectedLocalFiles.length > 0) {
            // สร้าง Map ของไฟล์จริง เพื่อค้นหาเร็วๆ
            const fileMap = new Map<string, File>();
            for (const f of selectedLocalFiles) {
              // Map ทั้งชื่อเต็ม (audio.wav) และชื่อตัดนามสกุล (audio)
              fileMap.set(f.name, f);
              const nameNoExt = f.name.substring(0, f.name.lastIndexOf('.'));
              if (nameNoExt) fileMap.set(nameNoExt, f);
            }

            const matched = metadata.map(m => {
               // ค้นหาไฟล์ที่ชื่อตรงกับ Metadata
               const file = fileMap.get(m.filename);
               if (file) {
                 return { 
                   filename: m.filename, 
                   text: m.text, 
                   // สร้าง Blob URL (Link ชั่วคราวสำหรับเล่นไฟล์)
                   audioPath: URL.createObjectURL(file) 
                 };
               }
               return null;
            }).filter(Boolean) as AudioItem[];

            if (matched.length) {
              setAudioFiles(matched);
              setHasStarted(true);
            } else {
              alert(`ไม่พบไฟล์เสียงที่ตรงกันเลย จาก ${selectedLocalFiles.length} ไฟล์\n(โปรดตรวจสอบชื่อไฟล์ใน Metadata)`);
            }
          } else {
             alert('กรุณากด Browse เพื่อเลือกโฟลเดอร์ก่อน');
          }
        } catch (error) {
          console.error(error);
          alert('เกิดข้อผิดพลาดในการประมวลผลไฟล์');
        } finally {
          setIsScanning(false);
        }
      }} 
    />
  );

  return (
    <div className="app-container">
      {/* Header */}
      <header className={`app-header ${window.scrollY > 10 ? 'scrolled' : ''}`}>
        <div className="header-logo">
          <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg"><Music size={20}/></div>
          <span>Audio Annotator</span>
        </div>
        
        <div className="nav-pills">
           {(['pending', 'correct', 'fail'] as Tab[]).map(t => (
             <button key={t} onClick={() => setCurrentTab(t)} 
               className={`nav-item ${currentTab === t ? `active tab-${t}` : ''}`}>
               {t.charAt(0).toUpperCase() + t.slice(1)} 
               <span className="ml-2 text-xs opacity-60">
                 {t === 'pending' ? pending.length : t === 'correct' ? correct.length : incorrect.length}
               </span>
             </button>
           ))}
        </div>

        <div className="flex items-center gap-4">
           {isSaving && <span className="text-xs text-indigo-400 flex gap-2 items-center"><Save size={14} className="animate-spin"/> Saving changes...</span>}
           <button onClick={() => {
             // Reset เพื่อเลือกโฟลเดอร์ใหม่
             setHasStarted(false);
             setAudioFiles([]);
             setSelectedLocalFiles([]);
             setAudioPath('');
           }} className="btn-icon text-red-300 hover:text-red-500 hover:bg-red-50" title="Logout / Change Folder">
             <LogOut size={18}/>
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content animate-fade-in">
        {currentTab === 'pending' && <AnnotationPage pendingItems={pending} onDecision={handleDecision} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspect} />}
        {currentTab === 'correct' && <CorrectPage data={correct} onMoveToFail={(i)=>handleDecision(i, 'incorrect')} onDownload={downloadTSV} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspect} />}
        {currentTab === 'fail' && <EditPage data={incorrect} onSaveCorrection={handleCorrection} onDownload={downloadTSV} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspect} />}
      </main>
    </div>
  );
};
export default App;