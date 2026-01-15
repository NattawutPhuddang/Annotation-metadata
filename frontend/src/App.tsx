import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { AudioItem } from './types';
import UploadPage from './pages/UploadPage';
import AnnotationPage from './pages/AnnotationPage';
import CorrectPage from './pages/CorrectPage';
import EditPage from './pages/EditPage';
import { List, LogOut, Save } from 'lucide-react'; // ลบ CheckCircle ออก

type Tab = 'pending' | 'correct' | 'fail';

const App: React.FC = () => {
  // --- State ---
  const [hasStarted, setHasStarted] = useState<boolean>(() => JSON.parse(localStorage.getItem('hasStarted') || 'false'));
  const [currentTab, setCurrentTab] = useState<Tab>('pending');
  
  const [metadata, setMetadata] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('metadata') || '[]'));
  const [audioPath, setAudioPath] = useState<string>(() => localStorage.getItem('audioPath') || '');
  
  const [audioFiles, setAudioFiles] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('audioFiles') || '[]'));
  const [correctData, setCorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('correctData') || '[]'));
  const [incorrectData, setIncorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('incorrectData') || '[]'));
  
  // ใช้ setChanges เพื่อเก็บประวัติการแก้คำผิด
  const [changes, setChanges] = useState<Array<{original: string, changed: string}>>(() => JSON.parse(localStorage.getItem('changes') || '[]'));
  
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [playingFile, setPlayingFile] = useState<string | null>(null);

  // --- Effects: Save to localStorage ---
  useEffect(() => { localStorage.setItem('hasStarted', JSON.stringify(hasStarted)); }, [hasStarted]);
  useEffect(() => { localStorage.setItem('metadata', JSON.stringify(metadata)); }, [metadata]);
  useEffect(() => { localStorage.setItem('audioPath', audioPath); }, [audioPath]);
  useEffect(() => { localStorage.setItem('audioFiles', JSON.stringify(audioFiles)); }, [audioFiles]);
  useEffect(() => { localStorage.setItem('correctData', JSON.stringify(correctData)); }, [correctData]);
  useEffect(() => { localStorage.setItem('incorrectData', JSON.stringify(incorrectData)); }, [incorrectData]);
  useEffect(() => { localStorage.setItem('changes', JSON.stringify(changes)); }, [changes]);

  // Load Initial Data from Backend
  useEffect(() => {
    const loadData = async () => {
      try {
        const load = async (fname: string) => {
           const res = await fetch(`http://localhost:3001/api/load-file?filename=${fname}`);
           if (!res.ok) return [];
           const text = await res.text();
           return text.split('\n').slice(1).map(r => {
             const [f, t] = r.split('\t');
             return (f && t) ? { filename: f, text: t } : null;
           }).filter(Boolean) as AudioItem[];
        };

        const c = await load('Correct.tsv');
        if (c.length) setCorrectData(c);
        
        const f = await load('fail.tsv');
        if (f.length) setIncorrectData(f);

        // Load Changes
        const chRes = await fetch('http://localhost:3001/api/load-file?filename=ListOfChange.tsv');
        if (chRes.ok) {
           const txt = await chRes.text();
           const chList = txt.split('\n').slice(1).map(r => {
             const [o, n] = r.split('\t');
             return (o && n) ? { original: o, changed: n } : null;
           }).filter(Boolean) as Array<{original: string, changed: string}>;
           if (chList.length) setChanges(chList);
        }
      } catch (e) { console.error(e); }
    };
    loadData();
  }, []);

  // --- Helpers ---
  const fileMap = useMemo(() => {
    const map = new Map<string, string>();
    audioFiles.forEach(f => { if(f.audioPath) map.set(f.filename, f.audioPath); });
    return map;
  }, [audioFiles]);

  const enrich = (items: AudioItem[]) => items.map(i => ({
    ...i, audioPath: i.audioPath || fileMap.get(i.filename)
  }));

  const saveToBackend = async (filename: string, data: AudioItem[]) => {
    setIsSaving(true);
    const content = 'filename\ttext\n' + data.map(i => `${i.filename}\t${i.text}`).join('\n');
    await fetch('http://localhost:3001/api/save-file', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ filename, content })
    });
    setIsSaving(false);
  };
  
  const saveChangesToBackend = async (newChanges: Array<{original: string, changed: string}>) => {
    const content = 'Wrong Word\tCorrect Word\n' + newChanges.map(c => `${c.original}\t${c.changed}`).join('\n');
    await fetch('http://localhost:3001/api/save-file', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ filename: 'ListOfChange.tsv', content })
    });
  };

  const performAutoSave = (newC: AudioItem[], newF: AudioItem[]) => {
    saveToBackend('Correct.tsv', newC);
    saveToBackend('fail.tsv', newF);
  };

  // --- Handlers (Full Logic) ---
  
  // 1. Upload Metadata (TSV)
  const handleMetadataUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
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

  // 2. Scan Audio Files
  const handleScan = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/scan-audio`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ path: audioPath }),
      });
      if (!res.ok) throw new Error('Scan failed');
      const list: string[] = await res.json();
      
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

  // 3. Play Audio
  const playAudio = (item: AudioItem) => {
    setPlayingFile(current => current === item.filename ? null : item.filename);
  };

  // 4. Decision (Check/Cross)
  const handleDecision = (item: AudioItem, status: 'correct' | 'incorrect') => {
    const newC = status === 'correct' ? [...correctData, item] : correctData;
    const newF = status === 'incorrect' ? [...incorrectData, item] : incorrectData;
    if (status === 'correct') setCorrectData(newC); else setIncorrectData(newF);
    performAutoSave(newC, newF);
  };

  // 5. Save Correction (Edit Page)
  const handleSaveCorrection = (item: AudioItem, newText: string) => {
    // หาคำผิดในวงเล็บ (ผิด,ถูก)
    const bracketRegex = /\(([^,]+),([^)]+)\)/g;
    let editedPairs: Array<{original: string, changed: string}> = [];
    let match;
    while ((match = bracketRegex.exec(newText)) !== null) {
      editedPairs.push({ original: match[1], changed: match[2] });
    }
    
    const cleanedText = newText.replace(/\([^)]+\)/g, '');
    const newItem = { ...item, text: cleanedText };
    
    // ย้ายจาก Fail -> Correct
    const newF = incorrectData.filter(i => i.filename !== item.filename);
    const newC = [...correctData, newItem];
    
    setIncorrectData(newF);
    setCorrectData(newC);
    
    if (editedPairs.length > 0) {
      const newChanges = [...changes, ...editedPairs];
      setChanges(newChanges);
      saveChangesToBackend(newChanges);
    }
    performAutoSave(newC, newF);
  };

  // 6. Inspect Text
  const handleInspectText = async (text: string): Promise<string[]> => {
    try {
      const res = await fetch('http://localhost:3001/api/tokenize', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ text })
      });
      return await res.json();
    } catch { return []; }
  };
  
  // 7. Download
  const downloadTSV = (data: AudioItem[], filename: string) => {
    const content = 'filename\ttext\n' + data.map(i => `${i.filename}\t${i.text}`).join('\n');
    const blob = new Blob([content], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
  };

  // --- Data Prep ---
  const pendingItems = enrich(audioFiles.filter(i => 
    !correctData.some(c => c.filename === i.filename) && !incorrectData.some(f => f.filename === i.filename)
  ));
  const correctItems = enrich(correctData);
  const incorrectItems = enrich(incorrectData);

  if (!hasStarted) {
    return <UploadPage metadata={metadata} audioPath={audioPath} setAudioPath={setAudioPath} 
      onMetadataUpload={handleMetadataUpload} 
      onScan={handleScan} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="font-bold text-lg flex gap-2 items-center">
          <List className="text-indigo-600" /> AudioAnnotator
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
           {(['pending', 'correct', 'fail'] as Tab[]).map(t => (
             <button key={t} onClick={() => setCurrentTab(t)} 
               className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentTab === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>
               {t.charAt(0).toUpperCase() + t.slice(1)} ({t === 'pending' ? pendingItems.length : t === 'correct' ? correctItems.length : incorrectItems.length})
             </button>
           ))}
        </div>
        <div className="flex items-center gap-3">
           {isSaving && <span className="text-xs text-indigo-500 flex gap-1"><Save size={14} className="animate-spin"/> Saving...</span>}
           <button onClick={() => setHasStarted(false)} className="p-2 hover:bg-red-50 text-red-500 rounded-full"><LogOut size={18}/></button>
        </div>
      </div>

      <div className="flex-1 container mx-auto p-6 max-w-6xl">
        {currentTab === 'pending' && 
          <AnnotationPage pendingItems={pendingItems} onDecision={handleDecision} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspectText} />
        }
        {currentTab === 'correct' && 
          <CorrectPage data={correctItems} onMoveToFail={(item)=>{handleDecision(item, 'incorrect')}} onDownload={downloadTSV} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspectText} />
        }
        {currentTab === 'fail' && 
          <EditPage data={incorrectItems} onSaveCorrection={handleSaveCorrection} onDownload={downloadTSV} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspectText} />
        }
      </div>
    </div>
  );
};

export default App;