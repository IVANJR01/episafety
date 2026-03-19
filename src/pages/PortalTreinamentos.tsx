import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { VideoThumbnail } from "@/components/VideoPlayer";
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
  const maxWatchedTimeRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);




  const [showSignature, setShowSignature] = useState(false);
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const [saving, setSaving] = useState(false);

  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [funcEmpresaId, setFuncEmpresaId] = useState<string | null>(null);
  const [assignedCursoIds, setAssignedCursoIds] = useState<string[]>([]);

  const normalize = (value?: string | null) =>
    (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles").select("nome, empresa_id").eq("user_id", user?.id || "").maybeSingle();

      if (profile) setUserName(profile.nome || user?.email || "");

      const normalizedProfileName = normalize(profile?.nome);
      let foundFuncId: string | null = null;

      if (profile?.empresa_id && normalizedProfileName) {
        setFuncEmpresaId(profile.empresa_id);
        const { data: funcs } = await supabase.from("funcionarios").select("id, nome, empresa_id")
          .eq("empresa_id", profile.empresa_id).is("data_demissao", null);
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

      // Fetch curso assignments
      let cursoIds: string[] = [];
      if (foundFuncId) {
        const { data: cursoAssign } = await supabase.from("cursos_atribuicao")
          .select("curso_id").eq("funcionario_id", foundFuncId);
        cursoIds = (cursoAssign || []).map((a: any) => a.curso_id);
      }
      setAssignedCursoIds(cursoIds);

      // Fallback: also check videos_atribuicao for legacy assignments
      let legacyVideoIds: string[] = [];
      if (foundFuncId && cursoIds.length === 0) {
        const { data: videoAssign } = await supabase.from("videos_atribuicao")
          .select("video_id").eq("funcionario_id", foundFuncId);
        legacyVideoIds = (videoAssign || []).map((a: any) => a.video_id);
      }

      const [{ data: cursosData }, { data: vids }, { data: vizs }] = await Promise.all([
        supabase.from("cursos_video").select("*").order("created_at", { ascending: false }),
        supabase.from("videos_treinamento").select("*").order("ordem", { ascending: true }),
        supabase.from("videos_visualizacao").select("*"),
      ]);

      if (cursosData) setCursos(cursosData as any);
      if (vids) {
        let filteredVids = vids as any as VideoTreinamento[];
        // If legacy mode (no curso assignments), keep legacy video filtering
        if (cursoIds.length === 0 && legacyVideoIds.length > 0) {
          filteredVids = filteredVids.filter(v => legacyVideoIds.includes(v.id));
        }
        setVideos(filteredVids);
      }
      if (vizs) setVisualizacoes(vizs as any);

      // Auto-expand all assigned cursos
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

  const clearYouTubeProgressTimer = useCallback(() => {
    if (youtubeProgressTimerRef.current !== null) {
      window.clearInterval(youtubeProgressTimerRef.current);
      youtubeProgressTimerRef.current = null;
    }
  }, []);

  const getPlaybackMetrics = useCallback(() => {
    if (watchingVideo && isYouTubeUrl(watchingVideo.video_url) && youtubePlayerRef.current) {
      return {
        current: Number(youtubePlayerRef.current.getCurrentTime?.()) || 0,
        total: Number(youtubePlayerRef.current.getDuration?.()) || 0,
      };
    }

    return {
      current: videoRef.current?.currentTime ?? 0,
      total: videoRef.current?.duration ?? 0,
    };
  }, [watchingVideo]);

  const syncYouTubeProgress = useCallback(() => {
    if (!watchingVideo || !isYouTubeUrl(watchingVideo.video_url) || !youtubePlayerRef.current) return;

    const { current, total } = getPlaybackMetrics();
    if (current > maxWatchedTimeRef.current) {
      maxWatchedTimeRef.current = current;
    }

    setCurrentTime(current);
    setDuration(total);
  }, [getPlaybackMetrics, watchingVideo]);

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
    // Save progress of current video before switching
    if (watchingVideo && !videoEnded) {
      saveProgress(watchingVideo.id);
    }

    clearYouTubeProgressTimer();
    youtubePlayerRef.current?.destroy?.();
    youtubePlayerRef.current = null;

    setWatchingVideo(video);
    setVideoEnded(false);
    setShowSignature(false);
    setIsPlaying(true);
    setIsMuted(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackRate(1);

    // Restore last watched position from visualizacoes
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
    clearYouTubeProgressTimer();
    youtubePlayerRef.current?.destroy?.();
    youtubePlayerRef.current = null;
    setWatchingVideo(null);
    fetchData(); // refresh visualizacoes
  };

  const handleVideoEnded = async () => {
    setVideoEnded(true);
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
    if (watchingVideo && isYouTubeUrl(watchingVideo.video_url) && youtubePlayerRef.current) {
      const playerState = youtubePlayerRef.current.getPlayerState?.();
      if (playerState === window.YT?.PlayerState?.PLAYING) {
        youtubePlayerRef.current.pauseVideo?.();
        setIsPlaying(false);
      } else {
        youtubePlayerRef.current.playVideo?.();
        setIsPlaying(true);
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleToggleMute = () => {
    if (watchingVideo && isYouTubeUrl(watchingVideo.video_url) && youtubePlayerRef.current) {
      const muted = youtubePlayerRef.current.isMuted?.();
      if (muted) {
        youtubePlayerRef.current.unMute?.();
        setIsMuted(false);
      } else {
        youtubePlayerRef.current.mute?.();
        setIsMuted(true);
      }
      return;
    }

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

    if (watchingVideo && isYouTubeUrl(watchingVideo.video_url) && youtubePlayerRef.current) {
      youtubePlayerRef.current.setPlaybackRate?.(newRate);
      return;
    }

    const video = videoRef.current;
    if (video) video.playbackRate = newRate;
  };

  const handleToggleFullscreen = async () => {
    const container = videoContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      // Try standard first, then webkit (Safari)
      if (container.requestFullscreen) {
        await container.requestFullscreen().catch(() => {});
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      clearYouTubeProgressTimer();
      youtubePlayerRef.current?.destroy?.();
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, [clearYouTubeProgressTimer]);

  useEffect(() => {
    if (!watchingVideo || !isYouTubeUrl(watchingVideo.video_url) || !youtubePlayerHostRef.current) return;

    let cancelled = false;

    const initPlayer = () => {
      if (cancelled || !window.YT?.Player || !youtubePlayerHostRef.current) return;

      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = new window.YT.Player(youtubePlayerHostRef.current, {
        videoId: getYouTubeVideoId(watchingVideo.video_url) || undefined,
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
          fs: 0,
          disablekb: 1,
        },
        events: {
          onReady: (event: any) => {
            const player = event.target as YouTubePlayer;
            player.setPlaybackRate?.(playbackRate);
            const total = Number(player.getDuration?.()) || 0;
            setDuration(total);
            setIsMuted(Boolean(player.isMuted?.()));

            if (maxWatchedTimeRef.current === -1) {
              const viz = visualizacoes.find(v => v.video_id === watchingVideo.id && v.funcionario_id === funcionarioId);
              if (viz && viz.percentual_assistido > 0 && viz.percentual_assistido < 100 && total > 0) {
                const resumeTime = (viz.percentual_assistido / 100) * total;
                player.seekTo?.(resumeTime, true);
                maxWatchedTimeRef.current = resumeTime;
                setCurrentTime(resumeTime);
              } else {
                maxWatchedTimeRef.current = 0;
                setCurrentTime(0);
              }
            }

            clearYouTubeProgressTimer();
            youtubeProgressTimerRef.current = window.setInterval(syncYouTubeProgress, 500);
          },
          onStateChange: (event: any) => {
            if (!window.YT?.PlayerState) return;
            if (event.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
            if (event.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
            if (event.data === window.YT.PlayerState.ENDED) {
              clearYouTubeProgressTimer();
              syncYouTubeProgress();
              void handleVideoEnded();
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }

      const previousHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousHandler?.();
        initPlayer();
      };
    }

    return () => {
      cancelled = true;
      clearYouTubeProgressTimer();
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, [watchingVideo, playbackRate, visualizacoes, funcionarioId, clearYouTubeProgressTimer, syncYouTubeProgress]);

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
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={handleGoBack} className="text-sm">← Voltar</Button>
            <Badge variant="outline">{watchingVideo.titulo}</Badge>
          </div>

          <Card>
            <CardContent className="p-0 overflow-hidden rounded-lg">
              <div ref={videoContainerRef} className={`bg-card ${isFullscreen ? 'flex flex-col h-screen w-screen' : ''}`}>
                {isExternalVideoUrl(watchingVideo.video_url) ? (
                  <>
                    <div className={`w-full bg-muted ${isFullscreen ? 'flex-1' : 'aspect-video'} relative overflow-hidden`}>
                      {isYouTubeUrl(watchingVideo.video_url) ? (
                        <div className="absolute inset-0 overflow-hidden">
                          <div
                            ref={youtubePlayerHostRef}
                            className="absolute -top-12 inset-x-0 bottom-0 h-[calc(100%+96px)]"
                          />
                          {(!isPlaying || videoEnded) && (
                            <div className="absolute inset-0 z-20 bg-background">
                              {getYouTubeThumbnail(watchingVideo.video_url) ? (
                                <img
                                  src={getYouTubeThumbnail(watchingVideo.video_url) || ""}
                                  alt={watchingVideo.titulo}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="h-full w-full bg-muted" />
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <iframe
                          src={`${getEmbedUrl(watchingVideo.video_url) || watchingVideo.video_url}&autoplay=1`}
                          className="absolute inset-0 h-full w-full"
                          style={{ border: 0 }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3 border-t border-border bg-card px-4 py-3">
                      <Button type="button" variant="outline" size="sm" onClick={handleTogglePlay}>
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleToggleMute}>
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </Button>
                      <div className="flex-1 space-y-2">
                        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
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
                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      src={watchingVideo.video_url}
                      autoPlay
                      muted
                      playsInline
                      // @ts-ignore - webkit attribute for iOS
                      webkit-playsinline="true"
                      preload="auto"
                      tabIndex={-1}
                      className={`w-full bg-muted ${isFullscreen ? 'flex-1 object-contain' : 'aspect-video'}`}
                      onEnded={handleVideoEnded}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onContextMenu={(e) => e.preventDefault()}
                      onLoadedMetadata={(e) => {
                        const vid = e.currentTarget;
                        const dur = vid.duration || 0;
                        setDuration(dur);
                        vid.muted = false;
                        setIsMuted(false);
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
                        const allowedTime = maxWatchedTimeRef.current + 0.25;
                        if (vid.currentTime > allowedTime) {
                          vid.currentTime = maxWatchedTimeRef.current;
                        }
                      }}
                      onError={(e) => {
                        console.error("Video load error:", (e.currentTarget as any).error);
                      }}
                      controls={false}
                      controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
                      disablePictureInPicture
                    />
                    <div className="flex items-center gap-3 border-t border-border bg-card px-4 py-3">
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
                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                      </Button>
                    </div>
                  </>
                )}
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
