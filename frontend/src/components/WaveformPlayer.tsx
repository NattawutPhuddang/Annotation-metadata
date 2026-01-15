import React, { useRef, useEffect, useState } from 'react';

interface Props {
  audioUrl: string;
  isPlaying: boolean;
  onPlayChange?: (isPlaying: boolean) => void;
  progressColor?: string; // รับค่าสีธีม
  height?: string;
}

export const WaveformPlayer: React.FC<Props> = ({
  audioUrl,
  isPlaying,
  onPlayChange,
  progressColor = '#818cf8', // Default Indigo
  height = 'h-1' // ความหนาของเส้น
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);

  // Setup Audio
  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      onPlayChange?.(false); // แจ้ง Parent ว่าจบแล้ว
      setProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl, onPlayChange]);

  // Handle Play/Pause from Props
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(e => console.error("Playback error:", e));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Click to Seek
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    
    if (Number.isFinite(audioRef.current.duration)) {
       audioRef.current.currentTime = pct * audioRef.current.duration;
       setProgress(pct * 100);
    }
  };

  return (
    <div 
      className="w-full py-2 cursor-pointer group" 
      onClick={handleSeek}
      title="Click to seek"
    >
       {/* Background Line */}
       <div className={`w-full ${height} bg-slate-200 rounded-full overflow-hidden relative`}>
          {/* Progress Line */}
          <div
            style={{ width: `${progress}%`, backgroundColor: progressColor }}
            className="h-full absolute left-0 top-0 transition-all duration-100 ease-linear rounded-full"
          />
       </div>
    </div>
  );
};