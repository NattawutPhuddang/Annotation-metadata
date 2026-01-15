import React, { useEffect, useRef } from 'react';

interface AudioPlayerProps {
  audioPath: string;
  isPlaying: boolean;
  onPlayChange: (playing: boolean) => void;
}

// ใช้ React.memo เพื่อให้ Render เฉพาะตอนจำเป็น (แก้เครื่องหน่วง)
export const WaveformPlayer = React.memo<AudioPlayerProps>(({ audioPath, isPlaying, onPlayChange }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Sync State: เมื่อ App บอกให้เล่น/หยุด -> สั่ง Audio Element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      if (audio.paused) {
        audio.play().catch(err => {
            // ดัก Error กรณีเปลี่ยนเพลงเร็วเกินไป เพื่อไม่ให้จอแดง
            console.warn("Audio play interrupted:", err); 
        });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, audioPath]);

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-2 flex items-center">
      <audio
        ref={audioRef}
        src={audioPath}
        controls
        controlsList="nodownload" // ซ่อนปุ่มโหลดถ้าต้องการ
        className="w-full h-10 accent-indigo-500" // ใช้ CSS ตกแต่งได้
        onPlay={() => !isPlaying && onPlayChange(true)}
        onPause={() => isPlaying && onPlayChange(false)}
        onEnded={() => onPlayChange(false)}
      />
    </div>
  );
}, (prev, next) => {
  // Logic ป้องกันการ Render ซ้ำ
  return prev.audioPath === next.audioPath && prev.isPlaying === next.isPlaying;
});