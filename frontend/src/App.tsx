import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { AudioItem } from './types';
import UploadPage from './pages/UploadPage';
import AnnotationPage from './pages/AnnotationPage';
import CorrectPage from './pages/CorrectPage';
import EditPage from './pages/EditPage';
import { LogOut, Save, Music, User, ArrowRight } from 'lucide-react';

type Tab = "pending" | "correct" | "fail";

// 🔴 CONFIG: ใช้แบบ Dev เพื่อความยืดหยุ่น (แก้ Port หรือ IP ได้ที่นี่หรือ .env)
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3003";

const App: React.FC = () => {
  // --- Auth (จาก Docker) ---
  const [employeeId, setEmployeeId] = useState<string>(() => localStorage.getItem('employeeId') || '');
  const [tempId, setTempId] = useState('');

  // --- Data Stores ---
  const [hasStarted, setHasStarted] = useState<boolean>(() =>
    JSON.parse(localStorage.getItem("hasStarted") || "false"),
  );
  const [currentTab, setCurrentTab] = useState<Tab>("pending");

  const [metadata, setMetadata] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("metadata") || "[]"),
  );
  const [audioPath, setAudioPath] = useState<string>(
    () => localStorage.getItem("audioPath") || "",
  );

  const [audioFiles, setAudioFiles] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("audioFiles") || "[]"),
  );

  const [correctData, setCorrectData] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("correctData") || "[]"),
  );
  const [incorrectData, setIncorrectData] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("incorrectData") || "[]"),
  );
  const [changes, setChanges] = useState<
    Array<{ original: string; changed: string }>
  >(() => JSON.parse(localStorage.getItem("changes") || "[]"));

  const [isSaving, setIsSaving] = useState(false);
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<File[]>([]);

  // --- Helper Functions (จาก Docker) ---
  const getFileName = (base: string) => `${employeeId}-${base}`;

  const deleteUserLog = async (filenameKey: string, type: 'correct') => {
      try {
        const userFileName = getFileName(`${type === 'correct' ? 'Correct' : 'fail'}.tsv`);
        await fetch(`${API_BASE}/api/delete-tsv-entry`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ filename: userFileName, key: filenameKey })
        });
      } catch(e) { console.error("Delete log failed", e); }
  };

  // --- Persistence ---
  useEffect(() => { if(employeeId) localStorage.setItem('employeeId', employeeId); }, [employeeId]);
  
  useEffect(() => {
    localStorage.setItem("hasStarted", JSON.stringify(hasStarted));
  }, [hasStarted]);
  useEffect(() => {
    localStorage.setItem("metadata", JSON.stringify(metadata));
  }, [metadata]);
  useEffect(() => {
    localStorage.setItem("audioPath", audioPath);
  }, [audioPath]);

  useEffect(() => {
    const safeToSave = audioFiles.map((a) => ({ ...a, audioPath: "" }));
    localStorage.setItem("audioFiles", JSON.stringify(safeToSave));
  }, [audioFiles]);

  useEffect(() => {
    localStorage.setItem("correctData", JSON.stringify(correctData));
  }, [correctData]);
  useEffect(() => {
    localStorage.setItem("incorrectData", JSON.stringify(incorrectData));
  }, [incorrectData]);
  useEffect(() => {
    localStorage.setItem("changes", JSON.stringify(changes));
  }, [changes]);

  // --- 1. Load Data (ใช้ Logic Docker เพื่อรองรับ Login) ---
  useEffect(() => {
    if (!employeeId) return;

    // Check Stale Data (Logic ผสม Dev)
    const savedAudioFiles = JSON.parse(localStorage.getItem("audioFiles") || "[]");
    if (savedAudioFiles.length > 0) {
       const samplePath = savedAudioFiles[0].audioPath || "";
       if (samplePath.startsWith("blob:") || samplePath.includes(":")) {
         setAudioFiles([]); setHasStarted(false); setAudioPath(""); localStorage.removeItem("audioFiles");
       }
    }

    const loadTSV = async (name: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/load-file?filename=${name}`);
        if (!res.ok) return [];
        const txt = await res.text();
        return txt
          .split("\n")
          .slice(1)
          .map((r) => {
            const [f, t] = r.trim().split("\t");
            return f && t ? { filename: f, text: t } : null;
          })
          .filter(Boolean) as AudioItem[];
      } catch {
        return [];
      }
    };

    const loadChanges = async () => {
      try {
        // ใช้ชื่อไฟล์แบบ Docker (มี ID) หรือ Dev (Global) ตามต้องการ (ที่นี่ใช้แบบ Docker เพื่อความปลอดภัย)
        const res = await fetch(`${API_BASE}/api/load-file?filename=ListOfChange.tsv`); 
        if (!res.ok) return [];
        const txt = await res.text();
        return txt
          .split("\n")
          .slice(1)
          .map((r) => {
            const [o, c] = r.trim().split("\t");
            return o && c ? { original: o, changed: c } : null;
          })
          .filter(Boolean);
      } catch {
        return [];
      }
    };

    Promise.all([
      loadTSV("Correct.tsv"),
      loadTSV("fail.tsv"),
      loadChanges(),
    ]).then(([c, f, ch]) => {
      setCorrectData(c);
      setIncorrectData(f);
      if (ch.length) setChanges(ch as any);
    });
  }, [employeeId]);

  // --- Logic Functions ---
  const fileMap = useMemo(() => {
    const m = new Map<string, string>();
    audioFiles.forEach((f) => {
      if (f.audioPath) m.set(f.filename, f.audioPath);
    });
    return m;
  }, [audioFiles]);

  const availableFilenames = useMemo(() => new Set(audioFiles.map(a => a.filename)), [audioFiles]);

  // 🔥 Enrich: ใช้ของ Dev (ดีกว่าเพราะรองรับ Server Path)
  const enrich = (items: AudioItem[]) =>
    items.map((i) => {
      let src = i.audioPath;
      if (!src) {
        src = fileMap.get(i.filename);
      }
      // Logic ของ Dev: แปลง Path ในเครื่อง -> URL API
      if (src && !src.startsWith("blob:") && !src.startsWith("http")) {
        src = `${API_BASE}/api/audio?path=${encodeURIComponent(src)}`;
      }
      return { ...i, audioPath: src };
    });

  const saveFile = async (name: string, data: AudioItem[]) => {
    setIsSaving(true);
    const content =
      "filename\ttext\n" +
      data.map((i) => `${i.filename}\t${i.text}`).join("\n");
    await fetch(`${API_BASE}/api/save-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: name, content }),
    });
    setIsSaving(false);
  };

  // Log Personal (จาก Docker)
  const logUserAction = async (item: AudioItem, type: 'correct') => {
    try {
      const filename = getFileName(`${type === 'correct' ? 'Correct' : 'fail'}.tsv`);
      await fetch(`${API_BASE}/api/append-tsv`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ filename, item })
      });
    } catch(e) { console.error("Log failed", e); }
  };

  const playAudio = (item: AudioItem) => {
    if (item.audioPath && item.audioPath.startsWith("blob:")) {
      // Local
    } else if (item.audioPath) {
      // Server
      // ใช้ Logic Dev เพื่อความชัวร์ (แต่ enrich ทำมาให้แล้วส่วนนึง)
      const url = item.audioPath.startsWith("http") ? item.audioPath : `${API_BASE}/api/audio?path=${encodeURIComponent(item.audioPath)}`;
      // Logic การเล่นเสียง
    }
    setPlayingFile((curr) => (curr === item.filename ? null : item.filename));
  };

  const handleDecision = (item: AudioItem, status: 'correct' | 'incorrect') => {
    const newC = status === 'correct' ? [...correctData, item] : correctData.filter(i => i.filename !== item.filename);
    const newF = status === 'incorrect' ? [...incorrectData, item] : incorrectData.filter(i => i.filename !== item.filename);
    
    setCorrectData(newC);
    setIncorrectData(newF);
    saveFile('Correct.tsv', newC);
    saveFile('fail.tsv', newF);

    // User Log (Docker Feature)
    if (status === 'correct') {
      logUserAction(item, 'correct');
    } else {
      deleteUserLog(item.filename, 'correct');
    }
  };

  const handleCorrection = async (item: AudioItem, newText: string) => {
    const matches = [...newText.matchAll(/\(([^,]+),([^)]+)\)/g)];
    if (matches.length > 0) {
      for (const m of matches) {
        try {
          await fetch(`${API_BASE}/api/append-change`, {
             method: 'POST', headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ original: m[1], changed: m[2], filename: 'ListOfChange.tsv' }) // ใช้ Global Log
          });
        } catch (err) { console.error(err); }
      }
      setChanges([...changes, ...matches.map(m => ({ original: m[1], changed: m[2] }))]);
    }
    const cleanText = newText.replace(/\(([^,]+),([^)]+)\)/g, '$2');
    const newItem = { ...item, text: cleanText };
    
    const newF = incorrectData.filter(i => i.filename !== item.filename);
    const newC = [...correctData, newItem];
    
    setIncorrectData(newF);
    setCorrectData(newC);
    saveFile('Correct.tsv', newC);
    saveFile('fail.tsv', newF);
    
    logUserAction(newItem, 'correct'); // Log personal
  };

  const handleInspect = async (text: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tokenize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return await res.json();
    } catch {
      return [];
    }
  };

  const downloadTSV = (data: AudioItem[], name: string) => {
    const content =
      "filename\ttext\n" +
      data.map((i) => `${i.filename}\t${i.text}`).join("\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  // Download Personal Log (จาก Docker)
  const downloadPersonalLog = async () => {
    const filename = getFileName('Correct.tsv');
    try {
      const res = await fetch(`${API_BASE}/api/load-file?filename=${filename}`);
      if (!res.ok) {
        alert(`ยังไม่มีไฟล์ Log ส่วนตัว (${filename})\n(ลองทำงานสัก 1 รายการแล้วกดใหม่)`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; 
      a.download = filename;
      a.click();
    } catch (e) {
      alert('Error fetching personal log');
    }
  };

  // --- Filtering (ใช้ Logic Dev ที่ Enrich แล้ว) ---
  const pending = enrich(audioFiles.filter(i => 
    !correctData.some(c => c.filename === i.filename) && !incorrectData.some(f => f.filename === i.filename)
  ));
  const correct = enrich(correctData);
  const incorrect = enrich(incorrectData);

  // --- LOGIN PAGE (จาก Docker - สำคัญ!) ---
  if (!employeeId) {
    return (
      <div className="page-container center-content bg-pastel-mix">
        <div className="glass-card max-w-sm w-full p-8 text-center">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6"><User size={32} /></div>
          <h1 className="text-2xl font-bold text-slate-700 mb-2">Employee Login</h1>
          <form onSubmit={(e) => { e.preventDefault(); if(tempId.trim()) setEmployeeId(tempId.trim()); }}>
            <input autoFocus type="text" className="input-styled text-center text-lg tracking-widest mb-4" placeholder="e.g., EMP001" value={tempId} onChange={e => setTempId(e.target.value)}/>
            <button type="submit" className="btn-primary w-full justify-center" disabled={!tempId.trim()}>Enter Workspace <ArrowRight size={18}/></button>
          </form>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  if (!hasStarted) return (
    <UploadPage 
      metadata={metadata} audioPath={audioPath} setAudioPath={setAudioPath} isScanning={isScanning}
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
          }
          r.readAsText(f);
        }
      }}
      onScan={async () => {
        setIsScanning(true);
        await new Promise(r => setTimeout(r, 500));
        try {
          if (selectedLocalFiles.length > 0) {
            const fileMap = new Map<string, File>();
            for (const f of selectedLocalFiles) {
              fileMap.set(f.name, f);
              const nameNoExt = f.name.substring(0, f.name.lastIndexOf('.'));
              if (nameNoExt) fileMap.set(nameNoExt, f);
            }
            const matched = metadata.map(m => {
               const file = fileMap.get(m.filename);
               if (file) return { filename: m.filename, text: m.text, audioPath: URL.createObjectURL(file) };
               return null;
            }).filter(Boolean) as AudioItem[];
            
            if (matched.length) { setAudioFiles(matched); setHasStarted(true); } 
            else { alert('ไม่พบไฟล์เสียงที่ตรงกันเลย (ตรวจสอบชื่อไฟล์ใน Metadata)'); }
          } else { alert('กรุณาเลือกโฟลเดอร์ก่อน'); }
        } catch (error) { console.error(error); alert('Error'); } 
        finally { setIsScanning(false); }
      }} 
    />
  );

  return (
    <div className="app-container">
      <header className={`app-header ${window.scrollY > 10 ? 'scrolled' : ''}`}>
        <div className="header-logo">
          <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg"><Music size={20}/></div>
          <div className="flex flex-col"><span>Audio Annotator</span><span className="text-[10px] text-slate-400 font-mono">User: {employeeId}</span></div>
        </div>
        <div className="nav-pills">
           {(['pending', 'correct', 'fail'] as Tab[]).map(t => (
             <button key={t} onClick={() => setCurrentTab(t)} className={`nav-item ${currentTab === t ? `active tab-${t}` : ''}`}>
               {t.charAt(0).toUpperCase() + t.slice(1)} <span className="ml-2 text-xs opacity-60">{t === 'pending' ? pending.length : t === 'correct' ? correct.length : incorrect.length}</span>
             </button>
           ))}
        </div>
        <div className="flex items-center gap-4">
           {isSaving && <span className="text-xs text-indigo-400 flex gap-2 items-center"><Save size={14} className="animate-spin"/> Saving...</span>}
           <button onClick={() => { 
               if(window.confirm('Log out?')) { 
                   setEmployeeId(''); localStorage.removeItem('employeeId'); 
                   setHasStarted(false); setAudioFiles([]); setAudioPath(''); 
               }
           }} className="btn-icon text-red-300 hover:text-red-500 hover:bg-red-50"><LogOut size={18}/></button>
        </div>
      </header>
      <main className="main-content animate-fade-in">
        {currentTab === 'pending' && <AnnotationPage pendingItems={pending} onDecision={handleDecision} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspect} />}
        
        {currentTab === 'correct' && <CorrectPage 
          data={correct} 
          availableFiles={availableFilenames} 
          onMoveToFail={(i)=>handleDecision(i, 'incorrect')} 
          onDownload={downloadTSV} 
          onDownloadPersonal={downloadPersonalLog}
          playAudio={playAudio} 
          playingFile={playingFile} 
          onInspectText={handleInspect} 
        />}
        
        {currentTab === 'fail' && <EditPage data={incorrect} availableFiles={availableFilenames} onSaveCorrection={handleCorrection} onDownload={downloadTSV} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspect} />}
      </main>
    </div>
  );
};
export default App;