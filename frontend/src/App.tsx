import React, { useState, useEffect, useMemo } from "react";
import "./App.css";
import { AudioItem } from "./types";
import UploadPage from "./pages/UploadPage";
import AnnotationPage from "./pages/AnnotationPage";
import CorrectPage from "./pages/CorrectPage";
import EditPage from "./pages/EditPage";
import { LogOut, Save, Music } from "lucide-react";
import { LoadingOverlay } from "./components/LoadingOverlay"; // 🟢 Import

type Tab = "pending" | "correct" | "fail";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3003";

const App: React.FC = () => {
  // --- Data Stores ---
  const [hasStarted, setHasStarted] = useState<boolean>(() =>
    JSON.parse(localStorage.getItem("hasStarted") || "false")
  );
  const [currentTab, setCurrentTab] = useState<Tab>("pending");

  const [metadata, setMetadata] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("metadata") || "[]")
  );
  const [audioPath, setAudioPath] = useState<string>(
    () => localStorage.getItem("audioPath") || ""
  );

  const [audioFiles, setAudioFiles] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("audioFiles") || "[]")
  );

  const [correctData, setCorrectData] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("correctData") || "[]")
  );
  const [incorrectData, setIncorrectData] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("incorrectData") || "[]")
  );
  const [changes, setChanges] = useState<Array<{ original: string; changed: string }>>(() => 
    JSON.parse(localStorage.getItem("changes") || "[]")
  );

  // 🟢 New State for Performance
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [tokenCache, setTokenCache] = useState<Map<string, string[]>>(new Map());

  const [isSaving, setIsSaving] = useState(false);
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false); // ยังเก็บไว้ใช้กับ UploadPage
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<File[]>([]);

  // --- Persistence ---
  useEffect(() => { localStorage.setItem("hasStarted", JSON.stringify(hasStarted)); }, [hasStarted]);
  useEffect(() => { localStorage.setItem("metadata", JSON.stringify(metadata)); }, [metadata]);
  useEffect(() => { localStorage.setItem("audioPath", audioPath); }, [audioPath]);
  useEffect(() => {
    const safeToSave = audioFiles.map((a) => ({ ...a, audioPath: "" }));
    localStorage.setItem("audioFiles", JSON.stringify(safeToSave));
  }, [audioFiles]);
  useEffect(() => { localStorage.setItem("correctData", JSON.stringify(correctData)); }, [correctData]);
  useEffect(() => { localStorage.setItem("incorrectData", JSON.stringify(incorrectData)); }, [incorrectData]);
  useEffect(() => { localStorage.setItem("changes", JSON.stringify(changes)); }, [changes]);

  // --- 1. Fix Stale URLs & Load Data ---
  useEffect(() => {
    const savedAudioFiles = JSON.parse(localStorage.getItem("audioFiles") || "[]");
    if (savedAudioFiles.length > 0) {
      const samplePath = savedAudioFiles[0].audioPath || "";
      if (samplePath.startsWith("blob:") || samplePath.includes(":")) {
        console.log("Clearing stale audio paths...");
        setAudioFiles([]);
        setHasStarted(false);
        setAudioPath("");
        localStorage.removeItem("audioFiles");
      }
    }

    const loadTSV = async (name: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/load-file?filename=${name}`);
        if (!res.ok) return [];
        const txt = await res.text();
        return txt.split("\n").slice(1).map((r) => {
            const [f, t] = r.trim().split("\t");
            return f && t ? { filename: f, text: t } : null;
          }).filter(Boolean) as AudioItem[];
      } catch { return []; }
    };

    const loadChanges = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/load-file?filename=ListOfChange.tsv`);
        if (!res.ok) return [];
        const txt = await res.text();
        return txt.split("\n").slice(1).map((r) => {
            const [o, c] = r.trim().split("\t");
            return o && c ? { original: o, changed: c } : null;
          }).filter(Boolean);
      } catch { return []; }
    };

    Promise.all([loadTSV("Correct.tsv"), loadTSV("fail.tsv"), loadChanges()])
      .then(([c, f, ch]) => {
        if (c.length) setCorrectData(c);
        if (f.length) setIncorrectData(f);
        if (ch.length) setChanges(ch as any);
      });
  }, []);

  // --- 2. Check Refresh ---
  useEffect(() => {
    if (hasStarted && audioFiles.length > 0 && !audioFiles[0].audioPath) {
      alert("⚠️ กรุณาเลือกโฟลเดอร์ไฟล์เสียงใหม่อีกครั้ง\n(เนื่องจาก Browser รีเฟรชหน้าจอทำให้การเชื่อมต่อไฟล์หลุดไป)");
      setHasStarted(false);
      setAudioFiles([]);
      setAudioPath("");
    }
  }, [hasStarted, audioFiles]);

  // --- 🟢 3. Pre-Tokenization Logic (Batch) ---
  const preTokenize = async (items: AudioItem[]) => {
    // กรองเอาเฉพาะ Text ที่ยังไม่มีใน Cache
    const uniqueTexts = Array.from(new Set(items.map(i => i.text)))
      .filter(t => !tokenCache.has(t));
    
    if (uniqueTexts.length === 0) return;

    // ตัดทีละ 50 คำ (Chunking)
    const chunkSize = 50;
    const newCache = new Map(tokenCache); // Clone map เดิม

    for (let i = 0; i < uniqueTexts.length; i += chunkSize) {
       const chunk = uniqueTexts.slice(i, i + chunkSize);
       try {
         // เรียก API ตัวใหม่ที่ส่งไปเป็น Array
         const res = await fetch(`${API_BASE}/api/tokenize-batch`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ texts: chunk })
         });
         const tokensList = await res.json();
         
         // จับคู่ผลลัพธ์ลง Map
         chunk.forEach((txt, idx) => {
            if (tokensList[idx]) newCache.set(txt, tokensList[idx]);
         });
       } catch (e) { 
         console.error("Batch tokenize failed", e); 
       }
    }
    setTokenCache(newCache);
  };

  // --- Logic Functions ---
  const fileMap = useMemo(() => {
    const m = new Map<string, string>();
    audioFiles.forEach((f) => { if (f.audioPath) m.set(f.filename, f.audioPath); });
    return m;
  }, [audioFiles]);

  const enrich = (items: AudioItem[]) =>
    items.map((i) => {
      let src = i.audioPath;
      if (!src) src = fileMap.get(i.filename);
      if (src && !src.startsWith("blob:") && !src.startsWith("http")) {
        src = `${API_BASE}/api/audio?path=${encodeURIComponent(src)}`;
      }
      return { ...i, audioPath: src };
    });

  const saveFile = async (name: string, data: AudioItem[]) => {
    setIsSaving(true);
    const content = "filename\ttext\n" + data.map((i) => `${i.filename}\t${i.text}`).join("\n");
    await fetch(`${API_BASE}/api/save-file`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: name, content }),
    });
    setIsSaving(false);
  };

  const autoSave = (c: AudioItem[], f: AudioItem[]) => {
    saveFile("Correct.tsv", c);
    saveFile("fail.tsv", f);
  };

  const playAudio = (item: AudioItem) => {
    if (item.audioPath && !item.audioPath.startsWith("blob:")) {
        // Already handled by enrich, but safe to keep check
    }
    setPlayingFile((curr) => (curr === item.filename ? null : item.filename));
  };

  const handleDecision = (item: AudioItem, status: "correct" | "incorrect") => {
    const newC = status === "correct" ? [...correctData, item] : correctData.filter((i) => i.filename !== item.filename);
    const newF = status === "incorrect" ? [...incorrectData, item] : incorrectData.filter((i) => i.filename !== item.filename);
    setCorrectData(newC);
    setIncorrectData(newF);
    autoSave(newC, newF);
  };

  const handleCorrection = async (item: AudioItem, newText: string) => {
    const matches = [...newText.matchAll(/\(([^,]+),([^)]+)\)/g)];
    if (matches.length > 0) {
      for (const m of matches) {
        try {
          await fetch(`${API_BASE}/api/append-change`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ original: m[1], changed: m[2] }),
          });
        } catch (err) { console.error("Save change failed", err); }
      }
      const newChanges = [...changes, ...matches.map((m) => ({ original: m[1], changed: m[2] }))];
      setChanges(newChanges);
    }
    const cleanText = newText.replace(/\(([^,]+),([^)]+)\)/g, "$2");
    const newItem = { ...item, text: cleanText };
    const newF = incorrectData.filter((i) => i.filename !== item.filename);
    const newC = [...correctData, newItem];
    setIncorrectData(newF);
    setCorrectData(newC);
    autoSave(newC, newF);
  };

  // Fallback for individual inspect (EditPage might use this)
  const handleInspect = async (text: string) => {
    // Try cache first
    if (tokenCache.has(text)) return tokenCache.get(text) || [];
    try {
      const res = await fetch(`${API_BASE}/api/tokenize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return await res.json();
    } catch { return []; }
  };

  const downloadTSV = (data: AudioItem[], name: string) => {
    const content = "filename\ttext\n" + data.map((i) => `${i.filename}\t${i.text}`).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  // --- Filtering ---
  const pending = enrich(
    audioFiles.filter((i) =>
        !correctData.some((c) => c.filename === i.filename) &&
        !incorrectData.some((f) => f.filename === i.filename)
    ),
  );
  const correct = enrich(correctData);
  const incorrect = enrich(incorrectData);

  // 🟢 Effect: Background Pre-loading
  // เมื่อรายการ Pending เปลี่ยน (เช่น เริ่มต้น หรือทำงานเสร็จไปบ้างแล้ว)
  // ให้โหลด Token ของรายการถัดๆ ไปมารอไว้ (เช่น 30 รายการถัดไป)
  useEffect(() => {
     if (pending.length > 0) {
        preTokenize(pending.slice(0, 30)); 
     }
  }, [pending.length, hasStarted]); // dependencies: เมื่อจำนวนเปลี่ยน หรือเพิ่งเริ่ม

  // --- Render ---
  if (!hasStarted)
    return (
      <>
      <LoadingOverlay isVisible={isLoading} message={loadingMsg} />
      <UploadPage
        metadata={metadata}
        audioPath={audioPath}
        setAudioPath={setAudioPath}
        isScanning={isScanning}
        onFolderSelect={(fileList) => {
          setSelectedLocalFiles(Array.from(fileList));
          if (fileList.length > 0) {
            const name = fileList[0].webkitRelativePath.split("/")[0] || "Selected Folder";
            setAudioPath(`${name} (${fileList.length} files)`);
          }
        }}
        onMetadataUpload={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            const r = new FileReader();
            r.onload = (ev) => {
              const rows = (ev.target?.result as string).split("\n");
              setMetadata(
                rows.slice(1).map((x) => {
                    const [n, t] = x.split("\t");
                    return { filename: n, text: t };
                  }).filter((x) => x.filename),
              );
            };
            r.readAsText(f);
          }
        }}
        onScan={async () => {
          setIsLoading(true); // 🟢 Show Overlay
          setLoadingMsg("Scanning audio files...");
          await new Promise((r) => setTimeout(r, 500));

          try {
            let matched: AudioItem[] = [];
            if (selectedLocalFiles.length > 0) {
              // Local Scan Logic
              const fileMap = new Map<string, File>();
              for (const f of selectedLocalFiles) {
                fileMap.set(f.name, f);
                const nameNoExt = f.name.substring(0, f.name.lastIndexOf("."));
                if (nameNoExt) fileMap.set(nameNoExt, f);
              }
              matched = metadata.map((m) => {
                  const file = fileMap.get(m.filename);
                  return file ? { filename: m.filename, text: m.text, audioPath: URL.createObjectURL(file) } : null;
                }).filter(Boolean) as AudioItem[];
            } else {
              // Server Scan Logic
              if(!audioPath) { alert("Please specify folder path"); return; }
              const res = await fetch(`${API_BASE}/api/scan-audio`, {
                  method: 'POST', headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({ path: audioPath })
               });
               const serverFiles: string[] = await res.json();
               const serverFileMap = new Map<string, string>();
               serverFiles.forEach(p => {
                  const fname = p.split(/[/\\]/).pop() || '';
                  serverFileMap.set(fname, p);
                  const nameNoExt = fname.substring(0, fname.lastIndexOf('.'));
                  if (nameNoExt) serverFileMap.set(nameNoExt, p);
               });
               matched = metadata.map(m => {
                  const path = serverFileMap.get(m.filename);
                  return path ? { filename: m.filename, text: m.text, audioPath: path } : null;
               }).filter(Boolean) as AudioItem[];
            }

            if (matched.length) {
              setAudioFiles(matched);
              
              // 🟢 Pre-load Tokenization (Batch) ก่อนเข้าหน้าเว็บ
              setLoadingMsg(`Optimizing ${Math.min(matched.length, 100)} items...`);
              await preTokenize(matched.slice(0, 100)); // โหลดรอไว้เลย 100 อันแรก
              
              setHasStarted(true);
            } else {
              alert(`ไม่พบไฟล์เสียงที่ตรงกันเลย\n(โปรดตรวจสอบชื่อไฟล์ใน Metadata)`);
            }
          } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาดในการประมวลผลไฟล์");
          } finally {
            setIsLoading(false); // 🟢 Hide Overlay
            setIsScanning(false);
          }
        }}
      />
      </>
    );

  return (
    <div className="app-container">
      {/* 🟢 Loading Overlay (เผื่อไว้ใช้ตอน Save) */}
      <LoadingOverlay isVisible={isLoading} message={loadingMsg} />
      
      <header className={`app-header ${window.scrollY > 10 ? "scrolled" : ""}`}>
        <div className="header-logo">
          <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg">
            <Music size={20} />
          </div>
          <span>Audio Annotator</span>
        </div>

        <div className="nav-pills">
          {(["pending", "correct", "fail"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setCurrentTab(t)}
              className={`nav-item ${currentTab === t ? `active tab-${t}` : ""}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              <span className="ml-2 text-xs opacity-60">
                {t === "pending" ? pending.length : t === "correct" ? correct.length : incorrect.length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {isSaving && (
            <span className="text-xs text-indigo-400 flex gap-2 items-center">
              <Save size={14} className="animate-spin" /> Saving changes...
            </span>
          )}
          <button
            onClick={() => {
              setHasStarted(false);
              setAudioFiles([]);
              setSelectedLocalFiles([]);
              setAudioPath("");
              setTokenCache(new Map()); // Clear cache
            }}
            className="btn-icon text-red-300 hover:text-red-500 hover:bg-red-50"
            title="Logout / Change Folder"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="main-content animate-fade-in">
        {currentTab === "pending" && (
          <AnnotationPage
            pendingItems={pending}
            onDecision={handleDecision}
            playAudio={playAudio}
            playingFile={playingFile}
            onInspectText={handleInspect}
            tokenCache={tokenCache} // 🟢 ส่ง Cache ไปให้ใช้
          />
        )}
        {currentTab === "correct" && (
          <CorrectPage
            data={correct}
            onMoveToFail={(i) => handleDecision(i, "incorrect")}
            onDownload={downloadTSV}
            playAudio={playAudio}
            playingFile={playingFile}
            onInspectText={handleInspect}
          />
        )}
        {currentTab === "fail" && (
          <EditPage
            data={incorrect}
            onSaveCorrection={handleCorrection}
            onDownload={downloadTSV}
            playAudio={playAudio}
            playingFile={playingFile}
            onInspectText={handleInspect}
          />
        )}
      </main>
    </div>
  );
};
export default App;