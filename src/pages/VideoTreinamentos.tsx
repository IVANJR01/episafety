import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, Search, Video, Upload, Play, CheckCircle, Clock, AlertTriangle,
  Eye, Award, Users, BarChart3, Pencil, X, ChevronDown, ChevronUp
} from "lucide-react";

interface VideoTreinamento {
  id: string;
  titulo: string;
  descricao: string | null;
  video_url: string;
  duracao_segundos: number;
  pontuacao_minima: number;
  empresa_id: string | null;
  created_at: string;
}

interface VideoVisualizacao {
  id: string;
  video_id: string;
  funcionario_id: string;
  percentual_assistido: number;
  pontuacao: number | null;
  concluido: boolean;
  empresa_id: string | null;
  created_at: string;
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

interface Funcionario {
  id: string;
  nome: string;
  cargo: string | null;
  setor: string | null;
}

export default function VideoTreinamentos() {
  const { empresaId, isSuperAdmin, isPrincipal, modulosPermitidos } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoTreinamento[]>([]);
  const [visualizacoes, setVisualizacoes] = useState<VideoVisualizacao[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("videos");

  // Employee access management
  const [openAccess, setOpenAccess] = useState(false);
  const [accessFuncId, setAccessFuncId] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessFuncSearch, setAccessFuncSearch] = useState("");
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [showAccessFuncList, setShowAccessFuncList] = useState(false);

  // Dialog states
  const [openForm, setOpenForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoTreinamento | null>(null);
  const [uploading, setUploading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Quiz dialog
  const [openQuiz, setOpenQuiz] = useState(false);
  const [quizVideoId, setQuizVideoId] = useState("");
  const [perguntas, setPerguntas] = useState<VideoPergunta[]>([]);
  const [novaPergunta, setNovaPergunta] = useState({ pergunta: "", opcao_a: "", opcao_b: "", opcao_c: "", opcao_d: "", resposta_correta: "a" });

  // Detail dialog
  const [openDetail, setOpenDetail] = useState(false);
  const [detailVideo, setDetailVideo] = useState<VideoTreinamento | null>(null);

  const [form, setForm] = useState({ titulo: "", descricao: "", pontuacao_minima: "70" });

  const canCreate = isSuperAdmin;
  const canEdit = isSuperAdmin;
  const canDelete = isSuperAdmin;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: vids }, { data: vizs }, { data: funcs }] = await Promise.all([
        supabase.from("videos_treinamento").select("*").order("created_at", { ascending: false }),
        supabase.from("videos_visualizacao").select("*"),
        supabase.from("funcionarios").select("id, nome, cargo, setor").is("data_demissao", null),
      ]);
      if (vids) setVideos(vids as VideoTreinamento[]);
      if (vizs) setVisualizacoes(vizs as VideoVisualizacao[]);
      if (funcs) setFuncionarios(funcs as Funcionario[]);
    } catch {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Stats
  const stats = useMemo(() => {
    const totalVideos = videos.length;
    const totalFunc = funcionarios.length;
    const totalViews = visualizacoes.length;
    const concluidos = visualizacoes.filter(v => v.concluido).length;
    const aprovados = visualizacoes.filter(v => {
      const video = videos.find(vid => vid.id === v.video_id);
      return v.pontuacao !== null && video && v.pontuacao >= video.pontuacao_minima;
    }).length;
    const mediaGeral = totalViews > 0 ? Math.round(visualizacoes.reduce((s, v) => s + (v.pontuacao || 0), 0) / totalViews) : 0;
    return { totalVideos, totalFunc, totalViews, concluidos, aprovados, mediaGeral };
  }, [videos, visualizacoes, funcionarios]);

  const filteredVideos = useMemo(() => {
    if (!search.trim()) return videos;
    const q = search.toLowerCase();
    return videos.filter(v => v.titulo.toLowerCase().includes(q) || (v.descricao || "").toLowerCase().includes(q));
  }, [videos, search]);

  const getVideoStats = (videoId: string) => {
    const vizs = visualizacoes.filter(v => v.video_id === videoId);
    const total = funcionarios.length;
    const assistiram = vizs.length;
    const concluidos = vizs.filter(v => v.concluido).length;
    const video = videos.find(v => v.id === videoId);
    const aprovados = vizs.filter(v => v.pontuacao !== null && video && v.pontuacao >= video.pontuacao_minima).length;
    const mediaPontuacao = vizs.length > 0 ? Math.round(vizs.filter(v => v.pontuacao !== null).reduce((s, v) => s + (v.pontuacao || 0), 0) / Math.max(vizs.filter(v => v.pontuacao !== null).length, 1)) : 0;
    return { total, assistiram, concluidos, aprovados, mediaPontuacao, percentAssistiram: total > 0 ? Math.round((assistiram / total) * 100) : 0 };
  };

  const handleUpload = async () => {
    if (!form.titulo.trim()) {
      toast({ title: "Informe o título do treinamento", variant: "destructive" });
      return;
    }
    if (!videoFile && !editingVideo) {
      toast({ title: "Selecione um vídeo", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      let videoUrl = editingVideo?.video_url || "";

      if (videoFile) {
        const fileExt = videoFile.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("videos-treinamento").upload(fileName, videoFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("videos-treinamento").getPublicUrl(fileName);
        videoUrl = urlData.publicUrl;
      }

      if (editingVideo) {
        const { error } = await supabase.from("videos_treinamento").update({
          titulo: form.titulo,
          descricao: form.descricao || null,
          pontuacao_minima: parseInt(form.pontuacao_minima) || 70,
          ...(videoFile ? { video_url: videoUrl } : {}),
        }).eq("id", editingVideo.id);
        if (error) throw error;
        toast({ title: "Treinamento atualizado!" });
      } else {
        const { error } = await supabase.from("videos_treinamento").insert({
          titulo: form.titulo,
          descricao: form.descricao || null,
          video_url: videoUrl,
          pontuacao_minima: parseInt(form.pontuacao_minima) || 70,
          empresa_id: null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
        if (error) throw error;
        toast({ title: "Treinamento cadastrado!" });
      }
      setOpenForm(false);
      setVideoFile(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este treinamento e todos os dados vinculados?")) return;
    const { error } = await supabase.from("videos_treinamento").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Treinamento excluído" });
      fetchData();
    }
  };

  // Quiz management
  const openQuizManager = async (videoId: string) => {
    setQuizVideoId(videoId);
    const { data } = await supabase.from("videos_perguntas").select("*").eq("video_id", videoId).order("ordem");
    setPerguntas((data || []) as VideoPergunta[]);
    setNovaPergunta({ pergunta: "", opcao_a: "", opcao_b: "", opcao_c: "", opcao_d: "", resposta_correta: "a" });
    setOpenQuiz(true);
  };

  const addPergunta = async () => {
    if (!novaPergunta.pergunta.trim() || !novaPergunta.opcao_a.trim() || !novaPergunta.opcao_b.trim()) {
      toast({ title: "Preencha a pergunta e pelo menos as opções A e B", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("videos_perguntas").insert({
      video_id: quizVideoId,
      pergunta: novaPergunta.pergunta,
      opcao_a: novaPergunta.opcao_a,
      opcao_b: novaPergunta.opcao_b,
      opcao_c: novaPergunta.opcao_c || null,
      opcao_d: novaPergunta.opcao_d || null,
      resposta_correta: novaPergunta.resposta_correta,
      ordem: perguntas.length + 1,
      empresa_id: null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pergunta adicionada!" });
    openQuizManager(quizVideoId);
  };

  const deletePergunta = async (id: string) => {
    await supabase.from("videos_perguntas").delete().eq("id", id);
    openQuizManager(quizVideoId);
  };

  // Detail view
  const openVideoDetail = (video: VideoTreinamento) => {
    setDetailVideo(video);
    setOpenDetail(true);
  };

  const detailVisualizacoes = useMemo(() => {
    if (!detailVideo) return [];
    return visualizacoes.filter(v => v.video_id === detailVideo.id);
  }, [detailVideo, visualizacoes]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return "--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredAccessFuncionarios = useMemo(() => {
    if (!accessFuncSearch.trim()) return funcionarios.slice().sort((a, b) => a.nome.localeCompare(b.nome));
    const q = normalize(accessFuncSearch);
    return funcionarios.filter(f => normalize(f.nome).includes(q)).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [funcionarios, accessFuncSearch]);

  const handleCreateAccess = async () => {
    if (!accessFuncId || !accessEmail.trim() || !accessPassword.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (accessPassword.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setCreatingAccess(true);
    try {
      const func = funcionarios.find(f => f.id === accessFuncId);
      // Create auth user via edge function
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email: accessEmail.toLowerCase().trim(), password: accessPassword, nome: func?.nome || "" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const userId = data.id;

      // Add to usuarios_liberados with only video_treinamentos permission
      await supabase.from("usuarios_liberados").upsert({
        email: accessEmail.toLowerCase().trim(),
        nome: func?.nome || "",
        empresa_id: empresaId,
        modulos_permitidos: ["video_treinamentos:view"],
        is_principal: false,
      }, { onConflict: "email,empresa_id" });

      // Update profile
      await supabase.from("profiles").upsert({
        user_id: userId,
        email: accessEmail.toLowerCase().trim(),
        nome: func?.nome || "",
        empresa_id: empresaId,
      }, { onConflict: "user_id" });

      toast({ title: "Acesso criado!", description: `Login: ${accessEmail} / Senha: ${accessPassword}` });
      setOpenAccess(false);
      setAccessFuncId("");
      setAccessEmail("");
      setAccessPassword("");
      setAccessFuncSearch("");
    } catch (err: any) {
      toast({ title: "Erro ao criar acesso", description: err.message, variant: "destructive" });
    }
    setCreatingAccess(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Video className="h-7 w-7 text-primary" />
            Treinamentos em Vídeo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie vídeos de treinamento e acompanhe a pontuação dos funcionários</p>
        </div>
        <div className="flex gap-2">
          {(isSuperAdmin || isPrincipal) && (
            <Button variant="outline" onClick={() => { setAccessFuncId(""); setAccessEmail(""); setAccessPassword(""); setAccessFuncSearch(""); setShowAccessFuncList(false); setOpenAccess(true); }}>
              <Users className="h-4 w-4 mr-2" /> Criar Acesso Funcionário
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => { setEditingVideo(null); setForm({ titulo: "", descricao: "", pontuacao_minima: "70" }); setVideoFile(null); setOpenForm(true); }} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> Adicionar Treinamento
            </Button>
          )}
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Video className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold text-foreground">{stats.totalVideos}</div>
            <div className="text-xs text-muted-foreground">Treinamentos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold text-foreground">{stats.totalFunc}</div>
            <div className="text-xs text-muted-foreground">Funcionários</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold text-foreground">{stats.totalViews}</div>
            <div className="text-xs text-muted-foreground">Visualizações</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
            <div className="text-2xl font-bold text-foreground">{stats.concluidos}</div>
            <div className="text-xs text-muted-foreground">Concluídos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <div className="text-2xl font-bold text-foreground">{stats.aprovados}</div>
            <div className="text-xs text-muted-foreground">Aprovados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold text-foreground">{stats.mediaGeral}%</div>
            <div className="text-xs text-muted-foreground">Média Geral</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar treinamento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Videos list */}
      <div className="grid gap-4">
        {filteredVideos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum treinamento cadastrado</p>
              <p className="text-sm">Clique em "Adicionar Treinamento" para começar</p>
            </CardContent>
          </Card>
        ) : filteredVideos.map(video => {
          const vs = getVideoStats(video.id);
          return (
            <Card key={video.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Video preview */}
                  <div className="relative w-full lg:w-64 aspect-video bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    <video src={video.video_url} className="w-full h-full object-cover" preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="h-10 w-10 text-white" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground text-lg">{video.titulo}</h3>
                        {video.descricao && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{video.descricao}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openVideoDetail(video)} title="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => openQuizManager(video.id)} title="Gerenciar Quiz">
                            <Award className="h-4 w-4" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditingVideo(video);
                            setForm({ titulo: video.titulo, descricao: video.descricao || "", pontuacao_minima: String(video.pontuacao_minima) });
                            setVideoFile(null);
                            setOpenForm(true);
                          }} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(video.id)} title="Excluir" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      <div className="text-center">
                        <div className="text-sm font-bold text-foreground">{vs.assistiram}/{vs.total}</div>
                        <div className="text-xs text-muted-foreground">Assistiram</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-foreground">{vs.concluidos}</div>
                        <div className="text-xs text-muted-foreground">Concluídos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-foreground">{vs.aprovados}</div>
                        <div className="text-xs text-muted-foreground">Aprovados</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-foreground">{vs.mediaPontuacao}%</div>
                        <div className="text-xs text-muted-foreground">Média</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progresso geral</span>
                        <span>{vs.percentAssistiram}%</span>
                      </div>
                      <Progress value={vs.percentAssistiram} className="h-2" />
                    </div>

                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Badge variant="outline" className="text-xs">Nota mínima: {video.pontuacao_minima}%</Badge>
                      <Badge variant="outline" className="text-xs">{new Date(video.created_at).toLocaleDateString("pt-BR")}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upload / Edit Dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVideo ? "Editar Treinamento" : "Adicionar Treinamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: NR-35 Trabalho em Altura" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do treinamento..." rows={3} />
            </div>
            <div>
              <Label>Pontuação Mínima (%)</Label>
              <Input type="number" min={0} max={100} value={form.pontuacao_minima} onChange={e => setForm({ ...form, pontuacao_minima: e.target.value })} />
            </div>
            <div>
              <Label>{editingVideo ? "Substituir vídeo (opcional)" : "Vídeo *"}</Label>
              <div className="mt-1">
                <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {videoFile ? videoFile.name : "Clique para selecionar o vídeo"}
                  </span>
                  <input type="file" accept="video/*" className="hidden" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading} className="bg-primary">
              {uploading ? "Enviando..." : editingVideo ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz Manager Dialog */}
      <Dialog open={openQuiz} onOpenChange={setOpenQuiz}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Gerenciar Quiz - {videos.find(v => v.id === quizVideoId)?.titulo}
            </DialogTitle>
          </DialogHeader>

          {/* Existing questions */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Perguntas ({perguntas.length})</h3>
            {perguntas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pergunta cadastrada ainda.</p>
            ) : perguntas.map((p, i) => (
              <Card key={p.id}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{i + 1}. {p.pergunta}</p>
                      <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                        <span className={p.resposta_correta === "a" ? "font-bold text-emerald-600" : "text-muted-foreground"}>A) {p.opcao_a}</span>
                        <span className={p.resposta_correta === "b" ? "font-bold text-emerald-600" : "text-muted-foreground"}>B) {p.opcao_b}</span>
                        {p.opcao_c && <span className={p.resposta_correta === "c" ? "font-bold text-emerald-600" : "text-muted-foreground"}>C) {p.opcao_c}</span>}
                        {p.opcao_d && <span className={p.resposta_correta === "d" ? "font-bold text-emerald-600" : "text-muted-foreground"}>D) {p.opcao_d}</span>}
                      </div>
                    </div>
                    {canDelete && (
                      <Button variant="ghost" size="icon" onClick={() => deletePergunta(p.id)} className="text-destructive h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add new question */}
          {canCreate && (
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Nova Pergunta</h3>
              <div>
                <Label className="text-xs">Pergunta *</Label>
                <Input value={novaPergunta.pergunta} onChange={e => setNovaPergunta({ ...novaPergunta, pergunta: e.target.value })} placeholder="Digite a pergunta..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Opção A *</Label>
                  <Input value={novaPergunta.opcao_a} onChange={e => setNovaPergunta({ ...novaPergunta, opcao_a: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Opção B *</Label>
                  <Input value={novaPergunta.opcao_b} onChange={e => setNovaPergunta({ ...novaPergunta, opcao_b: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Opção C</Label>
                  <Input value={novaPergunta.opcao_c} onChange={e => setNovaPergunta({ ...novaPergunta, opcao_c: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Opção D</Label>
                  <Input value={novaPergunta.opcao_d} onChange={e => setNovaPergunta({ ...novaPergunta, opcao_d: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Resposta Correta</Label>
                <Select value={novaPergunta.resposta_correta} onValueChange={v => setNovaPergunta({ ...novaPergunta, resposta_correta: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">A</SelectItem>
                    <SelectItem value="b">B</SelectItem>
                    <SelectItem value="c">C</SelectItem>
                    <SelectItem value="d">D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addPergunta} className="w-full bg-primary">
                <Plus className="h-4 w-4 mr-2" /> Adicionar Pergunta
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={openDetail} onOpenChange={setOpenDetail}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailVideo?.titulo}</DialogTitle>
          </DialogHeader>
          {detailVideo && (
            <div className="space-y-4">
              {/* Video player */}
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <video src={detailVideo.video_url} controls className="w-full h-full" preload="metadata" />
              </div>

              {detailVideo.descricao && <p className="text-sm text-muted-foreground">{detailVideo.descricao}</p>}

              {/* Funcionários status */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Acompanhamento de Funcionários</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead className="text-center">% Assistido</TableHead>
                        <TableHead className="text-center">Pontuação</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {funcionarios.map(func => {
                        const viz = detailVisualizacoes.find(v => v.funcionario_id === func.id);
                        const aprovado = viz?.pontuacao !== null && viz?.pontuacao !== undefined && viz.pontuacao >= (detailVideo.pontuacao_minima || 70);
                        return (
                          <TableRow key={func.id}>
                            <TableCell>
                              <div>
                                <span className="font-medium text-sm">{func.nome}</span>
                                {func.cargo && <span className="text-xs text-muted-foreground ml-2">{func.cargo}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {viz ? (
                                <div className="flex items-center gap-2 justify-center">
                                  <Progress value={viz.percentual_assistido} className="h-2 w-16" />
                                  <span className="text-xs">{viz.percentual_assistido}%</span>
                                </div>
                              ) : <span className="text-xs text-muted-foreground">--</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {viz?.pontuacao !== null && viz?.pontuacao !== undefined ? (
                                <span className={`font-bold text-sm ${aprovado ? "text-emerald-600" : "text-destructive"}`}>{viz.pontuacao}%</span>
                              ) : <span className="text-xs text-muted-foreground">--</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {!viz ? (
                                <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>
                              ) : viz.concluido ? (
                                aprovado ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-xs"><CheckCircle className="h-3 w-3 mr-1" /> Aprovado</Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Reprovado</Badge>
                                )
                              ) : (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700"><Play className="h-3 w-3 mr-1" /> Em andamento</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
