import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { VideoThumbnail } from "@/components/VideoPlayer";
// Video utilities removed - only .mp4 uploads supported
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import SignatureCanvas, { SignatureCanvasRef } from "@/components/SignatureCanvas";
import {
  Video, Play, Pause, CheckCircle, Clock, LogOut, ChevronRight, BookOpen, ChevronDown, ChevronUp, Volume2, VolumeX, Maximize, Minimize
} from "lucide-react";
import logoImg from "@/assets/logo-episafety.png";

interface CursoVideo {
  id: string;
  titulo: string;
  descricao: string | null;
}

interface VideoTreinamento {
  id: string;
  titulo: string;
  descricao: string | null;
  video_url: string;
  duracao_segundos: number;
  created_at: string;
  curso_id: string | null;
  ordem: number;
}

interface VideoVisualizacao {
  id: string;
  video_id: string;
  funcionario_id: string;
  percentual_assistido: number;
  concluido: boolean;
  assinatura: string | null;
}

export default function PortalTreinamentos() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [cursos, setCursos] = useState<CursoVideo[]>([]);
  const [videos, setVideos] = useState<VideoTreinamento[]>([]);
  const [visualizacoes, setVisualizacoes] = useState<VideoVisualizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [expandedCursos, setExpandedCursos] = useState<Set<string>>(new Set());

  const [watchingVideo, setWatchingVideo] = useState<VideoTreinamento | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const maxWatchedTimeRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [isLandscapeViewport, setIsLandscapeViewport] = useState(false);
  const [isSmallViewport, setIsSmallViewport] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);

  const [showSignature, setShowSignature] = useState(false);
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const [saving, setSaving] = useState(false);

  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [funcEmpresaId, setFuncEmpresaId] = useState<string | null>(null);
  const [assignedCursoIds, setAssignedCursoIds] = useState<string[]>([]);

  const isAppleMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }, []);

  const shouldUseImmersiveMode = !!watchingVideo && (isFullscreen || isImmersiveMode || (isSmallViewport && isLandscapeViewport));

  const normalize = (value?: string | null) =>
    (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Step 1: Fetch profile + static data in parallel
      const [{ data: profile }, { data: cursosData }, { data: vids }] = await Promise.all([
        supabase.from("profiles").select("nome, empresa_id").eq("user_id", user?.id || "").maybeSingle(),
        supabase.from("cursos_video").select("id, titulo, descricao").order("created_at", { ascending: false }),
        supabase.from("videos_treinamento").select("id, titulo, descricao, video_url, duracao_segundos, created_at, curso_id, ordem").order("ordem", { ascending: true }),
      ]);

      if (profile) setUserName(profile.nome || user?.email || "");
      if (cursosData) setCursos(cursosData as any);

      const normalizedProfileName = normalize(profile?.nome);
      let foundFuncId: string | null = null;
      let empId = profile?.empresa_id || null;

      if (empId && normalizedProfileName) {
        setFuncEmpresaId(empId);
        const { data: funcs } = await supabase.from("funcionarios").select("id, nome, empresa_id")
          .eq("empresa_id", empId).is("data_demissao", null);
        const matched = funcs?.find(f => normalize(f.nome) === normalizedProfileName);
        if (matched) {
          foundFuncId = matched.id;
          setFuncEmpresaId(matched.empresa_id);
        }
      }
      if (!foundFuncId && normalizedProfileName) {
        const { data: allFuncs } = await supabase.from("funcionarios").select("id, nome").is("data_demissao", null);
        const matched = allFuncs?.find(f => normalize(f.nome) === normalizedProfileName);
        if (matched) foundFuncId = matched.id;
      }
      setFuncionarioId(foundFuncId);

      // Step 2: Fetch assignments + visualizations in parallel
      let cursoIds: string[] = [];
      let legacyVideoIds: string[] = [];

      if (foundFuncId) {
        const [{ data: cursoAssign }, { data: vizs }] = await Promise.all([
          supabase.from("cursos_atribuicao").select("curso_id").eq("funcionario_id", foundFuncId),
          supabase.from("videos_visualizacao").select("id, video_id, funcionario_id, percentual_assistido, concluido, assinatura").eq("funcionario_id", foundFuncId),
        ]);
        cursoIds = (cursoAssign || []).map((a: any) => a.curso_id);
        if (vizs) setVisualizacoes(vizs as any);

        // Fallback: legacy assignments
        if (cursoIds.length === 0) {
          const { data: videoAssign } = await supabase.from("videos_atribuicao")
            .select("video_id").eq("funcionario_id", foundFuncId);
          legacyVideoIds = (videoAssign || []).map((a: any) => a.video_id);
        }
      } else {
        setVisualizacoes([]);
      }
      setAssignedCursoIds(cursoIds);

      if (vids) {
        let filteredVids = vids as any as VideoTreinamento[];
        if (cursoIds.length === 0 && legacyVideoIds.length > 0) {
          filteredVids = filteredVids.filter(v => legacyVideoIds.includes(v.id));
        }
        setVideos(filteredVids);
      }

      if (cursoIds.length > 0) setExpandedCursos(new Set(cursoIds));
    } catch {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getVideoStatus = (videoId: string) => {
    const viz = visualizacoes.find(v => v.video_id === videoId && v.funcionario_id === funcionarioId);
    if (!viz) return "pendente";
    if (viz.concluido && viz.assinatura) return "concluido";
    if (viz.concluido) return "assinatura_pendente";
    return "em_andamento";
  };

  // Get courses assigned to this employee
  const myCursos = useMemo(() => {
    if (assignedCursoIds.length > 0) {
      return cursos.filter(c => assignedCursoIds.includes(c.id));
    }
    return [];
  }, [cursos, assignedCursoIds]);

  const getModulos = (cursoId: string) => videos.filter(v => v.curso_id === cursoId).sort((a, b) => a.ordem - b.ordem);

  // Legacy: videos without curso assignment
  const legacyVideos = useMemo(() => {
    if (assignedCursoIds.length > 0) return [];
    return videos.filter(v => !v.curso_id);
  }, [videos, assignedCursoIds]);

  const allModuleIds = useMemo(() => {
    if (myCursos.length > 0) {
      return myCursos.flatMap(c => getModulos(c.id).map(m => m.id));
    }
    return legacyVideos.map(v => v.id);
  }, [myCursos, videos, legacyVideos]);

  const completedCount = useMemo(() => {
    return allModuleIds.filter(id => getVideoStatus(id) === "concluido").length;
  }, [allModuleIds, visualizacoes, funcionarioId]);

  const totalModules = allModuleIds.length;

  const toggleExpand = (cursoId: string) => {
    setExpandedCursos(prev => {
      const next = new Set(prev);
      if (next.has(cursoId)) next.delete(cursoId);
      else next.add(cursoId);
      return next;
    });
  };

  const getPlaybackMetrics = useCallback(() => {
    return {
      current: videoRef.current?.currentTime ?? 0,
      total: videoRef.current?.duration ?? 0,
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewportState = () => {
      setIsLandscapeViewport(window.innerWidth > window.innerHeight);
      setIsSmallViewport(Math.min(window.innerWidth, window.innerHeight) < 768);
    };

    updateViewportState();
    window.addEventListener("resize", updateViewportState);
    window.addEventListener("orientationchange", updateViewportState);

    return () => {
      window.removeEventListener("resize", updateViewportState);
      window.removeEventListener("orientationchange", updateViewportState);
    };
  }, []);

  useEffect(() => {
    if (!watchingVideo || isFullscreen) return;

    if (isSmallViewport && isLandscapeViewport) {
      setIsImmersiveMode(true);
      return;
    }

    setIsImmersiveMode(false);
  }, [watchingVideo, isFullscreen, isLandscapeViewport, isSmallViewport]);

  useEffect(() => {
    if (!shouldUseImmersiveMode || typeof document === "undefined") return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [shouldUseImmersiveMode]);

  // IMPORTANT: Do NOT call video.load() here — it breaks the user-gesture chain on iOS Safari
  // and causes play() to be rejected. The video element must already have its src set via JSX.
  const playCurrentVideo = useCallback((startMuted: boolean): Promise<boolean> => {
    const video = videoRef.current;
    if (!video) return Promise.resolve(false);

    video.muted = startMuted;
    if (startMuted) {
      video.setAttribute("muted", "true");
    } else {
      video.removeAttribute("muted");
    }

    // play() must be called synchronously within the user-gesture call stack
    const playPromise = video.play();

    return playPromise.then(() => {
      setIsMuted(video.muted);
      setIsPlaying(true);
      setShowPlayOverlay(false);
      return true;
    }).catch(() => {
      return false;
    });
  }, []);

  const enterBestFullscreen = useCallback(async () => {
    const video = videoRef.current as (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    }) | null;
    const container = videoContainerRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;

    if (!video || !container) return false;

    if (isAppleMobile && typeof video.webkitEnterFullscreen === "function") {
      try {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
        return true;
      } catch {}
    }

    if (container.requestFullscreen) {
      try {
        await container.requestFullscreen();
        setIsFullscreen(true);
        return true;
      } catch {}
    }

    if (typeof container.webkitRequestFullscreen === "function") {
      try {
        await container.webkitRequestFullscreen();
        setIsFullscreen(true);
        return true;
      } catch {}
    }

    setIsImmersiveMode(true);
    return true;
  }, [isAppleMobile]);

  const exitBestFullscreen = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const video = videoRef.current as (HTMLVideoElement & {
      webkitDisplayingFullscreen?: boolean;
      webkitExitFullscreen?: () => void;
    }) | null;

    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === "function") {
        await doc.webkitExitFullscreen();
      } else if (video?.webkitDisplayingFullscreen && typeof video.webkitExitFullscreen === "function") {
        video.webkitExitFullscreen();
      }
    } catch {}

    setIsFullscreen(false);
    setIsImmersiveMode(false);
  }, []);

  // Save progress when leaving a video
  const saveProgress = useCallback(async (videoId: string) => {
    if (!funcionarioId) return;

    const { total } = getPlaybackMetrics();
    const percentual = total > 0 ? Math.round((maxWatchedTimeRef.current / total) * 100) : 0;
    if (percentual <= 0) return;

    try {
      await supabase.from("videos_visualizacao").upsert({
        video_id: videoId,
        funcionario_id: funcionarioId,
        percentual_assistido: Math.min(percentual, 100),
        concluido: false,
        empresa_id: funcEmpresaId,
      }, { onConflict: "video_id,funcionario_id" });
    } catch {}
  }, [funcionarioId, funcEmpresaId, getPlaybackMetrics]);

  const handleStartVideo = (video: VideoTreinamento) => {
    if (watchingVideo && !videoEnded) {
      saveProgress(watchingVideo.id);
    }

    setWatchingVideo(video);
    setVideoEnded(false);
    setShowSignature(false);
    setIsPlaying(false);
    setIsMuted(false);
    setIsFullscreen(false);
    setIsImmersiveMode(false);
    setShowPlayOverlay(true);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackRate(1);

    const viz = visualizacoes.find(v => v.video_id === video.id && v.funcionario_id === funcionarioId);
    if (viz && !viz.concluido && viz.percentual_assistido > 0 && viz.percentual_assistido < 100) {
      maxWatchedTimeRef.current = -1;
    } else {
      maxWatchedTimeRef.current = 0;
    }
  };

  const handleGoBack = () => {
    if (watchingVideo && !videoEnded) {
      saveProgress(watchingVideo.id);
    }
    void exitBestFullscreen();
    setWatchingVideo(null);
    fetchData();
  };

  const handleVideoEnded = async () => {
    setVideoEnded(true);
    await exitBestFullscreen();
    if (!watchingVideo || !funcionarioId) return;
    setShowSignature(true);
  };

  const handleSign = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({ title: "Assine antes de concluir", variant: "destructive" });
      return;
    }
    if (!watchingVideo || !funcionarioId) return;
    setSaving(true);
    try {
      const assinatura = signatureRef.current.getDataURL();
      const { error } = await supabase.from("videos_visualizacao").upsert({
        video_id: watchingVideo.id,
        funcionario_id: funcionarioId,
        percentual_assistido: 100,
        concluido: true,
        assinatura,
        empresa_id: funcEmpresaId,
      }, { onConflict: "video_id,funcionario_id" });
      if (error) throw error;
      toast({ title: "Módulo concluído!", description: "Sua participação foi registrada com sucesso." });
      setWatchingVideo(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      // Call play() synchronously on user gesture
      video.muted = isMuted;
      video.play().then(() => {
        setIsPlaying(true);
        setShowPlayOverlay(false);
      }).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      setShowPlayOverlay(true);
    }
  };

  // This handler MUST call video.play() synchronously in the tap event stack.
  // Any async work (load, await, setTimeout) before play() will cause Safari to reject it.
  const handleTapToPlay = () => {
    const video = videoRef.current;
    if (!video) return;

    // Start muted for Safari autoplay policy compliance
    video.muted = true;
    setIsMuted(true);

    const playPromise = video.play();

    playPromise.then(() => {
      setIsPlaying(true);
      setShowPlayOverlay(false);

      // After playback starts, try to unmute on non-Apple devices
      if (!isAppleMobile) {
        try {
          video.muted = false;
          setIsMuted(false);
        } catch {}
      }
    }).catch((err) => {
      console.warn("Play rejected:", err);
      // Last resort: show native controls so user can tap the native play button
      video.controls = true;
      setShowPlayOverlay(false);
      toast({ title: "Toque no botão ▶ do player para iniciar", description: "Use o controle nativo do vídeo abaixo." });
    });
  };

  const handleToggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2];
  const handleCycleSpeed = () => {
    const currentIdx = SPEED_OPTIONS.indexOf(playbackRate);
    const nextIdx = (currentIdx + 1) % SPEED_OPTIONS.length;
    const newRate = SPEED_OPTIONS[nextIdx];
    setPlaybackRate(newRate);

    const video = videoRef.current;
    if (video) video.playbackRate = newRate;
  };

  const handleToggleFullscreen = async () => {
    if (shouldUseImmersiveMode) {
      await exitBestFullscreen();
      return;
    }

    await enterBestFullscreen();
  };

  useEffect(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
    };

    const handleDocumentFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!doc.webkitFullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleDocumentFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleDocumentFullscreenChange);

    const video = videoRef.current;
    const handleIOSFullscreenStart = () => setIsFullscreen(true);
    const handleIOSFullscreenEnd = () => setIsFullscreen(false);

    video?.addEventListener("webkitbeginfullscreen", handleIOSFullscreenStart as EventListener);
    video?.addEventListener("webkitendfullscreen", handleIOSFullscreenEnd as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", handleDocumentFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleDocumentFullscreenChange);
      video?.removeEventListener("webkitbeginfullscreen", handleIOSFullscreenStart as EventListener);
      video?.removeEventListener("webkitendfullscreen", handleIOSFullscreenEnd as EventListener);
    };
  }, [watchingVideo]);

  const formatTime = (timeInSeconds: number) => {
    const safe = Number.isFinite(timeInSeconds) ? Math.max(0, Math.floor(timeInSeconds)) : 0;
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Watching a video
  if (watchingVideo) {
    return (
      <div className={`min-h-screen bg-background ${shouldUseImmersiveMode ? "overflow-hidden" : ""}`}>
        <div className={`mx-auto ${shouldUseImmersiveMode ? "max-w-none p-0" : "max-w-4xl p-4 space-y-4"}`}>
          {!shouldUseImmersiveMode && (
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={handleGoBack} className="text-sm">← Voltar</Button>
              <Badge variant="outline">{watchingVideo.titulo}</Badge>
            </div>
          )}

          <Card className={shouldUseImmersiveMode ? "rounded-none border-0 shadow-none" : undefined}>
            <CardContent className={`p-0 ${shouldUseImmersiveMode ? "overflow-visible rounded-none" : "overflow-hidden rounded-lg"}`}>
              <div ref={videoContainerRef} className={`bg-card ${shouldUseImmersiveMode ? "fixed inset-0 z-50 flex flex-col bg-background" : ""}`}>
                <div className="relative flex-1 bg-muted">
                  <video
                    ref={videoRef}
                    key={watchingVideo.id}
                    src={watchingVideo.video_url}
                    playsInline
                    // @ts-ignore - webkit attribute for iOS
                    webkit-playsinline="true"
                    preload="auto"
                    tabIndex={-1}
                    className={`w-full bg-muted ${shouldUseImmersiveMode ? "h-full object-contain" : "aspect-video"}`}
                    onEnded={() => { void handleVideoEnded(); }}
                    onPlay={() => {
                      setIsPlaying(true);
                      setShowPlayOverlay(false);
                    }}
                    onPause={() => {
                      setIsPlaying(false);
                      if (!videoEnded) setShowPlayOverlay(true);
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    onLoadedMetadata={(e) => {
                      const vid = e.currentTarget;
                      const dur = vid.duration || 0;
                      setDuration(dur);
                      if (maxWatchedTimeRef.current === -1 && watchingVideo) {
                        const viz = visualizacoes.find(v => v.video_id === watchingVideo.id && v.funcionario_id === funcionarioId);
                        if (viz && viz.percentual_assistido > 0 && viz.percentual_assistido < 100 && dur > 0) {
                          const resumeTime = (viz.percentual_assistido / 100) * dur;
                          vid.currentTime = resumeTime;
                          maxWatchedTimeRef.current = resumeTime;
                          setCurrentTime(resumeTime);
                          return;
                        }
                      }
                      maxWatchedTimeRef.current = 0;
                      setCurrentTime(0);
                    }}
                    onTimeUpdate={(e) => {
                      const vid = e.currentTarget;
                      const nextTime = vid.currentTime;
                      if (nextTime > maxWatchedTimeRef.current) {
                        maxWatchedTimeRef.current = nextTime;
                      }
                      setCurrentTime(nextTime);
                      setDuration(vid.duration || 0);
                    }}
                    onSeeking={(e) => {
                      const vid = e.currentTarget;
                      const allowedTime = maxWatchedTimeRef.current + 2;
                      if (vid.currentTime > allowedTime) {
                        vid.currentTime = maxWatchedTimeRef.current;
                      }
                    }}
                    onStalled={() => {
                      // iOS Safari may stall; nudge playback
                      const vid = videoRef.current;
                      if (vid && !vid.paused && vid.readyState < 3) {
                        const t = vid.currentTime;
                        vid.currentTime = t + 0.01;
                      }
                    }}
                    onWaiting={() => {
                      // Show that the video is buffering
                      console.log("Video buffering at", videoRef.current?.currentTime);
                    }}
                    onError={(e) => {
                      const vid = e.currentTarget;
                      const err = (vid as any).error;
                      console.error("Video error:", err?.code, err?.message);
                      // If it's a network error, try to resume
                      if (err?.code === 2 && vid.currentTime > 0) {
                        const savedTime = vid.currentTime;
                        setTimeout(() => {
                          vid.load();
                          vid.currentTime = savedTime;
                          vid.play().catch(() => {});
                        }, 1000);
                      } else {
                        setShowPlayOverlay(true);
                      }
                    }}
                    controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
                    disablePictureInPicture
                  />
                  {showPlayOverlay && (
                    <button
                      type="button"
                      onClick={handleTapToPlay}
                      className="absolute inset-0 z-10 flex items-center justify-center bg-foreground/30 cursor-pointer"
                      aria-label="Iniciar vídeo"
                    >
                      <div className="bg-primary rounded-full p-4 shadow-lg">
                        <Play className="h-8 w-8 text-primary-foreground" fill="currentColor" />
                      </div>
                    </button>
                  )}
                </div>
                <div className={`flex items-center gap-3 border-t border-border bg-card px-4 py-3 ${shouldUseImmersiveMode ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : ""}`}>
                  <Button type="button" variant="outline" size="sm" onClick={handleTogglePlay}>
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleToggleMute}>
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  <div className="flex-1 space-y-2">
                    <div
                      className="relative h-3 overflow-hidden rounded-full bg-muted cursor-pointer group"
                      onClick={(e) => {
                        if (!videoRef.current || duration <= 0) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickPercent = clickX / rect.width;
                        const clickTime = clickPercent * duration;
                        if (clickTime <= maxWatchedTimeRef.current + 0.25) {
                          videoRef.current.currentTime = clickTime;
                          setCurrentTime(clickTime);
                        }
                      }}
                    >
                      <div
                        className="absolute top-0 left-0 h-full rounded-full bg-muted-foreground/20"
                        style={{ width: `${duration > 0 ? (maxWatchedTimeRef.current / duration) * 100 : 0}%` }}
                      />
                      <div
                        className="absolute top-0 left-0 h-full rounded-full bg-primary transition-[width] duration-200"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleCycleSpeed} className="text-xs font-semibold min-w-[3rem]">
                    {playbackRate}x
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleToggleFullscreen}>
                    {shouldUseImmersiveMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {watchingVideo.descricao && <p className="text-sm text-muted-foreground">{watchingVideo.descricao}</p>}

          {videoEnded && !showSignature && (
            <Card className="border-primary">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-10 w-10 mx-auto text-primary mb-2" />
                <p className="font-semibold text-foreground">Vídeo concluído!</p>
                <p className="text-sm text-muted-foreground">Preparando assinatura...</p>
              </CardContent>
            </Card>
          )}

          {showSignature && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 mx-auto text-primary mb-2" />
                  <h2 className="text-lg font-bold text-foreground">Confirme sua participação</h2>
                  <p className="text-sm text-muted-foreground">Assine abaixo para finalizar</p>
                </div>
                <SignatureCanvas ref={signatureRef} label="Assinatura do Funcionário" height={200} />
                <Button onClick={handleSign} disabled={saving} className="w-full bg-primary" size="lg">
                  {saving ? "Salvando..." : "Concluir Módulo"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const hasContent = myCursos.length > 0 || legacyVideos.length > 0;

  // Main portal view
  return (
    <div className="min-h-screen bg-background">
      {/* Header sticky mobile-friendly */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={logoImg} alt="EPISafety" className="h-7 sm:h-8" />
            <div>
              <h1 className="font-bold text-foreground text-xs sm:text-sm">Portal de Treinamentos</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[140px] sm:max-w-none">{userName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground px-2 sm:px-3">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Sair</span>
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-3 py-4 sm:p-4 space-y-4 sm:space-y-6">
        {/* Progress card */}
        <Card className="border-primary/20">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs sm:text-sm font-medium text-foreground">Seu progresso</span>
              <span className="text-sm font-bold text-primary">{completedCount}/{totalModules}</span>
            </div>
            <Progress value={totalModules > 0 ? (completedCount / totalModules) * 100 : 0} className="h-2.5 sm:h-3" />
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5">
              {completedCount === totalModules && totalModules > 0
                ? "🎉 Parabéns! Todos os treinamentos concluídos!"
                : `${totalModules - completedCount} módulo(s) pendente(s)`}
            </p>
          </CardContent>
        </Card>

        {/* Content */}
        {!hasContent ? (
          <Card>
            <CardContent className="p-6 sm:p-8 text-center text-muted-foreground">
              <Video className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-sm">Nenhum treinamento atribuído</p>
              <p className="text-xs">Seu acesso mostra apenas os cursos selecionados pelo administrador</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {/* Cursos with modules */}
            {myCursos.map(curso => {
              const modulos = getModulos(curso.id);
              const isExpanded = expandedCursos.has(curso.id);
              const cursoCompleted = modulos.filter(m => getVideoStatus(m.id) === "concluido").length;
              const cursoTotal = modulos.length;

              return (
                <Card key={curso.id} className="overflow-hidden">
                  {/* Curso header */}
                  <div className="p-3 sm:p-4 cursor-pointer hover:bg-muted/50 active:bg-muted/70 transition-colors" onClick={() => toggleExpand(curso.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="bg-primary/10 p-1.5 sm:p-2 rounded-lg flex-shrink-0">
                          <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-sm leading-tight truncate">{curso.titulo}</h3>
                          {curso.descricao && <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">{curso.descricao}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={cursoCompleted === cursoTotal && cursoTotal > 0 ? "default" : "outline"} className={`text-[10px] sm:text-xs px-1.5 sm:px-2 ${cursoCompleted === cursoTotal && cursoTotal > 0 ? "bg-emerald-100 text-emerald-700" : ""}`}>
                          {cursoCompleted}/{cursoTotal}
                        </Badge>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {cursoTotal > 0 && (
                      <Progress value={(cursoCompleted / cursoTotal) * 100} className="h-1 sm:h-1.5 mt-2.5" />
                    )}
                  </div>

                  {/* Module list */}
                  {isExpanded && (
                    <div className="border-t divide-y">
                      {modulos.length === 0 ? (
                        <div className="p-3 text-center text-muted-foreground text-xs">Nenhum módulo disponível</div>
                      ) : modulos.map((modulo, idx) => {
                        const status = getVideoStatus(modulo.id);
                        return (
                          <div key={modulo.id} className={`p-2.5 sm:p-4 ${status === "concluido" ? "opacity-75 bg-muted/30" : ""}`}>
                            <div className="flex items-center gap-2 sm:gap-4">
                              <span className="bg-primary/10 text-primary font-bold text-[10px] sm:text-xs rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center flex-shrink-0">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <VideoThumbnail
                                url={modulo.video_url}
                                className="w-12 sm:w-20 aspect-video"
                                iconSize="h-3 w-3 sm:h-4 sm:w-4"
                                completed={status === "concluido"}
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-foreground text-xs sm:text-sm leading-tight truncate">{modulo.titulo}</h4>
                                {modulo.descricao && <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 hidden sm:block">{modulo.descricao}</p>}
                                <div className="mt-1">
                                  {status === "concluido" ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Concluído</Badge>
                                  ) : status === "em_andamento" ? (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200"><Clock className="h-2.5 w-2.5 mr-0.5" />Em andamento</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0"><Clock className="h-2.5 w-2.5 mr-0.5" />Pendente</Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant={status === "concluido" ? "ghost" : "default"}
                                size="sm"
                                onClick={() => handleStartVideo(modulo)}
                                className={`text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 flex-shrink-0 ${status !== "concluido" ? "bg-primary" : ""}`}
                              >
                                {status === "concluido" ? "Rever" : "Assistir"}
                                <ChevronRight className="h-3 w-3 ml-0.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Legacy videos */}
            {legacyVideos.map(video => {
              const status = getVideoStatus(video.id);
              return (
                <Card key={video.id} className={`transition-shadow hover:shadow-md ${status === "concluido" ? "opacity-75" : ""}`}>
                  <CardContent className="p-2.5 sm:p-4">
                    <div className="flex items-center gap-2.5 sm:gap-4">
                      <VideoThumbnail
                        url={video.video_url}
                        className="w-14 sm:w-24 aspect-video rounded-lg"
                        iconSize="h-4 w-4 sm:h-6 sm:w-6"
                        completed={status === "concluido"}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-xs sm:text-sm truncate">{video.titulo}</h3>
                        {video.descricao && <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">{video.descricao}</p>}
                        <div className="mt-1.5">
                          {status === "concluido" ? (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Concluído</Badge>
                          ) : <Badge variant="outline" className="text-[10px] px-1.5"><Clock className="h-2.5 w-2.5 mr-0.5" />Pendente</Badge>}
                        </div>
                      </div>
                      <Button variant={status === "concluido" ? "ghost" : "default"} size="sm"
                        onClick={() => handleStartVideo(video)} className={`text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 flex-shrink-0 ${status !== "concluido" ? "bg-primary" : ""}`}>
                        {status === "concluido" ? "Rever" : "Assistir"}<ChevronRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
