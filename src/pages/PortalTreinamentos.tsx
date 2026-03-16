import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  const maxWatchedTimeRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);




  const [showSignature, setShowSignature] = useState(false);
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const [saving, setSaving] = useState(false);

  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
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
        const { data: funcs } = await supabase.from("funcionarios").select("id, nome")
          .eq("empresa_id", profile.empresa_id).is("data_demissao", null);
        const matched = funcs?.find(f => normalize(f.nome) === normalizedProfileName);
        if (matched) foundFuncId = matched.id;
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

  // Save progress when leaving a video
  const saveProgress = useCallback(async (videoId: string) => {
    if (!funcionarioId || !videoRef.current) return;
    const vid = videoRef.current;
    const percentual = vid.duration > 0 ? Math.round((maxWatchedTimeRef.current / vid.duration) * 100) : 0;
    if (percentual <= 0) return;
    try {
      await supabase.from("videos_visualizacao").upsert({
        video_id: videoId,
        funcionario_id: funcionarioId,
        percentual_assistido: Math.min(percentual, 100),
        concluido: false,
        empresa_id: null,
      }, { onConflict: "video_id,funcionario_id" });
    } catch {}
  }, [funcionarioId]);

  const handleStartVideo = (video: VideoTreinamento) => {
    // Save progress of current video before switching
    if (watchingVideo && !videoEnded) {
      saveProgress(watchingVideo.id);
    }
    setWatchingVideo(video);
    setVideoEnded(false);
    setShowSignature(false);
    setIsPlaying(true);
    setIsMuted(false);
    setCurrentTime(0);
    setDuration(0);

    // Restore last watched position from visualizacoes
    const viz = visualizacoes.find(v => v.video_id === video.id && v.funcionario_id === funcionarioId);
    if (viz && !viz.concluido && viz.percentual_assistido > 0 && viz.percentual_assistido < 100) {
      // We'll set start time after metadata loads
      maxWatchedTimeRef.current = -1; // flag to restore
    } else {
      maxWatchedTimeRef.current = 0;
    }
  };

  const handleGoBack = () => {
    if (watchingVideo && !videoEnded) {
      saveProgress(watchingVideo.id);
    }
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
        empresa_id: null,
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
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleToggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

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
              <div className="bg-card">
                <video
                  ref={videoRef}
                  src={watchingVideo.video_url}
                  autoPlay
                  playsInline
                  tabIndex={-1}
                  className="w-full aspect-video bg-muted"
                  onEnded={handleVideoEnded}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onContextMenu={(e) => e.preventDefault()}
                  onLoadedMetadata={(e) => {
                    const vid = e.currentTarget;
                    const dur = vid.duration || 0;
                    setDuration(dur);

                    // Restore saved position
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
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-200"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
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
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="EPISafety" className="h-8" />
            <div>
              <h1 className="font-bold text-foreground text-sm">Portal de Treinamentos</h1>
              <p className="text-xs text-muted-foreground">{userName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Seu progresso</span>
              <span className="text-sm font-bold text-primary">{completedCount}/{totalModules}</span>
            </div>
            <Progress value={totalModules > 0 ? (completedCount / totalModules) * 100 : 0} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedCount === totalModules && totalModules > 0
                ? "🎉 Parabéns! Todos os treinamentos concluídos!"
                : `${totalModules - completedCount} módulo(s) pendente(s)`}
            </p>
          </CardContent>
        </Card>

        {/* Content */}
        {!hasContent ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum treinamento atribuído</p>
              <p className="text-sm">Seu acesso mostra apenas os cursos selecionados pelo administrador</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Cursos with modules */}
            {myCursos.map(curso => {
              const modulos = getModulos(curso.id);
              const isExpanded = expandedCursos.has(curso.id);
              const cursoCompleted = modulos.filter(m => getVideoStatus(m.id) === "concluido").length;
              const cursoTotal = modulos.length;

              return (
                <Card key={curso.id} className="overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleExpand(curso.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="bg-primary/10 p-2 rounded-lg">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground">{curso.titulo}</h3>
                          {curso.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{curso.descricao}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={cursoCompleted === cursoTotal && cursoTotal > 0 ? "default" : "outline"} className={cursoCompleted === cursoTotal && cursoTotal > 0 ? "bg-emerald-100 text-emerald-700" : ""}>
                          {cursoCompleted}/{cursoTotal}
                        </Badge>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </div>
                    {cursoTotal > 0 && (
                      <Progress value={(cursoCompleted / cursoTotal) * 100} className="h-1.5 mt-3" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t divide-y">
                      {modulos.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">Nenhum módulo disponível</div>
                      ) : modulos.map((modulo, idx) => {
                        const status = getVideoStatus(modulo.id);
                        const viz = visualizacoes.find(v => v.video_id === modulo.id && v.funcionario_id === funcionarioId);
                        return (
                          <div key={modulo.id} className={`p-4 flex items-center gap-4 ${status === "concluido" ? "opacity-75 bg-muted/30" : ""}`}>
                            <span className="bg-primary/10 text-primary font-bold text-xs rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0">
                              {String(idx + 1).padStart(2, "0")}
                            </span>

                            <div className="relative w-20 aspect-video bg-muted rounded overflow-hidden flex-shrink-0">
                              <video src={modulo.video_url} className="w-full h-full object-cover" preload="metadata" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                {status === "concluido" ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Play className="h-4 w-4 text-white" />}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-foreground text-sm">{modulo.titulo}</h4>
                              {modulo.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{modulo.descricao}</p>}
                              <div className="mt-1">
                                {status === "concluido" ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Concluído</Badge>
                                ) : status === "em_andamento" ? (
                                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700"><Clock className="h-3 w-3 mr-1" />Em andamento</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
                                )}
                              </div>
                            </div>

                            <Button variant={status === "concluido" ? "ghost" : "default"} size="sm"
                              onClick={() => handleStartVideo(modulo)} className={status !== "concluido" ? "bg-primary" : ""}>
                              {status === "concluido" ? "Rever" : "Assistir"}
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Legacy videos (no curso) */}
            {legacyVideos.map(video => {
              const status = getVideoStatus(video.id);
              const viz = visualizacoes.find(v => v.video_id === video.id && v.funcionario_id === funcionarioId);
              return (
                <Card key={video.id} className={`transition-shadow hover:shadow-md ${status === "concluido" ? "opacity-75" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 aspect-video bg-muted rounded-lg overflow-hidden flex-shrink-0">
                        <video src={video.video_url} className="w-full h-full object-cover" preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          {status === "concluido" ? <CheckCircle className="h-6 w-6 text-emerald-400" /> : <Play className="h-6 w-6 text-white" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm">{video.titulo}</h3>
                        {video.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{video.descricao}</p>}
                        <div className="flex gap-2 mt-2">
                          {status === "concluido" ? (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Concluído</Badge>
                          ) : <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>}
                        </div>
                      </div>
                      <Button variant={status === "concluido" ? "ghost" : "default"} size="sm"
                        onClick={() => handleStartVideo(video)} className={status !== "concluido" ? "bg-primary" : ""}>
                        {status === "concluido" ? "Rever" : "Assistir"}<ChevronRight className="h-4 w-4 ml-1" />
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
