"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  ArrowLeft,
  Settings,
  Subtitles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlaybackMode } from "@/lib/playback-strategy";

interface SubtitleTrack {
  id: string;
  language: string;
  languageName: string | null;
}

interface PlayerControlsProps {
  visible: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  buffered: number;
  title: string;
  subtitle?: string;
  qualities: { height: number; index: number }[];
  currentQuality: number;
  subtitles: SubtitleTrack[];
  activeSubtitle: string | null;
  playbackMode?: PlaybackMode | null;
  onPlayPause: (e: React.MouseEvent) => void;
  onSeek: (time: number) => void;
  onVolumeChange: (v: number) => void;
  onToggleMute: (e: React.MouseEvent) => void;
  onToggleFullscreen: (e: React.MouseEvent) => void;
  onQualityChange: (index: number) => void;
  onSubtitleChange: (id: string | null) => void;
  onBack?: () => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerControls({
  visible,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isFullscreen,
  buffered,
  title,
  subtitle,
  qualities,
  currentQuality,
  subtitles,
  activeSubtitle,
  playbackMode,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onQualityChange,
  onSubtitleChange,
  onBack,
}: PlayerControlsProps) {
  const [showQuality, setShowQuality] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    onSeek(x * duration);
  }

  function handleVolumeClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    onVolumeChange(Math.max(0, Math.min(1, x)));
  }

  return (
    <div
      className={cn(
        "absolute inset-0 transition-opacity duration-300 flex flex-col justify-between",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top gradient + title */}
      <div className="bg-gradient-to-b from-black/70 to-transparent p-4 pt-6">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={(e) => { e.stopPropagation(); onBack(); }}
              className="hover:text-primary transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h2 className="text-lg font-medium">{title}</h2>
            {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
          </div>
        </div>
      </div>

      {/* Center play button */}
      <div className="flex-1" onClick={onPlayPause} />

      {/* Bottom controls */}
      <div className="bg-gradient-to-t from-black/80 to-transparent p-4 space-y-2">
        {/* Progress bar */}
        <div
          className="group/progress w-full h-1.5 hover:h-3 bg-white/20 rounded-full cursor-pointer transition-all relative"
          onClick={handleProgressClick}
        >
          {/* Buffered */}
          <div
            className="absolute h-full bg-white/30 rounded-full"
            style={{ width: `${(buffered / duration) * 100}%` }}
          />
          {/* Progress */}
          <div
            className="absolute h-full bg-primary rounded-full"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center gap-3">
            <button onClick={onPlayPause} className="hover:text-primary transition-colors">
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="fill-white" />}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onSeek(currentTime - 10); }}
              className="hover:text-primary transition-colors"
            >
              <SkipBack size={20} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onSeek(currentTime + 10); }}
              className="hover:text-primary transition-colors"
            >
              <SkipForward size={20} />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group/vol">
              <button onClick={onToggleMute} className="hover:text-primary transition-colors">
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <div
                className="w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-200"
                onClick={handleVolumeClick}
              >
                <div className="w-20 h-1 bg-white/30 rounded-full cursor-pointer relative">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <span className="text-sm text-text-muted ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Subtitles */}
            {subtitles.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSubtitles(!showSubtitles);
                    setShowQuality(false);
                  }}
                  className={cn(
                    "hover:text-primary transition-colors",
                    activeSubtitle && "text-primary"
                  )}
                >
                  <Subtitles size={20} />
                </button>

                {showSubtitles && (
                  <div className="absolute bottom-full right-0 mb-2 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[160px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSubtitleChange(null);
                        setShowSubtitles(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-left text-sm hover:bg-surface-hover",
                        !activeSubtitle && "text-primary"
                      )}
                    >
                      Désactivés
                    </button>
                    {subtitles.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubtitleChange(sub.id);
                          setShowSubtitles(false);
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-left text-sm hover:bg-surface-hover",
                          activeSubtitle === sub.id && "text-primary"
                        )}
                      >
                        {sub.languageName || sub.language}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quality selector — only for transcode mode */}
            {playbackMode === "transcode" && qualities.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuality(!showQuality);
                    setShowSubtitles(false);
                  }}
                  className="hover:text-primary transition-colors"
                >
                  <Settings size={20} />
                </button>

                {showQuality && (
                  <div className="absolute bottom-full right-0 mb-2 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[120px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQualityChange(-1);
                        setShowQuality(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-left text-sm hover:bg-surface-hover",
                        currentQuality === -1 && "text-primary"
                      )}
                    >
                      Auto
                    </button>
                    {qualities.map((q) => (
                      <button
                        key={q.index}
                        onClick={(e) => {
                          e.stopPropagation();
                          onQualityChange(q.index);
                          setShowQuality(false);
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-left text-sm hover:bg-surface-hover",
                          currentQuality === q.index && "text-primary"
                        )}
                      >
                        {q.height}p
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen */}
            <button onClick={onToggleFullscreen} className="hover:text-primary transition-colors">
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
