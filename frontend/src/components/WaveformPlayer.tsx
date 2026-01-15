import React, { useEffect, useRef } from 'react';

interface WaveformPlayerProps {
  audioPath: string;
  isPlaying: boolean;
  onPlayChange: (playing: boolean) => void;
}

// React.memo ช่วยให้ไม่กระตุกเวลาพิมพ์แก้คำ
export const WaveformPlayer = React.memo<WaveformPlayerProps>(({ audioPath, isPlaying, onPlayChange }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      if (audio.paused) audio.play().catch(() => {}); // catch error เล่นซ้อน
    } else {
      if (!audio.paused) audio.pause();
    }
  }, [isPlaying, audioPath]);

  return (
    <div className="w-full bg-white rounded-lg border border-slate-200 p-2 flex items-center shadow-sm">
      <audio
        ref={audioRef}
        src={audioPath}
        controls
        controlsList="nodownload"
        className="w-full h-8 accent-indigo-600"
        onPlay={() => !isPlaying && onPlayChange(true)}
        onPause={() => isPlaying && onPlayChange(false)}
        onEnded={() => onPlayChange(false)}
      />
    </div>
  );
}, (prev, next) => prev.audioPath === next.audioPath && prev.isPlaying === next.isPlaying);