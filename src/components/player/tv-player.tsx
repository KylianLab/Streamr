"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from "lucide-react";

interface TvPlayerProps {
  streamUrl: string;
  channelName: string;
  channelLogo?: string;
  onBack?: () => void;
}

export function TvPlayer({
  streamUrl,
  channelName,
  channelLogo,
  onBack,
}: TvPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<NodeJS.Timeout>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);

  // Initialize video source
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let destroyed = false;

    async function init() {
      const v = videoRef.current;
      if (!v || destroyed) return;

      const isHls =
        streamUrl.includes(".m3u8") || streamUrl.includes("m3u8") || streamUrl.includes("/api/iptv/");

      if (isHls) {
        const Hls = (await import("hls.js")).default;
        if (destroyed) return;

        if (Hls.isSupported()) {
          const hls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            liveSyncDuration: 3,
            liveMaxLatencyDuration: 10,
            lowLatencyMode: false,
            fragLoadingMaxRetry: 6,
            fragLoadingRetryDelay: 1000,
          });

          hls.loadSource(streamUrl);
          hls.attachMedia(v);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (destroyed) return;
            v.play().catch(() => {});
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.error("[tv-player] Network error, retrying...");
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.error("[tv-player] Media error, recovering...");
                  hls.recoverMediaError();
                  break;
                default:
                  console.error("[tv-player] Fatal error:", data.details);
                  hls.destroy();
                  break;
              }
            }
          });

          hlsRef.current = hls;
        } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
          v.src = streamUrl;
          v.addEventListener(
            "loadedmetadata",
            () => {
              if (!destroyed) v.play().catch(() => {});
            },
            { once: true }
          );
        }
      } else {
        v.src = streamUrl;
        v.addEventListener(
          "loadedmetadata",
          () => {
            if (!destroyed) v.play().catch(() => {});
          },
          { once: true }
        );
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
    };
  }, [streamUrl]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onPlaying = () => setIsBuffering(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
    };
  }, []);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [resetHideTimer]);

  // Fullscreen change listener
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (video.paused) video.play().catch(() => {});
          else video.pause();
          resetHideTimer();
          break;
        case "m":
        case "M":
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          resetHideTimer();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          resetHideTimer();
          break;
        case "Escape":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            onBack?.();
          }
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBack, resetHideTimer]);

  function togglePlayPause() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  function changeVolume(v: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    setVolume(v);
    if (v === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  }

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black"
      onMouseMove={resetHideTimer}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        onClick={togglePlayPause}
      />

      {/* Buffering spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
        </div>
      )}

      {/* Channel name overlay (top-left) */}
      <div
        className={`absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 pointer-events-none ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBack?.();
            }}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          {channelLogo && (
            <img
              src={channelLogo}
              alt=""
              className="w-8 h-8 object-contain rounded"
            />
          )}
          <span className="text-white font-medium text-lg">{channelName}</span>
        </div>
      </div>

      {/* Controls overlay (bottom) */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" />
            ) : (
              <Play className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 group/vol">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                e.stopPropagation();
                changeVolume(parseFloat(e.target.value));
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-0 group-hover/vol:w-24 transition-all duration-200 accent-primary cursor-pointer"
            />
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="flex items-center gap-1.5 text-sm text-white">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              EN DIRECT
            </span>
          </div>

          {/* Fullscreen */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5 text-white" />
            ) : (
              <Maximize className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
