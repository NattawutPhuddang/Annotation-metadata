import React, { useState, useMemo } from "react";
import {
  Download,
  Undo2,
  Play,
  Pause,
  FileText,
  Search,
  Filter,
  Trash2,
  FileX,
  Check
} from "lucide-react";
import { useAnnotation } from "../../context/AnnotationContext";
import { AudioItem } from "../../types";
import { Pagination } from "../../components/Shared/Pagination";
import { WaveformPlayer } from "../../components/AudioPlayer/WaveformPlayer";
import { audioService } from "../../api/audioService";
import "./CorrectPage.css";

const ITEMS_PER_PAGE = 10;

const CorrectPage: React.FC = () => {
  const {
    correctData,
    handleDecision,
    playAudio,
    playingFile,
    employeeId,
    audioFiles,
  } = useAnnotation();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLocalOnly, setShowLocalOnly] = useState(true);

  // --- Logic เดิม: Map File & Filter ---
  const fileMap = useMemo(() => {
    const m = new Map<string, string>();
    audioFiles.forEach((f) => {
      if (f.audioPath) m.set(f.filename, f.audioPath);
    });
    return m;
  }, [audioFiles]);

  const filteredItems = useMemo(() => {
    let data = correctData;
    if (showLocalOnly) {
      data = data.filter((item) => fileMap.has(item.filename));
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(
        (item) =>
          item.filename.toLowerCase().includes(lower) ||
          item.text.toLowerCase().includes(lower),
      );
    }
    return data;
  }, [correctData, searchTerm, showLocalOnly, fileMap]);

  const items = filteredItems.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

  // --- Download Logic ---
  const handleDownload = (data: AudioItem[], filename: string) => {
    const content =
      "filename\ttext\n" +
      data.map((i) => `${i.filename}\t${i.text}`).join("\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleDownloadPersonal = async () => {
    const filename = `${employeeId}-Correct.tsv`;
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || "http://10.2.98.118:3003"}/api/load-file?filename=${filename}`,
      );
      if (!res.ok) {
        alert("Personal log not found.");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    } catch (e) {
      alert("Error downloading log");
    }
  };

  return (
    <div className="correct-container animate-fade-in">
      {/* --- HEADER (คงไว้เหมือนเดิมเพราะ Annotation ไม่มีส่วนนี้) --- */}
      <div className="correct-header">
        <div className="header-left">
          <div className="header-title-row">
            <div className="header-title">
              <h2>Verified Items  <span className="badge-count">{filteredItems.length}</span></h2>
            </div>

            <div className="filter-group">
              <button
                onClick={() => { setShowLocalOnly(true); setPage(1); }}
                className={`btn-filter ${showLocalOnly ? "active" : ""}`}
              >
                <Filter size={14} /> Local Audio
              </button>
              <button
                onClick={() => { setShowLocalOnly(false); setPage(1); }}
                className={`btn-filter ${!showLocalOnly ? "active" : ""}`}
              >
                Show All History
              </button>
            </div>
          </div>

          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search filename or transcript..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="header-actions">
          <button onClick={handleDownloadPersonal} className="btn-download">
            <FileText size={16} /> Export My Log TSV
          </button>
          <button
            onClick={() => handleDownload(correctData, "Correct.tsv")}
            className="btn-download"
          >
            <Download size={16} /> Export All Data
          </button>
        </div>
      </div>

      {/* --- TABLE (ใช้สไตล์ AnnotationPage) --- */}
      <div className="table-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th className="w-[25%]">Audio</th>
              <th className="w-auto">Transcript</th>
              <th className="w-[120px] text-center">Undo</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => {
                const isPlaying = playingFile === item.filename;
                let src = item.audioPath;
                if (!src) src = fileMap.get(item.filename);
                if (src && !src.startsWith("blob:") && !src.startsWith("http")) {
                  src = audioService.getAudioUrl(src);
                }
                const hasAudio = src && src !== "";

                return (
                  <tr key={item.filename}>
                    {/* Audio Cell: สไตล์ AnnotationPage */}
                    <td>
                      <div className="audio-cell-content">
                        {/* Filename Badge */}
                        <div className="filename-badge" title={item.filename}>
                          {item.filename}
                        </div>

                        {/* Hero Play Button */}
                        {hasAudio ? (
                          <>
                            <button
                              onClick={() => playAudio({ ...item, audioPath: src })}
                              className={`btn-play-hero ${isPlaying ? "playing" : ""}`}
                            >
                              {isPlaying ? (
                                <Pause size={20} fill="currentColor" />
                              ) : (
                                <Play size={20} fill="currentColor" className="ml-1" />
                              )}
                            </button>
                            <div className="w-full px-4 mt-2">
                              <WaveformPlayer
                                audioUrl={src || ""}
                                isPlaying={isPlaying}
                                onPlayChange={(p) => !p && isPlaying && playAudio(item)}
                                progressColor="#10b981" /* สีเขียว Emerald */
                                height="h-1"
                              />
                            </div>
                          </>
                        ) : (
                          <div className="no-audio-state">
                            <FileX size={20} />
                            <span>ไม่มีไฟล์เสียง</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Transcript Cell */}
                    <td className="px-4">
                      <div className="text-display">{item.text}</div>
                    </td>

                    {/* Action Cell: ปุ่ม Undo */}
                    <td>
                      <div className="action-wrapper">
                         {/* Trash Button (Hover) */}
                         {/* <button 
                            className="btn-trash-float"
                            onClick={async (e) => { 
                              e.stopPropagation(); 
                              if (window.confirm(`Delete "${item.filename}" to trash?`)) {
                                try {
                                  await audioService.moveToTrash(item.filename, 'Correct.tsv');
                                  // อัปเดต state ของ context
                                  await handleDecision(item, 'incorrect');
                                } catch (error) {
                                  alert("Error deleting item: " + (error instanceof Error ? error.message : 'Unknown error'));
                                }
                              }
                            }}
                            title="Delete to trash"
                          >
                            <Trash2 size={12} />
                          </button> */}

                        <button
                          onClick={() => handleDecision(item, "incorrect")}
                          className="btn-action undo"
                          title="Undo to Pending"
                        >
                          <Undo2 size={20} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
               <tr>
                <td colSpan={3} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Filter size={24} className="opacity-20" />
                    <span>No verified items found.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center mt-8">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};

export default CorrectPage;