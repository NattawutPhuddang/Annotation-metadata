import React, { useRef, useEffect, useState } from 'react';

interface Props {
  audioUrl: string;
  isPlaying: boolean;
  onPlayChange?: (isPlaying: boolean) => void;
  progressColor?: string;
  height?: string;
}

export const WaveformPlayer: React.FC<Props> = ({
  audioUrl,
  isPlaying,
  onPlayChange,
  progressColor = '#818cf8',
  height = 'h-4'
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- Logic การดึง URL ที่ถูกต้อง (แก้ปัญหา URL ชนกัน) ---
  const getCleanUrl = (url: string) => {
    if (!url) return '';
    // ถ้าเจอ blob: ซ้อนกัน หรือมี http นำหน้า ให้ดึงเฉพาะ blob: ตัวสุดท้าย
    const match = url.match(/(blob:.*)/);
    return match ? match[1] : url;
  };

  const cleanUrl = getCleanUrl(audioUrl);

  useEffect(() => {
    if (!cleanUrl) return; // ถ้าไม่มี URL ไม่ต้องทำอะไร

    const audio = new Audio(cleanUrl);
    audioRef.current = audio;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
        onPlayChange?.(false);
        setCurrentTime(0);
    };
    
    // Error Handling
    audio.addEventListener('error', (e) => {
        console.error("Audio Load Error:", e);
        onPlayChange?.(false); // หยุดสถานะเล่นถ้าไฟล์เสีย
    });

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', () => {});
    };
  }, [cleanUrl, onPlayChange]);

  // Sync Play/Pause
  useEffect(() => {
    if (!audioRef.current || !cleanUrl) return; // เช็ค cleanUrl ด้วย
    
    if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Play prevented or failed:", error);
                onPlayChange?.(false); // Reset ปุ่ม Play ถ้าเล่นไม่ได้
            });
        }
    } else {
        audioRef.current.pause();
    }
  }, [isPlaying, cleanUrl]);

  // ... (ส่วน Render Slider และ formatTime เหมือนเดิม) ...
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (t: number) => {
    if (!t || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`w-full flex items-center gap-3 px-2 select-none ${height === 'h-1.5' ? 'h-8' : height}`}>
      <span className="text-[10px] font-mono text-slate-400 w-8 text-right tabular-nums">
        {formatTime(currentTime)}
      </span>
      
      <div className="relative flex-1 flex items-center h-4">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="absolute w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-0"
          style={{
            backgroundImage: `linear-gradient(${progressColor}, ${progressColor})`,
            backgroundSize: `${(currentTime / (duration || 1)) * 100}% 100%`,
            backgroundRepeat: 'no-repeat'
          }}
        />
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%;
            background: ${progressColor}; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.15);
            transition: transform 0.1s;
          }
          input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); }
        `}</style>
      </div>

      <span className="text-[10px] font-mono text-slate-400 w-8 tabular-nums">
        {formatTime(duration)}
      </span>
    </div>
  );
};