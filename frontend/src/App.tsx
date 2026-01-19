import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { AudioItem } from './types';
import UploadPage from './pages/UploadPage';
import AnnotationPage from './pages/AnnotationPage';
import CorrectPage from './pages/CorrectPage';
import EditPage from './pages/EditPage';
import { LogOut, Save, Music, User, ArrowRight } from 'lucide-react';

type Tab = 'pending' | 'correct' | 'fail';

// 🔴 CONFIG: IP Server
const API_BASE = 'http://10.2.98.118:3001'; 

const App: React.FC = () => {
  // --- Auth ---
  const [employeeId, setEmployeeId] = useState<string>(() => localStorage.getItem('employeeId') || '');
  const [tempId, setTempId] = useState('');

  // --- Data Stores ---
  const [hasStarted, setHasStarted] = useState<boolean>(() => JSON.parse(localStorage.getItem('hasStarted') || 'false'));
  const [currentTab, setCurrentTab] = useState<Tab>('pending');
  
  const [metadata, setMetadata] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('metadata') || '[]'));
  const [audioPath, setAudioPath] = useState<string>(() => localStorage.getItem('audioPath') || '');
  
  const [audioFiles, setAudioFiles] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('audioFiles') || '[]'));
  
  const [correctData, setCorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('correctData') || '[]'));
  const [incorrectData, setIncorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('incorrectData') || '[]'));
  const [changes, setChanges] = useState<Array<{original: string, changed: string}>>(() => JSON.parse(localStorage.getItem('changes') || '[]'));
  
  const [isSaving, setIsSaving] = useState(false);
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<File[]>([]);

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
  useEffect(() => { localStorage.setItem('hasStarted', JSON.stringify(hasStarted)); }, [hasStarted]);
  useEffect(() => { localStorage.setItem('metadata', JSON.stringify(metadata)); }, [metadata]);
  useEffect(() => { localStorage.setItem('audioPath', audioPath); }, [audioPath]);
  
  useEffect(() => { 
    const safeToSave = audioFiles.map(a => ({ ...a, audioPath: '' }));
    localStorage.setItem('audioFiles', JSON.stringify(safeToSave)); 
  }, [audioFiles]);
  
  useEffect(() => { localStorage.setItem('correctData', JSON.stringify(correctData)); }, [correctData]);
  useEffect(() => { localStorage.setItem('incorrectData', JSON.stringify(incorrectData)); }, [incorrectData]);
  useEffect(() => { localStorage.setItem('changes', JSON.stringify(changes)); }, [changes]);

  const getFileName = (base: string) => `${employeeId}-${base}`;

  // --- 1. Load Data ---
  useEffect(() => {
    if (!employeeId) return;

    const savedAudioFiles = JSON.parse(localStorage.getItem('audioFiles') || '[]');
    if (savedAudioFiles.length > 0 && (savedAudioFiles[0].audioPath || '').startsWith('blob:')) {
        setAudioFiles([]); setHasStarted(false); setAudioPath(''); localStorage.removeItem('audioFiles');
    }

    const loadTSV = async (name: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/load-file?filename=${name}`);
        if (!res.ok) return [];
        const txt = await res.text();
        return txt.split('\n').slice(1).map(r => {
          const [f, t] = r.trim().split('\t');
          return (f && t) ? { filename: f, text: t } : null;
        }).filter(Boolean) as AudioItem[];
      } catch { return []; }
    };

    const loadChanges = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/load-file?filename=${getFileName('ListOfChange.tsv')}`);
        if (!res.ok) return [];
        const txt = await res.text();
        return txt.split('\n').slice(1).map(r => {
          const [o, c] = r.trim().split('\t');
          return (o && c) ? { original: o, changed: c } : null;
        }).filter(Boolean);
      } catch { return []; }
    };

    Promise.all([
      loadTSV('Correct.tsv'), 
      loadTSV('fail.tsv'), 
      loadChanges()
    ]).then(([c, f, ch]) => {
      setCorrectData(c);
      setIncorrectData(f);
      if (ch.length) setChanges(ch as any);
    });
  }, [employeeId]);

  // --- Logic ---
  const fileMap = useMemo(() => {
    const m = new Map<string, string>();
    audioFiles.forEach(f => { if(f.audioPath) m.set(f.filename, f.audioPath); });
    return m;
  }, [audioFiles]);

  const availableFilenames = useMemo(() => new Set(audioFiles.map(a => a.filename)), [audioFiles]);

  const enrich = (items: AudioItem[]) => items.map(i => ({ ...i, audioPath: i.audioPath || fileMap.get(i.filename) }));

  // Save Global (ทับไฟล์รวม)
  const saveFile = async (name: string, data: AudioItem[]) => {
    setIsSaving(true);
    const content = 'filename\ttext\n' + data.map(i => `${i.filename}\t${i.text}`).join('\n');
    await fetch(`${API_BASE}/api/save-file`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ filename: name, content })
    });
    setIsSaving(false);
  };

  // Log Personal (ต่อท้ายไฟล์ส่วนตัว)
  const logUserAction = async (item: AudioItem, type: 'correct') => {
    try {
      const filename = getFileName(`${type === 'correct' ? 'Correct' : 'fail'}.tsv`);
      await fetch(`${API_BASE}/api/append-tsv`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ filename, item })
      });
      // console.log(`Logged to ${filename}`); // เปิดดู Log ใน Console Browser ได้
    } catch(e) { console.error("Log failed", e); }
  };

  

  const playAudio = (item: AudioItem) => {
    setPlayingFile(curr => curr === item.filename ? null : item.filename);
  };

  const handleDecision = (item: AudioItem, status: 'correct' | 'incorrect') => {
    // 1. อัปเดต State และไฟล์ Global (เหมือนเดิม)
    const newC = status === 'correct' ? [...correctData, item] : correctData.filter(i => i.filename !== item.filename);
    const newF = status === 'incorrect' ? [...incorrectData, item] : incorrectData.filter(i => i.filename !== item.filename);
    
    setCorrectData(newC);
    setIncorrectData(newF);
    saveFile('Correct.tsv', newC);
    saveFile('fail.tsv', newF);

    // 2. จัดการ User Log ส่วนตัว
    if (status === 'correct') {
      // ถ้ากดถูก -> เพิ่ม/อัปเดต ในไฟล์ User-Correct
      logUserAction(item, 'correct');
    } else {
      // 🟢 ถ้ากดผิด (กากบาท) -> ลบออกจากไฟล์ User-Correct ทันที
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
             body: JSON.stringify({ original: m[1], changed: m[2], filename: getFileName('ListOfChange.tsv') })
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
    
    logUserAction(newItem, 'correct'); // ✅ เรียก Log ทันที
  };

  const handleInspect = async (text: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tokenize`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ text })
      });
      return await res.json();
    } catch { return []; }
  };

  // 🟢 Download Global (สิ่งที่เห็นบนจอ)
  const downloadTSV = (data: AudioItem[], name: string) => {
    const content = 'filename\ttext\n' + data.map(i => `${i.filename}\t${i.text}`).join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
  };

  // 🟢 NEW: Download Personal Log (ไฟล์จริงจาก Server)
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
      a.download = filename; // ชื่อไฟล์จะเป็น ID-Correct.tsv
      a.click();
    } catch (e) {
      alert('Error fetching personal log');
    }
  };

  const pending = enrich(audioFiles.filter(i => 
    !correctData.some(c => c.filename === i.filename) && !incorrectData.some(f => f.filename === i.filename)
  ));
  const correct = enrich(correctData);
  const incorrect = enrich(incorrectData);

  // --- LOGIN ---
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

  // --- APP ---
  if (!hasStarted) return (
    <UploadPage 
      metadata={metadata} audioPath={audioPath} setAudioPath={setAudioPath} isScanning={isScanning}
      onFolderSelect={(fileList) => {
         setSelectedLocalFiles(Array.from(fileList));
         if (fileList.length > 0) setAudioPath(`${fileList[0].webkitRelativePath.split('/')[0] || 'Selected Folder'} (${fileList.length} files)`);
      }}
      onMetadataUpload={(e) => {
        const f = e.target.files?.[0];
        if (f) {
          const r = new FileReader();
          r.onload = (ev) => setMetadata((ev.target?.result as string).split('\n').slice(1).map(x => { const [n, t] = x.split('\t'); return {filename: n, text: t}; }).filter(x=>x.filename));
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
            else { alert('ไม่พบไฟล์เสียงที่ตรงกันเลย'); }
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
           <button onClick={() => { if(window.confirm('Log out?')) { setEmployeeId(''); localStorage.removeItem('employeeId'); setHasStarted(false); setAudioFiles([]); setAudioPath(''); }}} className="btn-icon text-red-300 hover:text-red-500 hover:bg-red-50"><LogOut size={18}/></button>
        </div>
      </header>
      <main className="main-content animate-fade-in">
        {currentTab === 'pending' && <AnnotationPage pendingItems={pending} onDecision={handleDecision} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspect} />}
        
        {/* 🟢 ส่ง props ใหม่ downloadPersonalLog ไป */}
        {currentTab === 'correct' && <CorrectPage 
          data={correct} 
          availableFiles={availableFilenames} 
          onMoveToFail={(i)=>handleDecision(i, 'incorrect')} 
          onDownload={downloadTSV} 
          onDownloadPersonal={downloadPersonalLog} // 👈 เพิ่มตรงนี้
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