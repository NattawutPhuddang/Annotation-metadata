// src/components/AudioPlayer/WaveformPlayer.tsx
import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import './WaveformPlayer.css';

interface Props {
  audioUrl: string;
  isPlaying: boolean;
  onPlayChange?: (isPlaying: boolean) => void;
  progressColor?: string;
  height?: string; // รับค่า class เช่น h-1, h-1.5
}

export const WaveformPlayer: React.FC<Props> = ({
  audioUrl,
  isPlaying,
  onPlayChange,
  progressColor = '#818cf8',
  height = 'h-1.5'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 🔴 ใช้ useRef เก็บ onPlayChange เพื่อไม่ให้ useEffect ทำงานซ้ำเมื่อ Parent Re-render
  // นี่คือหัวใจสำคัญที่แก้บัค "พิมพ์แล้วเสียงเริ่มใหม่"
  const onPlayChangeRef = useRef(onPlayChange);
  useEffect(() => {
    onPlayChangeRef.current = onPlayChange;
  }, [onPlayChange]);

  // Helper ดึง URL จริง (เผื่อกรณี Blob)
  const getCleanUrl = (url: string) => {
    if (!url) return '';
    const match = url.match(/(blob:.*)/);
    return match ? match[1] : url;
  };
  const cleanUrl = getCleanUrl(audioUrl);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !cleanUrl) return;

    // สร้าง WaveSurfer
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#cbd5e1', // สีพื้นหลังเวฟ (slate-300)
      progressColor: progressColor,
      cursorColor: 'transparent', // ซ่อนเส้น Cursor ให้ดูคล้าย Slider เดิม
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 1,
      height: 24, // ความสูงของ Waveform (pixel)
      barGap: 2,
      url: cleanUrl,
      normalize: true, // ปรับเสียงให้กราฟดูเต็มสวย
      interact: true,  // ให้ลาก Seek ได้
      dragToSeek: true,
    });

    wavesurfer.current = ws;

    // Events
    ws.on('ready', (d) => {
      setDuration(d);
    });

    ws.on('audioprocess', (t) => {
      setCurrentTime(t);
    });

    ws.on('finish', () => {
      onPlayChangeRef.current?.(false);
    });
    
    ws.on('interaction', () => {
        // เมื่อ user ลากกราฟ ไม่ต้องทำอะไรพิเศษ wavesurfer จัดการเอง
    });

    // Cleanup
    return () => {
      ws.destroy();
    };
  }, [cleanUrl]); // ⚠️ Dependency มีแค่ URL (และสี) ไม่รวม onPlayChange แล้ว

  // Sync Play/Pause จาก Props (Parent Control)
  useEffect(() => {
    if (!wavesurfer.current) return;
    try {
        if (isPlaying) {
          wavesurfer.current.play();
        } else {
          wavesurfer.current.pause();
        }
    } catch (e) {
        console.error("WaveSurfer error", e);
    }
  }, [isPlaying]);
  
  // Format Time (MM:SS)
  const formatTime = (t: number) => {
    if (!t || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col">
      {/* 🕒 Time Display: มุมขวาบนเหมือนเดิม */}
      <div className="flex justify-end mb-1">
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 tabular-nums leading-none">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* 🎚️ Waveform Container */}
      {/* ใช้ height จาก props เพื่อคุมขนาด container ให้เท่าเดิม */}
      <div 
        className={`waveform-wrapper w-full ${height} flex items-center bg-slate-50/50 rounded-lg overflow-hidden`}
      >
        <div ref={containerRef} className="w-full" />
      </div>
    </div>
  );
};