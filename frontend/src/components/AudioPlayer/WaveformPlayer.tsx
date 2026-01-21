import React, { useRef, useEffect, useState } from 'react';
import './WaveformPlayer.css';

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
  height = 'h-1.5'
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
    const handleEnded = () => {
      onPlayChange?.(false);
      setCurrentTime(0);
    };
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', () => onPlayChange?.(false));

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [cleanUrl, onPlayChange]);

  useEffect(() => {
    if (!audioRef.current || !cleanUrl) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => onPlayChange?.(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, cleanUrl, onPlayChange]);

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
    <div className="w-full flex flex-col">
      {/* 🕒 Time Display: Top Right */}
      <div className="flex justify-end mb-1">
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 tabular-nums leading-none">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* 🎚️ Slider Tube */}
      <div className={`waveform-container ${height === 'h-1.5' ? 'h-auto' : ''}`} style={{ padding: 0 }}>
        <div className="slider-container" style={{ color: progressColor }}>
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="waveform-slider"
            style={{
              backgroundImage: `linear-gradient(${progressColor}, ${progressColor})`,
              backgroundSize: `${(currentTime / (duration || 1)) * 100}% 100%`,
              backgroundRepeat: 'no-repeat'
            }}
          />
        </div>
      </div>
    </div>
  );
};