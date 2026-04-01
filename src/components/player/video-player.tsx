"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PlayerControls } from "./player-controls";
import { useWatchProgress } from "@/hooks/use-watch-progress";
import type { PlaybackMode } from "@/lib/playback-strategy";

interface SubtitleTrack {
  id: string;
  language: string;
  languageName: string | null;
  isDefault: boolean;
}

interface VideoPlayerProps {
  mediaFileId: string;
  title: string;
  subtitle?: string;
  startTime?: number;
  subtitles?: SubtitleTrack[];
  onEnded?: () => void;
  onBack?: () => void;
}

interface PlaybackInfo {
  mode: PlaybackMode;
  url: string;
  mimeType: string;
  needsHlsJs: boolean;
  duration?: number;
  qualities?: { height: number; label: string }[];
}

export function VideoPlayer({
  mediaFileId,
  title,
  subtitle,
  startTime = 0,
  subtitles = [],
  onEnded,
  onBack,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [qualities, setQualities] = useState<{ height: number; index: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
  const [buffered, setBuffered] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode | null>(null);

  // For transmux seek: track the base time offset and base URL
  const transmuxBaseTime = useRef(0);
  const transmuxBaseUrl = useRef("");

  const { reportProgress } = useWatchProgress(mediaFileId);
  const hideControlsTimeout = useRef<NodeJS.Timeout>(null);
  const startTimeRef = useRef(startTime);
  startTimeRef.current = startTime;

  // Fetch playback info and initialize the appropriate player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let destroyed = false;

    async function init() {
      const v = videoRef.current;
      if (!v) return;

      // Fetch playback strategy from server
      let info: PlaybackInfo;
      try {
        const res = await fetch(`/api/stream/${mediaFileId}/playback-info`);
        info = await res.json();
      } catch {
        // Fallback to transcode if playback-info fails
        info = {
          mode: "transcode",
          url: `/api/stream/${mediaFileId}/master.m3u8`,
          mimeType: "application/vnd.apple.mpegurl",
          needsHlsJs: true,
        };
      }

      if (destroyed) return;
      setPlaybackMode(info.mode);

      if (info.mode === "direct") {
        // Direct play — native <video> with range requests
        v.src = info.url;
        v.addEventListener("loadedmetadata", () => {
          if (destroyed) return;
          setIsReady(true);
          setDuration(v.duration);
          if (startTimeRef.current > 0) {
            v.currentTime = startTimeRef.current;
          }
          v.play().catch(() => {});
        }, { once: true });

      } else if (info.mode === "transmux") {
        // Transmux — streamed fMP4
        const seekTo = startTimeRef.current || 0;
        transmuxBaseTime.current = seekTo;
        transmuxBaseUrl.current = info.url;
        const sep = info.url.includes("?") ? "&" : "?";
        v.src = seekTo > 0 ? `${info.url}${sep}t=${Math.floor(seekTo)}` : info.url;
        v.addEventListener("loadedmetadata", () => {
          if (destroyed) return;
          setIsReady(true);
          // Duration from server since fMP4 stream may not report it
          if (info.duration) setDuration(info.duration);
          else if (v.duration && isFinite(v.duration)) setDuration(v.duration);
          v.play().catch(() => {});
        }, { once: true });

      } else {
        // Transcode — HLS.js
        const Hls = (await import("hls.js")).default;
        if (destroyed) return;

        if (Hls.isSupported()) {
          const hls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferHole: 0.5,
            startLevel: 0, // Start at lowest quality for fast first frame
            capLevelToPlayerSize: true,
            startFragPrefetch: true,
            lowLatencyMode: false,
            fragLoadingMaxRetry: 6,
            fragLoadingRetryDelay: 1000,
            fragLoadingMaxRetryTimeout: 8000,
            nudgeMaxRetry: 10,
            nudgeOffset: 0.2,
          });

          hls.loadSource(info.url);
          hls.attachMedia(v);

          hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
            if (destroyed) return;
            const levels = data.levels.map((level, index) => ({
              height: level.height,
              index,
            }));
            setQualities(levels);
            setIsReady(true);

            if (startTimeRef.current > 0) {
              v.currentTime = startTimeRef.current;
            }
            v.play().catch(() => {});
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
            setCurrentQuality(data.level);
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              console.error("[hls.js] Fatal error:", data.type, data.details);
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  break;
              }
            } else {
              console.warn("[hls.js]", data.details, `segment=${data.frag?.sn ?? "?"}`);
            }
          });

          hlsRef.current = hls;
        } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS (Safari)
          v.src = info.url;
          v.addEventListener("loadedmetadata", () => {
            if (destroyed) return;
            setIsReady(true);
            if (startTimeRef.current > 0) {
              v.currentTime = startTimeRef.current;
            }
            v.play().catch(() => {});
          }, { once: true });
        }
      }
    }

    init();

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
      setIsReady(false);
      setPlaybackMode(null);
      setQualities([]);
    };
  }, [mediaFileId]);

  // Add subtitle tracks
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }

    subtitles.forEach((sub) => {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = sub.languageName || sub.language;
      track.srclang = sub.language;
      track.src = `/api/subtitles/${sub.id}`;
      if (sub.isDefault) track.default = true;
      video.appendChild(track);
    });
  }, [subtitles]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      // In transmux mode, video.currentTime is relative to the seek point
      const effectiveTime = playbackMode === "transmux"
        ? video.currentTime + transmuxBaseTime.current
        : video.currentTime;
      setCurrentTime(effectiveTime);
      reportProgress(effectiveTime, duration || video.duration);
    };
    const onDurationChange = () => {
      if (playbackMode === "transmux") {
        // Don't override server-provided duration with stream duration
        return;
      }
      setDuration(video.duration);
    };
    const onProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered(
          playbackMode === "transmux"
            ? bufferedEnd + transmuxBaseTime.current
            : bufferedEnd
        );
      }
    };
    const onEndedHandler = () => {
      const totalDuration = duration || video.duration;
      reportProgress(totalDuration, totalDuration);
      onEnded?.();
    };
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onSeeking = () => setIsBuffering(true);
    const onSeeked = () => setIsBuffering(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("progress", onProgress);
    video.addEventListener("ended", onEndedHandler);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("ended", onEndedHandler);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [reportProgress, onEnded, playbackMode, duration]);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    };
  }, [isPlaying, resetHideTimer]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (video.paused) { video.play(); } else { video.pause(); }
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(currentTime - 10);
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(currentTime + 10);
          break;
        case "ArrowUp":
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          break;
        case "ArrowDown":
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          break;
        case "Escape":
          if (isFullscreen) {
            document.exitFullscreen();
          } else {
            onBack?.();
          }
          break;
      }
      resetHideTimer();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, onBack, resetHideTimer, currentTime, playbackMode]);

  function togglePlayPause() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); } else { video.pause(); }
  }

  function seek(time: number) {
    const video = videoRef.current;
    if (!video) return;

    const clampedTime = Math.max(0, Math.min(duration, time));

    if (playbackMode === "transmux") {
      // Restart transmux stream from new position
      setIsBuffering(true);
      transmuxBaseTime.current = clampedTime;
      const base = transmuxBaseUrl.current || `/api/stream/${mediaFileId}/transmux`;
      const sep = base.includes("?") ? "&" : "?";
      video.src = `${base}${sep}t=${Math.floor(clampedTime)}`;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => {});
      }, { once: true });
    } else {
      video.currentTime = playbackMode === "direct" ? clampedTime : clampedTime;
    }
  }

  function changeVolume(v: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    }
  }

  function changeQuality(index: number) {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = index;
    setCurrentQuality(index);
  }

  function changeSubtitle(subtitleId: string | null) {
    const video = videoRef.current;
    if (!video) return;

    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = "hidden";
    }

    if (subtitleId) {
      const subIndex = subtitles.findIndex((s) => s.id === subtitleId);
      if (subIndex >= 0 && video.textTracks[subIndex]) {
        video.textTracks[subIndex].mode = "showing";
      }
    }

    setActiveSubtitle(subtitleId);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black cursor-none group"
      onMouseMove={resetHideTimer}
      onClick={togglePlayPause}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
      />

      {/* Loading / buffering spinner */}
      {(!isReady || isBuffering) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
        </div>
      )}

      {/* Controls overlay */}
      <PlayerControls
        visible={showControls}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        isFullscreen={isFullscreen}
        buffered={buffered}
        title={title}
        subtitle={subtitle}
        qualities={qualities}
        currentQuality={currentQuality}
        subtitles={subtitles}
        activeSubtitle={activeSubtitle}
        playbackMode={playbackMode}
        onPlayPause={(e) => { e.stopPropagation(); togglePlayPause(); }}
        onSeek={seek}
        onVolumeChange={changeVolume}
        onToggleMute={(e) => { e.stopPropagation(); toggleMute(); }}
        onToggleFullscreen={(e) => { e.stopPropagation(); toggleFullscreen(); }}
        onQualityChange={changeQuality}
        onSubtitleChange={changeSubtitle}
        onBack={onBack}
      />
    </div>
  );
}
