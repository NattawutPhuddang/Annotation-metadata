import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { AudioItem } from "../types";
import { audioService } from "../api/audioService";

// 1. Define Shape of Context
interface AnnotationContextType {
  // Session
  employeeId: string;
  setEmployeeId: (id: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  logout: () => void;

  // Data State
  audioFiles: AudioItem[];
  setAudioFiles: React.Dispatch<React.SetStateAction<AudioItem[]>>;
  correctData: AudioItem[];
  incorrectData: AudioItem[];
  setIncorrectData: React.Dispatch<React.SetStateAction<AudioItem[]>>;
  changes: Array<{ original: string; changed: string }>;
  pendingItems: AudioItem[];
  
  // UI State
  isLoading: boolean;
  loadingMsg: string;
  setLoading: (loading: boolean, msg?: string) => void;
  
  // Audio & Setup
  audioPath: string;
  setAudioPath: (path: string) => void;
  hasStarted: boolean;
  setHasStarted: (started: boolean) => void;
  
  // Cache & NLP
  tokenCache: Map<string, string[]>;
  suggestions: Map<string, string>;  // ADD THIS LINE
  inspectText: (text: string) => Promise<string[]>;
  
  // Actions
  handleDecision: (item: AudioItem, status: "correct" | "incorrect", smartEdits?: Record<number, string>) => Promise<void>;
  handleCorrection: (item: AudioItem, newText: string) => Promise<void>;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  getFileName: (base: string) => string;
}

const AnnotationContext = createContext<AnnotationContextType | undefined>(undefined);

// 2. Provider Component
export const AnnotationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- State Declarations ---
  const [employeeId, setEmployeeId] = useState<string>(() => localStorage.getItem("employeeId") || "");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => JSON.parse(localStorage.getItem("isDarkMode") || "false"));
  
  const [hasStarted, setHasStarted] = useState<boolean>(() => JSON.parse(localStorage.getItem("hasStarted") || "false"));
  const [audioPath, setAudioPath] = useState<string>(() => localStorage.getItem("audioPath") || "");
  
  const [audioFiles, setAudioFiles] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem("audioFiles") || "[]"));
  const [correctData, setCorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem("correctData") || "[]"));
  const [incorrectData, setIncorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem("incorrectData") || "[]"));
  const [changes, setChanges] = useState<Array<{ original: string; changed: string }>>(() => JSON.parse(localStorage.getItem("changes") || "[]"));
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [tokenCache, setTokenCache] = useState<Map<string, string[]>>(new Map());
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [lastChangeMtime, setLastChangeMtime] = useState<number>(0);

  // --- Helper Methods ---
  const setLoading = (loading: boolean, msg = "") => {
    setIsLoading(loading);
    setLoadingMsg(msg);
  };

  const getFileName = useCallback((base: string) => `${employeeId}-${base}`, [employeeId]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const logout = () => {
    if (window.confirm("Log out from workspace?")) {
      setEmployeeId("");
      localStorage.removeItem("employeeId");
      setHasStarted(false);
      setAudioFiles([]);
      setAudioPath("");
      setTokenCache(new Map());
    }
  };

  const playAudio = (item: AudioItem) => {
    setPlayingFile(curr => (curr === item.filename ? null : item.filename));
  };

  // --- Effects ---
  // Theme Effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
    localStorage.setItem("isDarkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Persist Data Effect
  useEffect(() => {
    if (employeeId) localStorage.setItem("employeeId", employeeId);
    localStorage.setItem("hasStarted", JSON.stringify(hasStarted));
    localStorage.setItem("audioPath", audioPath);
    // Note: Don't persist full audioFiles with blob URLs if possible, strict to logic
    const safeToSave = audioFiles.map((a) => ({ ...a, audioPath: "" })); 
    localStorage.setItem("audioFiles", JSON.stringify(safeToSave));
    localStorage.setItem("correctData", JSON.stringify(correctData));
    localStorage.setItem("incorrectData", JSON.stringify(incorrectData));
    localStorage.setItem("changes", JSON.stringify(changes));
  }, [employeeId, hasStarted, audioPath, audioFiles, correctData, incorrectData, changes]);

  // Initial Load & Sync
  useEffect(() => {
    if (!employeeId) return;

    // Load initial data
    Promise.all([
      audioService.loadTSV("Correct.tsv"), 
      audioService.loadTSV("fail.tsv")
    ]).then(([c, f]) => {
      if (c.length) setCorrectData(c.reverse());
      if (f.length) setIncorrectData(f.reverse());
    });

    // Sync Logic
    const syncChanges = async () => {
      const serverMtime = await audioService.checkFileMtime("ListOfChange.tsv");
      if (serverMtime !== lastChangeMtime && serverMtime !== 0) {
        const newChanges = await audioService.loadChanges();
        setChanges(newChanges);
        setLastChangeMtime(serverMtime);
      }
    };

    syncChanges();
    const interval = setInterval(syncChanges, 10000);
    return () => clearInterval(interval);
  }, [employeeId, lastChangeMtime]); // Added lastChangeMtime dependency to keep logic consistent with original

  // --- Core Business Logic ---

  // 1. Inspect / Tokenize
  const inspectText = async (text: string) => {
    if (tokenCache.has(text)) return tokenCache.get(text) || [];
    try {
      const tokens = await audioService.tokenize(text);
      setTokenCache(prev => new Map(prev).set(text, tokens));
      return tokens;
    } catch {
      return [];
    }
  };

  // 2. Decision Logic (Correct/Fail)
  const handleDecision = async (item: AudioItem, status: "correct" | "incorrect", smartEdits?: Record<number, string>) => {
    let finalItem = { ...item };

    // Merge Smart Edits if any
    if (smartEdits && Object.keys(smartEdits).length > 0) {
        let tokens = tokenCache.get(item.text);
        if (!tokens) tokens = await inspectText(item.text);
        
        if (tokens.length > 0) {
            const newText = tokens.map((t, i) => smartEdits[i] || t).join("");
            finalItem.text = newText;
             // Clear cache for this text as it changed
            setTokenCache(prev => {
                const next = new Map(prev);
                next.delete(item.text);
                return next;
            });
        }
    }

    // Update State
    if (status === "correct") {
      setCorrectData(prev => [finalItem, ...prev]);
      setIncorrectData(prev => prev.filter(i => i.filename !== finalItem.filename));
      
      // API Calls
      await audioService.appendTsv("Correct.tsv", finalItem);
      await audioService.deleteTsvEntry("fail.tsv", finalItem.filename);
      
      // Log User Action
      const logName = getFileName("Correct.tsv");
      await audioService.appendTsv(logName, finalItem);

    } else {
      setIncorrectData(prev => [finalItem, ...prev]);
      setCorrectData(prev => prev.filter(i => i.filename !== finalItem.filename));

      // API Calls
      await audioService.appendTsv("fail.tsv", finalItem);
      await audioService.deleteTsvEntry("Correct.tsv", finalItem.filename);
      
      // Delete User Log if exists
      const logName = getFileName("Correct.tsv");
      await audioService.deleteTsvEntry(logName, finalItem.filename); // Assuming using delete-tsv-entry logic
    }
  };

  // 3. Correction Logic (Edit Page)
  const handleCorrection = async (item: AudioItem, newText: string) => {
    // Check for pattern (original,changed)
    const matches = [...newText.matchAll(/\(([^,]+),([^)]+)\)/g)];
    if (matches.length > 0) {
      for (const m of matches) {
        await audioService.saveChangeLog(m[1], m[2]);
      }
      // Optimistic update for changes
      const newChanges = matches.map(m => ({ original: m[1], changed: m[2] }));
      setChanges(prev => [...prev, ...newChanges]);
    }

    const cleanText = newText.replace(/\(([^,]+),([^)]+)\)/g, "$2");
    const newItem = { ...item, text: cleanText };

    // Move to Correct
    setIncorrectData(prev => prev.filter(i => i.filename !== item.filename));
    setCorrectData(prev => [newItem, ...prev]);

    // API Calls
    await audioService.appendTsv("Correct.tsv", newItem);
    await audioService.deleteTsvEntry("fail.tsv", item.filename);
    
    const logName = getFileName("Correct.tsv");
    await audioService.appendTsv(logName, newItem);
  };

  // Derived State: Pending Items
  const pendingItems = useMemo(() => {
    // Enrich with audio URL logic on the fly or pre-process
    // For simplicity, let's filter first
    const rawPending = audioFiles.filter(
      (i) => !correctData.some((c) => c.filename === i.filename) &&
             !incorrectData.some((f) => f.filename === i.filename)
    );
    
    // Enrich Logic (Move here to avoid clutter in Component)
    const fileMap = new Map<string, string>();
    audioFiles.forEach(f => { if(f.audioPath) fileMap.set(f.filename, f.audioPath) });

    return rawPending.map(i => {
         let src = i.audioPath;
         if (!src) src = fileMap.get(i.filename);
         if (src && !src.startsWith("blob:") && !src.startsWith("http")) {
             src = audioService.getAudioUrl(src); // Use service helper
         }
         return { ...i, audioPath: src };
    });
  }, [audioFiles, correctData, incorrectData]);

  // Create suggestions map from changes for O(1) lookup
  const suggestions = useMemo(() => {
    const map = new Map<string, string>();
    changes.forEach(c => {
      map.set(c.original, c.changed);
    });
    return map;
  }, [changes]);

  // --- Refresh/Unload Handler (Silent - No Browser Dialog) ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasStarted && audioFiles.length > 0) {
        // Just return false to prevent default, don't show browser dialog
        return false;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasStarted, audioFiles.length]);

  return (
    <AnnotationContext.Provider value={{
      employeeId, setEmployeeId,
      isDarkMode, toggleTheme, logout,
      audioFiles, setAudioFiles,
      correctData, incorrectData, setIncorrectData, changes, pendingItems,
      isLoading, loadingMsg, setLoading,
      audioPath, setAudioPath, hasStarted, setHasStarted,
      tokenCache, suggestions,  // ADD suggestions HERE
      inspectText,
      handleDecision, handleCorrection,
      playAudio, playingFile, getFileName
    }}>
      {children}
    </AnnotationContext.Provider>
  );
};

// 3. Custom Hook
export const useAnnotation = () => {
  const context = useContext(AnnotationContext);
  if (!context) throw new Error("useAnnotation must be used within AnnotationProvider");
  return context;
};