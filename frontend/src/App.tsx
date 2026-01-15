import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { AudioItem } from './types';
import UploadPage from './pages/UploadPage';
import AnnotationPage from './pages/AnnotationPage';
import CorrectPage from './pages/CorrectPage';
import EditPage from './pages/EditPage';
import { List, LogOut, Save } from 'lucide-react';

type Tab = 'pending' | 'correct' | 'fail';

const App: React.FC = () => {
  // --- Data Stores ---
  const [hasStarted, setHasStarted] = useState<boolean>(() => JSON.parse(localStorage.getItem('hasStarted') || 'false'));
  const [currentTab, setCurrentTab] = useState<Tab>('pending');
  
  const [metadata, setMetadata] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('metadata') || '[]'));
  const [audioPath, setAudioPath] = useState<string>(() => localStorage.getItem('audioPath') || '');
  
  const [audioFiles, setAudioFiles] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('audioFiles') || '[]'));
  const [correctData, setCorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('correctData') || '[]'));
  const [incorrectData, setIncorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem('incorrectData') || '[]'));
  const [changes, setChanges] = useState<Array<{original: string, changed: string}>>(() => JSON.parse(localStorage.getItem('changes') || '[]'));
  
  // --- UI States ---
  const [isSaving, setIsSaving] = useState(false);
  const [playingFile, setPlayingFile] = useState<string | null>(null);

  // --- Persistence ---
  useEffect(() => { localStorage.setItem('hasStarted', JSON.stringify(hasStarted)); }, [hasStarted]);
  useEffect(() => { localStorage.setItem('metadata', JSON.stringify(metadata)); }, [metadata]);
  useEffect(() => { localStorage.setItem('audioPath', audioPath); }, [audioPath]);
  useEffect(() => { localStorage.setItem('audioFiles', JSON.stringify(audioFiles)); }, [audioFiles]);
  useEffect(() => { localStorage.setItem('correctData', JSON.stringify(correctData)); }, [correctData]);
  useEffect(() => { localStorage.setItem('incorrectData', JSON.stringify(incorrectData)); }, [incorrectData]);
  useEffect(() => { localStorage.setItem('changes', JSON.stringify(changes)); }, [changes]);

  // Load Existing TSV on Start
  useEffect(() => {
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

  // --- Core Logic ---
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
    // Parse Changes (wrong,right)
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
    
    // Move Fail -> Correct
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

  if (!hasStarted) return (
    <UploadPage metadata={metadata} audioPath={audioPath} setAudioPath={setAudioPath}
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
      onScan={async () => {
        try {
          const res = await fetch(`http://localhost:3001/api/scan-audio`, {
             method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ path: audioPath })
          });
          const list: string[] = await res.json();
          const matched = list.map(p => {
             const n = p.split(/[/\\]/).pop() || '';
             const m = metadata.find(x => x.filename === n);
             return m ? { filename: n, text: m.text, audioPath: p } : null;
          }).filter(Boolean) as AudioItem[];
          
          if (matched.length) { setAudioFiles(matched); setHasStarted(true); }
          else alert('ไม่พบไฟล์ที่ตรงกัน');
        } catch { alert('Scan Error'); }
      }} 
    />
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="font-bold text-lg flex gap-2 items-center text-indigo-700">
          <List /> Audio Annotator
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
           {(['pending', 'correct', 'fail'] as Tab[]).map(t => (
             <button key={t} onClick={() => setCurrentTab(t)} 
               className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentTab === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>
               {t.charAt(0).toUpperCase() + t.slice(1)} ({t === 'pending' ? pending.length : t === 'correct' ? correct.length : incorrect.length})
             </button>
           ))}
        </div>
        <div className="flex items-center gap-3">
           {isSaving && <span className="text-xs text-indigo-500 flex gap-1"><Save size={14} className="animate-spin"/> Saving...</span>}
           <button onClick={() => setHasStarted(false)} className="p-2 hover:bg-red-50 text-red-500 rounded-full"><LogOut size={18}/></button>
        </div>
      </div>

      <div className="flex-1 container mx-auto p-6 max-w-6xl">
        {currentTab === 'pending' && <AnnotationPage pendingItems={pending} onDecision={handleDecision} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspect} />}
        {currentTab === 'correct' && <CorrectPage data={correct} onMoveToFail={(i)=>handleDecision(i, 'incorrect')} onDownload={downloadTSV} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspect} />}
        {currentTab === 'fail' && <EditPage data={incorrect} onSaveCorrection={handleCorrection} onDownload={downloadTSV} playAudio={playAudio} playingFile={playingFile} onInspectText={handleInspect} />}
      </div>
    </div>
  );
};
export default App;