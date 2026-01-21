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
  
  // 🟢 1. สร้าง Ref เพื่อเก็บ onPlayChange ล่าสุด
  const onPlayChangeRef = useRef(onPlayChange);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 🟢 2. อัปเดต Ref ทุกครั้งที่ค่าเปลี่ยน
  useEffect(() => {
    onPlayChangeRef.current = onPlayChange;
  }, [onPlayChange]);

  const getCleanUrl = (url: string) => {
    if (!url) return '';
    const match = url.match(/(blob:.*)/);
    return match ? match[1] : url;
  };

  const cleanUrl = getCleanUrl(audioUrl);

  useEffect(() => {
    if (!cleanUrl) return;

    const audio = new Audio(cleanUrl);
    audioRef.current = audio;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    
    // 🟢 3. เรียกใช้ผ่าน Ref แทน
    const handleEnded = () => {
        onPlayChangeRef.current?.(false);
        setCurrentTime(0);
    };
    
    const handleError = (e: Event) => {
        console.error("Audio Load Error:", e);
        onPlayChangeRef.current?.(false);
    };

    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
    
    // 🟢 4. ลบ onPlayChange ออกจาก Dependency Array (ใช้แค่ cleanUrl พอ)
  }, [cleanUrl]); 

  // Sync Play/Pause
  useEffect(() => {
    if (!audioRef.current || !cleanUrl) return;
    
    if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Play prevented or failed:", error);
                // 🟢 เรียกผ่าน Ref
                onPlayChangeRef.current?.(false);
            });
        }
    } else {
        audioRef.current.pause();
    }
    // เพิ่ม audioRef.current ใน deps เพื่อความชัวร์ (แต่ปกติ cleanUrl เปลี่ยน audioRef ก็เปลี่ยนอยู่แล้ว)
  }, [isPlaying, cleanUrl]);

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