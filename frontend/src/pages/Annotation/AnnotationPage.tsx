import React, { useState, useEffect } from "react";
import { Check, X, Play, Pause, Info, CornerDownLeft, Delete, Keyboard, Trash2, ChevronsRight, BookOpen } from "lucide-react";
import { useAnnotation } from "../../context/AnnotationContext";
import { WaveformPlayer } from "../../components/AudioPlayer/WaveformPlayer";
import { TokenizedText } from "../../components/Tokenizer/TokenizedText";
import { Pagination } from "../../components/Shared/Pagination";
import { audioService } from "../../api/audioService";
import "./AnnotationPage.css";

const ITEMS_PER_PAGE = 10;

const AnnotationPage: React.FC = () => {
  const { 
    pendingItems, 
    handleDecision, 
    playAudio, 
    playingFile, 
    inspectText, 
    tokenCache,
    suggestions,  // ADD THIS
  } = useAnnotation();
  const [page, setPage] = useState(1);
  const [smartEdits, setSmartEdits] = useState<Record<string, Record<number, string>>>({});
  const [isGuideOpen, setIsGuideOpen] = useState(true);

  // Pagination
  const totalPages = Math.ceil(pendingItems.length / ITEMS_PER_PAGE);
  const items = pendingItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const firstItem = items[0];

  const handleSmartCorrection = (filename: string, idx: number, newWord: string | null) => {
    setSmartEdits(prev => {
      const fileEdits = { ...(prev[filename] || {}) };
      if (newWord === null) delete fileEdits[idx];
      else fileEdits[idx] = newWord;
      
      if (Object.keys(fileEdits).length === 0) {
        const next = { ...prev };
        delete next[filename];
        return next;
      }
      return { ...prev, [filename]: fileEdits };
    });
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!firstItem || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); playAudio(firstItem); }
      if (e.code === "Enter") { 
        e.preventDefault(); 
        handleDecision(firstItem, "correct", smartEdits[firstItem.filename]); 
        setSmartEdits(prev => { const n={...prev}; delete n[firstItem.filename]; return n; });
      }
      if (e.code === "Backspace") { e.preventDefault(); handleDecision(firstItem, "incorrect"); }
      if (e.code === "Slash" && e.ctrlKey) setIsGuideOpen(prev => !prev);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [firstItem, playAudio, handleDecision, smartEdits]);

  if (pendingItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in text-slate-400">
        <div className="w-16 h-16 bg-green-50 text-green-400 rounded-full flex items-center justify-center mb-4 shadow-sm">
          <Check size={32} />
        </div>
        <h3 className="text-xl font-semibold text-slate-600">All caught up!</h3>
        <p>No pending items to review.</p>
      </div>
    );
  }

  return (
    <div className="anno-container animate-fade-in">
      <div className="anno-layout">
        
        {/* --- LEFT: Main Table --- */}
        <div className="main-panel">
          <table className="custom-table">
            <thead>
              <tr>
                <th className="w-[25%]">Audio</th>
                <th className="w-auto">Transcript</th>
                <th className="w-[140px] text-center">Decision</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const isPlaying = playingFile === item.filename;
                const fileEdits = smartEdits[item.filename] || {};
                const tokens = tokenCache.get(item.text);

                return (
                  <tr key={item.filename}>
                    {/* Audio Cell */}
                    <td>
                      <div className="audio-cell-content">
                        <div className="filename-badge" title={item.filename}>{item.filename}</div>
                        <button 
                          onClick={() => playAudio(item)}
                          className={`btn-play-hero ${isPlaying ? 'playing' : ''}`}
                        >
                          {isPlaying ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor" className="ml-1"/>}
                        </button>
                        {item.audioPath && (
                          <div className="w-full px-2">
                             <WaveformPlayer 
                                audioUrl={item.audioPath}
                                isPlaying={isPlaying}
                                onPlayChange={(p) => !p && isPlaying && playAudio(item)}
                                progressColor="#818cf8"
                                height="h-1"
                              />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Text Cell */}
                    <td>
                      <TokenizedText
                        text={item.text}
                        onInspect={inspectText}
                        tokens={tokens}
                        suggestions={suggestions}  // ADD THIS LINE
                        appliedEdits={fileEdits}
                        onApplyCorrection={(i, word) => handleSmartCorrection(item.filename, i, word)}
                      />
                    </td>

                    {/* Action Cell */}
                    <td>
                      <div className="action-wrapper">
                        {/* 🗑️ Trash Button (Float on Hover) */}
                        <button 
                          className="btn-trash-float"
                          title="Delete to trash"
                          onClick={async (e) => { 
                            e.stopPropagation(); 
                            if (window.confirm(`Delete "${item.filename}" to trash?`)) {
                              try {
                                await audioService.moveToTrash(item.filename, 'Correct.tsv');
                                // อัปเดต state เพื่อให้รายการลบออกจากรายการที่พิจารณา
                                await handleDecision(item, 'incorrect');
                              } catch (error) {
                                alert("Error deleting item: " + (error instanceof Error ? error.message : 'Unknown error'));
                              }
                            }
                          }}
                        >
                          <Trash2 size={12} />
                        </button>

                        <div className="decision-group">
                          <button
                            onClick={() => {
                                handleDecision(item, "correct", fileEdits);
                                setSmartEdits(prev => { const n={...prev}; delete n[item.filename]; return n; });
                            }}
                            className="btn-action correct"
                            title="Correct (Enter)"
                          >
                            <Check size={20} strokeWidth={3} />
                          </button>
                          <button
                            onClick={() => handleDecision(item, "incorrect")}
                            className="btn-action incorrect"
                            title="Incorrect (Backspace)"
                          >
                            <X size={20} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <div className="flex justify-center mt-6">
             <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>

        {/* --- RIGHT: Guideline Panel --- */}
        <aside 
          className={`guideline-panel ${!isGuideOpen ? 'collapsed' : ''}`}
          onClick={() => !isGuideOpen && setIsGuideOpen(true)}
        >
          {/* Header */}
          <div className="guide-header">
             <h3><BookOpen size={18} className="text-primary"/> คำแนะนำ</h3>
             <div className="btn-collapse" onClick={(e) => { e.stopPropagation(); setIsGuideOpen(!isGuideOpen); }}>
                <ChevronsRight size={18} className={`transition-transform ${!isGuideOpen ? 'rotate-180' : ''}`}/>
             </div>
          </div>

          {/* Collapsed Vertical Text */}
          <div className="vertical-label">
            <Info size={16}/> คำแนะนำการตรวจสอบ
          </div>

          {/* Full Content */}
          <div className="guide-content">
            <div className="guide-item">
              <div className="guide-icon"></div>
              <div>คำซ้ำใช้ <span className="highlight">ๆ</span> <div className="text-slate-400 text-xs">"อื่นๆ", "ไปๆ มาๆ"</div></div>
            </div>
            <div className="guide-item">
              <div className="guide-icon"></div>
              <div>คำย่อใช้ <span className="highlight">ฯ</span> <div className="text-slate-400 text-xs">"จังหวัดกาญฯ"</div></div>
            </div>
            <div className="guide-item">
              <div className="guide-icon"></div>
              <div>ตัวเลข <span className="highlight">อารบิก</span> <div className="text-slate-400 text-xs">"10คน", "10:30"</div></div>
            </div>
            <div className="guide-item">
              <div className="guide-icon"></div>
              <div>เสียงซ้อน <span className="highlight bg-red-50 text-red-600 border-red-200">ทิ้งถังขยะ</span></div>
            </div>

            <div className="shortcut-grid">
               <div className="shortcut-item">
                  <span className="flex items-center gap-2 text-slate-500"><Play size={12}/> Play</span>
                  <span className="key-badge">Space</span>
               </div>
               <div className="shortcut-item">
                  <span className="flex items-center gap-2 text-green-600"><Check size={12}/> Correct</span>
                  <span className="key-badge">Enter</span>
               </div>
               <div className="shortcut-item">
                  <span className="flex items-center gap-2 text-red-600"><X size={12}/> Fail</span>
                  <span className="key-badge">Back</span>
               </div>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
};

export default AnnotationPage;