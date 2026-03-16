import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import SignatureCanvas, { SignatureCanvasRef } from "@/components/SignatureCanvas";
import {
  Video, Play, CheckCircle, Clock, Award, LogOut, ChevronRight, AlertTriangle
} from "lucide-react";
import logoImg from "@/assets/logo-episafety.png";

interface VideoTreinamento {
  id: string;
  titulo: string;
  descricao: string | null;
  video_url: string;
  duracao_segundos: number;
  pontuacao_minima: number;
  created_at: string;
}

interface VideoVisualizacao {
  id: string;
  video_id: string;
  funcionario_id: string;
  percentual_assistido: number;
  pontuacao: number | null;
  concluido: boolean;
  assinatura: string | null;
}

interface VideoPergunta {
  id: string;
  video_id: string;
  pergunta: string;
  opcao_a: string;
  opcao_b: string;
  opcao_c: string | null;
  opcao_d: string | null;
  resposta_correta: string;
  ordem: number;
}

export default function PortalTreinamentos() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoTreinamento[]>([]);
  const [visualizacoes, setVisualizacoes] = useState<VideoVisualizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  // Watch state
  const [watchingVideo, setWatchingVideo] = useState<VideoTreinamento | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false);
  const [perguntas, setPerguntas] = useState<VideoPergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<{ pontuacao: number; aprovado: boolean } | null>(null);

  // Signature state
  const [showSignature, setShowSignature] = useState(false);
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const [saving, setSaving] = useState(false);

  // Fetch linked funcionario_id for the logged user
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [assignedVideoIds, setAssignedVideoIds] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Get profile info
      const { data: profile } = await supabase.from("profiles").select("nome, empresa_id").eq("user_id", user?.id || "").single();
      if (profile) setUserName(profile.nome || user?.email || "");

      let foundFuncId: string | null = null;

      // Find linked funcionario by name/email
      if (profile?.empresa_id) {
        const { data: funcs } = await supabase.from("funcionarios").select("id, nome").eq("empresa_id", profile.empresa_id);
        const matched = funcs?.find(f => f.nome.toLowerCase() === (profile.nome || "").toLowerCase());
        if (matched) foundFuncId = matched.id;
        else if (funcs && funcs.length > 0) foundFuncId = funcs[0].id;
      }

      if (!foundFuncId) {
        // Try without empresa filter
        const { data: allFuncs } = await supabase.from("funcionarios").select("id, nome");
        const matched = allFuncs?.find(f => f.nome.toLowerCase() === (profile?.nome || "").toLowerCase());
        if (matched) foundFuncId = matched.id;
      }

      setFuncionarioId(foundFuncId);

      // Get assigned videos for this employee
      if (foundFuncId) {
        const { data: assignments } = await supabase.from("videos_atribuicao").select("video_id").eq("funcionario_id", foundFuncId);
        const ids = (assignments || []).map((a: any) => a.video_id);
        setAssignedVideoIds(ids);
      }

      // Get all global videos
      const { data: vids } = await supabase.from("videos_treinamento").select("*").order("created_at", { ascending: false });
      if (vids) setVideos(vids as VideoTreinamento[]);

      // Get visualizações
      const { data: vizs } = await supabase.from("videos_visualizacao").select("*");
      if (vizs) setVisualizacoes(vizs as VideoVisualizacao[]);
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

  // Only show assigned videos (or all if no assignments exist)
  const myVideos = useMemo(() => {
    if (assignedVideoIds.length === 0) return videos;
    return videos.filter(v => assignedVideoIds.includes(v.id));
  }, [videos, assignedVideoIds]);

  const completedCount = useMemo(() => {
    return myVideos.filter(v => getVideoStatus(v.id) === "concluido").length;
  }, [myVideos, visualizacoes, funcionarioId]);

  const handleStartVideo = (video: VideoTreinamento) => {
    setWatchingVideo(video);
    setVideoEnded(false);
    setShowQuiz(false);
    setQuizResult(null);
    setShowSignature(false);
    setRespostas({});
  };

  const handleVideoEnded = async () => {
    setVideoEnded(true);
    if (!watchingVideo || !funcionarioId) return;

    // Load quiz questions
    const { data: pergs } = await supabase.from("videos_perguntas").select("*").eq("video_id", watchingVideo.id).order("ordem");
    if (pergs && pergs.length > 0) {
      setPerguntas(pergs as VideoPergunta[]);
      setShowQuiz(true);
    } else {
      // No quiz, go directly to signature
      setShowSignature(true);
    }
  };

  const handleSubmitQuiz = () => {
    if (perguntas.length === 0) return;

    // Check if all questions answered
    const unanswered = perguntas.filter(p => !respostas[p.id]);
    if (unanswered.length > 0) {
      toast({ title: `Responda todas as ${perguntas.length} perguntas`, variant: "destructive" });
      return;
    }

    // Calculate score
    let corretas = 0;
    perguntas.forEach(p => {
      if (respostas[p.id] === p.resposta_correta) corretas++;
    });
    const pontuacao = Math.round((corretas / perguntas.length) * 100);
    const aprovado = pontuacao >= (watchingVideo?.pontuacao_minima || 70);

    setQuizResult({ pontuacao, aprovado });

    if (aprovado) {
      // Show signature after a moment
      setTimeout(() => setShowSignature(true), 1500);
    }
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

      // Upsert visualização
      const { error } = await supabase.from("videos_visualizacao").upsert({
        video_id: watchingVideo.id,
        funcionario_id: funcionarioId,
        percentual_assistido: 100,
        pontuacao: quizResult?.pontuacao ?? null,
        concluido: true,
        assinatura,
        empresa_id: null,
      }, { onConflict: "video_id,funcionario_id" });

      if (error) throw error;

      toast({ title: "Treinamento concluído!", description: "Sua participação foi registrada com sucesso." });
      setWatchingVideo(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSaving(false);
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
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setWatchingVideo(null)} className="text-sm">
              ← Voltar
            </Button>
            <Badge variant="outline">{watchingVideo.titulo}</Badge>
          </div>

          {/* Video Player */}
          <Card>
            <CardContent className="p-0 overflow-hidden rounded-lg">
              <video
                ref={videoRef}
                src={watchingVideo.video_url}
                controls
                autoPlay
                className="w-full aspect-video"
                onEnded={handleVideoEnded}
                controlsList="nodownload"
              />
            </CardContent>
          </Card>

          {watchingVideo.descricao && (
            <p className="text-sm text-muted-foreground">{watchingVideo.descricao}</p>
          )}

          {/* Video ended message */}
          {videoEnded && !showQuiz && !showSignature && (
            <Card className="border-primary">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-10 w-10 mx-auto text-primary mb-2" />
                <p className="font-semibold text-foreground">Vídeo concluído!</p>
                <p className="text-sm text-muted-foreground">Preparando próxima etapa...</p>
              </CardContent>
            </Card>
          )}

          {/* Quiz */}
          {showQuiz && !showSignature && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="text-center">
                  <Award className="h-8 w-8 mx-auto text-primary mb-2" />
                  <h2 className="text-lg font-bold text-foreground">Avaliação do Treinamento</h2>
                  <p className="text-sm text-muted-foreground">Responda as perguntas abaixo (nota mínima: {watchingVideo.pontuacao_minima}%)</p>
                </div>

                {perguntas.map((p, i) => (
                  <div key={p.id} className="space-y-2">
                    <Label className="font-semibold">{i + 1}. {p.pergunta}</Label>
                    <div className="grid gap-2">
                      {["a", "b", "c", "d"].map(opt => {
                        const text = p[`opcao_${opt}` as keyof VideoPergunta] as string | null;
                        if (!text) return null;
                        const selected = respostas[p.id] === opt;
                        const isCorrect = quizResult && p.resposta_correta === opt;
                        const isWrong = quizResult && selected && p.resposta_correta !== opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={!!quizResult}
                            className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                              isCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-800" :
                              isWrong ? "border-destructive bg-destructive/10 text-destructive" :
                              selected ? "border-primary bg-primary/10 text-foreground" :
                              "border-border hover:bg-muted"
                            }`}
                            onClick={() => setRespostas({ ...respostas, [p.id]: opt })}
                          >
                            <span className="font-bold mr-2">{opt.toUpperCase()})</span> {text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {!quizResult ? (
                  <Button onClick={handleSubmitQuiz} className="w-full bg-primary" size="lg">
                    Enviar Respostas
                  </Button>
                ) : (
                  <Card className={quizResult.aprovado ? "border-emerald-500" : "border-destructive"}>
                    <CardContent className="p-4 text-center">
                      {quizResult.aprovado ? (
                        <>
                          <CheckCircle className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                          <p className="font-bold text-emerald-700">Aprovado! Pontuação: {quizResult.pontuacao}%</p>
                          <p className="text-sm text-muted-foreground mt-1">Assine abaixo para confirmar</p>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
                          <p className="font-bold text-destructive">Reprovado. Pontuação: {quizResult.pontuacao}%</p>
                          <p className="text-sm text-muted-foreground mt-1">Nota mínima: {watchingVideo.pontuacao_minima}%. Assista novamente o vídeo.</p>
                          <Button variant="outline" className="mt-3" onClick={() => {
                            setShowQuiz(false);
                            setVideoEnded(false);
                            setQuizResult(null);
                            setRespostas({});
                            if (videoRef.current) {
                              videoRef.current.currentTime = 0;
                              videoRef.current.play();
                            }
                          }}>
                            Assistir Novamente
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          )}

          {/* Signature */}
          {showSignature && (quizResult?.aprovado || !showQuiz) && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 mx-auto text-primary mb-2" />
                  <h2 className="text-lg font-bold text-foreground">Confirme sua participação</h2>
                  <p className="text-sm text-muted-foreground">Assine abaixo para finalizar o treinamento</p>
                </div>
                <SignatureCanvas ref={signatureRef} label="Assinatura do Funcionário" height={200} />
                <Button onClick={handleSign} disabled={saving} className="w-full bg-primary" size="lg">
                  {saving ? "Salvando..." : "Concluir Treinamento"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Main portal view
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        {/* Progress overview */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Seu progresso</span>
              <span className="text-sm font-bold text-primary">{completedCount}/{myVideos.length}</span>
            </div>
            <Progress value={myVideos.length > 0 ? (completedCount / myVideos.length) * 100 : 0} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedCount === videos.length && videos.length > 0 ? "🎉 Parabéns! Todos os treinamentos concluídos!" : `${videos.length - completedCount} treinamento(s) pendente(s)`}
            </p>
          </CardContent>
        </Card>

        {/* Video list */}
        <div className="space-y-3">
          {videos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhum treinamento disponível</p>
                <p className="text-sm">Aguarde novos treinamentos serem publicados</p>
              </CardContent>
            </Card>
          ) : videos.map(video => {
            const status = getVideoStatus(video.id);
            const viz = visualizacoes.find(v => v.video_id === video.id && v.funcionario_id === funcionarioId);
            return (
              <Card key={video.id} className={`transition-shadow hover:shadow-md ${status === "concluido" ? "opacity-75" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="relative w-24 sm:w-32 aspect-video bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      <video src={video.video_url} className="w-full h-full object-cover" preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        {status === "concluido" ? (
                          <CheckCircle className="h-6 w-6 text-emerald-400" />
                        ) : (
                          <Play className="h-6 w-6 text-white" />
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm sm:text-base">{video.titulo}</h3>
                      {video.descricao && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{video.descricao}</p>}
                      <div className="flex gap-2 mt-2">
                        {status === "concluido" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" /> Concluído {viz?.pontuacao !== null ? `• ${viz?.pontuacao}%` : ""}
                          </Badge>
                        ) : status === "em_andamento" ? (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">
                            <Clock className="h-3 w-3 mr-1" /> Em andamento
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" /> Pendente
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <Button
                      variant={status === "concluido" ? "ghost" : "default"}
                      size="sm"
                      onClick={() => handleStartVideo(video)}
                      className={status !== "concluido" ? "bg-primary" : ""}
                    >
                      {status === "concluido" ? "Rever" : "Assistir"}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
