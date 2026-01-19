import React, { useState } from "react";
import { X, Download, Play, Pause } from "lucide-react";
import { AudioItem } from "../types";
import { Pagination } from "../components/Pagination";
import { TokenizedText } from "../components/TokenizedText";
import { WaveformPlayer } from "../components/WaveformPlayer";
import { DownloadButton } from "../components/DownloadButton";

interface Props {
  data: AudioItem[];
  onMoveToFail: (item: AudioItem) => void;
  onDownload: (data: AudioItem[], filename: string) => void;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  onInspectText: (text: string) => Promise<string[]>;
}

const ITEMS_PER_PAGE = 10;

const CorrectPage: React.FC<Props> = ({
  data,
  onMoveToFail,
  onDownload,
  playAudio,
  playingFile,
  onInspectText,
}) => {
  const [page, setPage] = useState(1);
  const items = data.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (data.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <Download size={32} className="text-slate-300" />
        </div>
        No correct items yet.
      </div>
    );

  return (
    <div className="animate-fade-in">
      {/* --- ส่วนที่แก้ไข Header --- */}
      <div className="flex items-center justify-between mb-6 w-full">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-success">Correct Items</h2>
          <span className="px-2 py-1 bg-success-bg text-success text-xs font-bold rounded-full border border-emerald-100">
            {data.length}
          </span>
        </div>

        {/* ปุ่มจะถูกดันมาขวาสุดด้วย justify-between */}
        <DownloadButton
          onClick={() => onDownload(data, "Correct.tsv")}
          variant="success"
          className="shadow-sm hover:shadow-md transition-shadow"
        />
      </div>

      <div className="minimal-card mb-8">
        <table className="custom-table">
          <thead>
            <tr>
              <th className="w-16 text-center">No.</th>
              <th className="w-[40%]">Audio Source</th>
              <th>Transcript</th>
              <th className="w-20 text-center">Revert</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isPlaying = playingFile === item.filename;
              return (
                <tr key={item.filename} className="row-hover">
                  <td className="text-center align-middle">
                    <span className="text-xs font-mono text-slate-300">
                      {(page - 1) * ITEMS_PER_PAGE + idx + 1}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div
                          className="text-xs text-slate-500 font-medium truncate"
                          title={item.filename}
                        >
                          {item.filename}
                        </div>
                        <button
                          onClick={() => playAudio(item)}
                          className={`btn-icon w-8 h-8 text-success hover:bg-emerald-100 ${isPlaying ? "bg-emerald-50" : ""}`}
                        >
                          {isPlaying ? (
                            <Pause size={16} fill="currentColor" />
                          ) : (
                            <Play
                              size={16}
                              fill="currentColor"
                              className="ml-0.5"
                            />
                          )}
                        </button>
                      </div>

                      {item.audioPath ? (
                        <WaveformPlayer
                          audioUrl={item.audioPath}
                          isPlaying={isPlaying}
                          onPlayChange={(p: boolean) => {
                            if (p !== isPlaying) playAudio(item);
                          }}
                          progressColor="#10b981" // Emerald Color
                        />
                      ) : (
                        <span className="text-xs text-emerald-300">
                          Audio missing
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="align-middle">
                    <div className="text-token pl-4 border-l-2 border-emerald-100 py-1">
                      <TokenizedText
                        text={item.text}
                        onInspect={onInspectText}
                      />
                    </div>
                  </td>
                  <td className="text-center align-middle">
                    <button
                      onClick={() => onMoveToFail(item)}
                      className="btn-icon bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white"
                    >
                      <X size={20} strokeWidth={2.5} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center pb-10">
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(data.length / ITEMS_PER_PAGE)}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};
export default CorrectPage;
