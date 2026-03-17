import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Trash2, Search, Video, Upload, Play, CheckCircle, Clock, AlertTriangle,
  Eye, Award, Users, BarChart3, Pencil, X, ChevronDown, ChevronUp, BookOpen, Layers, GripVertical
} from "lucide-react";

interface CursoVideo {
  id: string;
  titulo: string;
  descricao: string | null;
  pontuacao_minima: number;
  empresa_id: string | null;
  created_at: string;
}

interface VideoTreinamento {
  id: string;
  titulo: string;
  descricao: string | null;
  video_url: string;
  duracao_segundos: number;
  pontuacao_minima: number;
  empresa_id: string | null;
  created_at: string;
  curso_id: string | null;
  ordem: number;
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
  const { empresaId, isSuperAdmin, isPrincipal } = useAuth();
  const { toast } = useToast();
  const [cursos, setCursos] = useState<CursoVideo[]>([]);
  const [videos, setVideos] = useState<VideoTreinamento[]>([]);
  const [visualizacoes, setVisualizacoes] = useState<VideoVisualizacao[]>([]);
  const [cursosAtribuicao, setCursosAtribuicao] = useState<{ curso_id: string; funcionario_id: string }[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Expanded courses
  const [expandedCursos, setExpandedCursos] = useState<Set<string>>(new Set());

  // Course form
  const [openCursoForm, setOpenCursoForm] = useState(false);
  const [editingCurso, setEditingCurso] = useState<CursoVideo | null>(null);
  const [cursoForm, setCursoForm] = useState({ titulo: "", descricao: "", pontuacao_minima: "70" });

  // Module (video) form
  const [openModuloForm, setOpenModuloForm] = useState(false);
  const [editingModulo, setEditingModulo] = useState<VideoTreinamento | null>(null);
  const [moduloCursoId, setModuloCursoId] = useState("");
  const [moduloForm, setModuloForm] = useState({ titulo: "", descricao: "", videoUrl: "" });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Quiz dialog
  const [openQuiz, setOpenQuiz] = useState(false);
  const [quizVideoId, setQuizVideoId] = useState("");
  const [perguntas, setPerguntas] = useState<VideoPergunta[]>([]);
  const [novaPergunta, setNovaPergunta] = useState({ pergunta: "", opcao_a: "", opcao_b: "", opcao_c: "", opcao_d: "", resposta_correta: "a" });

  // Detail dialog
  const [openDetail, setOpenDetail] = useState(false);
  const [detailVideo, setDetailVideo] = useState<VideoTreinamento | null>(null);

  // Employee access management
  const [openAccess, setOpenAccess] = useState(false);
  const [accessFuncId, setAccessFuncId] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessFuncSearch, setAccessFuncSearch] = useState("");
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [showAccessFuncList, setShowAccessFuncList] = useState(false);
  const [selectedCursoIds, setSelectedCursoIds] = useState<string[]>([]);

  // Manage courses for existing employee
  const [openManageCursos, setOpenManageCursos] = useState(false);
  const [manageFuncId, setManageFuncId] = useState("");
  const [manageFuncSearch, setManageFuncSearch] = useState("");
  const [showManageFuncList, setShowManageFuncList] = useState(false);
  const [manageCursoIds, setManageCursoIds] = useState<string[]>([]);
  const [savingManage, setSavingManage] = useState(false);

  const canCreate = isSuperAdmin;
  const canEdit = isSuperAdmin;
  const canDelete = isSuperAdmin;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cursosData }, { data: vids }, { data: vizs }, { data: funcs }, { data: atrib }] = await Promise.all([
        supabase.from("cursos_video").select("*").order("created_at", { ascending: false }),
        supabase.from("videos_treinamento").select("*").order("ordem", { ascending: true }),
        supabase.from("videos_visualizacao").select("*"),
        supabase.from("funcionarios").select("id, nome, cargo, setor").is("data_demissao", null),
        supabase.from("cursos_atribuicao").select("curso_id, funcionario_id"),
      ]);
      if (cursosData) setCursos(cursosData as any);
      if (vids) setVideos(vids as any);
      if (vizs) setVisualizacoes(vizs as any);
      if (funcs) setFuncionarios(funcs as any);
      if (atrib) setCursosAtribuicao(atrib as any);
    } catch {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredCursos = useMemo(() => {
    if (!search.trim()) return cursos;
    const q = search.toLowerCase();
    return cursos.filter(c => c.titulo.toLowerCase().includes(q) || (c.descricao || "").toLowerCase().includes(q));
  }, [cursos, search]);

  const getModulos = (cursoId: string) => videos.filter(v => v.curso_id === cursoId).sort((a, b) => a.ordem - b.ordem);

  const getCursoStats = (cursoId: string) => {
    const modulos = getModulos(cursoId);
    const totalModulos = modulos.length;
    const videoIds = modulos.map(m => m.id);
    const vizs = visualizacoes.filter(v => videoIds.includes(v.video_id));
    const concluidos = vizs.filter(v => v.concluido).length;
    return { totalModulos, totalVisualizacoes: vizs.length, concluidos };
  };

  const toggleExpand = (cursoId: string) => {
    setExpandedCursos(prev => {
      const next = new Set(prev);
      if (next.has(cursoId)) next.delete(cursoId);
      else next.add(cursoId);
      return next;
    });
  };

  // ============ CURSO CRUD ============
  const handleSaveCurso = async () => {
    if (!cursoForm.titulo.trim()) {
      toast({ title: "Informe o título do curso", variant: "destructive" });
      return;
    }
    try {
      if (editingCurso) {
        const { error } = await supabase.from("cursos_video").update({
          titulo: cursoForm.titulo,
          descricao: cursoForm.descricao || null,
          pontuacao_minima: parseInt(cursoForm.pontuacao_minima) || 70,
        }).eq("id", editingCurso.id);
        if (error) throw error;
        toast({ title: "Curso atualizado!" });
      } else {
        const { error } = await supabase.from("cursos_video").insert({
          titulo: cursoForm.titulo,
          descricao: cursoForm.descricao || null,
          pontuacao_minima: parseInt(cursoForm.pontuacao_minima) || 70,
          empresa_id: null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
        if (error) throw error;
        toast({ title: "Curso criado!" });
      }
      setOpenCursoForm(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteCurso = async (id: string) => {
    if (!confirm("Excluir este curso e todos os módulos vinculados?")) return;
    const { error } = await supabase.from("cursos_video").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Curso excluído" }); fetchData(); }
  };

  // ============ MODULE CRUD ============
  const handleSaveModulo = async () => {
    if (!moduloForm.titulo.trim()) {
      toast({ title: "Informe o título do módulo", variant: "destructive" });
      return;
    }
    if (!videoFile && !moduloForm.videoUrl.trim() && !editingModulo) {
      toast({ title: "Selecione um vídeo ou informe uma URL", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      let videoUrl = editingModulo?.video_url || "";
      if (videoFile) {
        const fileExt = videoFile.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("videos-treinamento").upload(fileName, videoFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("videos-treinamento").getPublicUrl(fileName);
        videoUrl = urlData.publicUrl;
      } else if (moduloForm.videoUrl.trim()) {
        videoUrl = moduloForm.videoUrl.trim();
      }

      if (editingModulo) {
        const { error } = await supabase.from("videos_treinamento").update({
          titulo: moduloForm.titulo,
          descricao: moduloForm.descricao || null,
          ...(videoFile ? { video_url: videoUrl } : {}),
        }).eq("id", editingModulo.id);
        if (error) throw error;
        toast({ title: "Módulo atualizado!" });
      } else {
        const nextOrdem = getModulos(moduloCursoId).length + 1;
        const curso = cursos.find(c => c.id === moduloCursoId);
        const { error } = await supabase.from("videos_treinamento").insert({
          titulo: moduloForm.titulo,
          descricao: moduloForm.descricao || null,
          video_url: videoUrl,
          pontuacao_minima: curso?.pontuacao_minima || 70,
          curso_id: moduloCursoId,
          ordem: nextOrdem,
          empresa_id: null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
        if (error) throw error;
        toast({ title: "Módulo adicionado!" });
      }
      setOpenModuloForm(false);
      setVideoFile(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const handleDeleteModulo = async (id: string) => {
    if (!confirm("Excluir este módulo?")) return;
    const { error } = await supabase.from("videos_treinamento").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Módulo excluído" }); fetchData(); }
  };

  // ============ QUIZ ============
  const openQuizManager = async (videoId: string) => {
    setQuizVideoId(videoId);
    const { data } = await supabase.from("videos_perguntas").select("*").eq("video_id", videoId).order("ordem");
    setPerguntas((data || []) as VideoPergunta[]);
    setNovaPergunta({ pergunta: "", opcao_a: "", opcao_b: "", opcao_c: "", opcao_d: "", resposta_correta: "a" });
    setOpenQuiz(true);
  };

  const addPergunta = async () => {
    if (!novaPergunta.pergunta.trim() || !novaPergunta.opcao_a.trim() || !novaPergunta.opcao_b.trim()) {
      toast({ title: "Preencha pergunta e opções A/B", variant: "destructive" });
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
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Pergunta adicionada!" });
    openQuizManager(quizVideoId);
  };

  const deletePergunta = async (id: string) => {
    await supabase.from("videos_perguntas").delete().eq("id", id);
    openQuizManager(quizVideoId);
  };

  // ============ DETAIL ============
  const openVideoDetail = (video: VideoTreinamento) => {
    setDetailVideo(video);
    setOpenDetail(true);
  };

  const detailVisualizacoes = useMemo(() => {
    if (!detailVideo) return [];
    return visualizacoes.filter(v => v.video_id === detailVideo.id);
  }, [detailVideo, visualizacoes]);

  // Only show employees assigned to the course of this video
  const detailFuncionarios = useMemo(() => {
    if (!detailVideo?.curso_id) return [];
    const assignedFuncIds = cursosAtribuicao
      .filter(a => a.curso_id === detailVideo.curso_id)
      .map(a => a.funcionario_id);
    return funcionarios.filter(f => assignedFuncIds.includes(f.id));
  }, [detailVideo, cursosAtribuicao, funcionarios]);

  // ============ EMPLOYEE ACCESS ============
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
    if (selectedCursoIds.length === 0) {
      toast({ title: "Selecione ao menos um curso", variant: "destructive" });
      return;
    }
    if (accessPassword.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setCreatingAccess(true);
    try {
      const func = funcionarios.find(f => f.id === accessFuncId);
      const emailLower = accessEmail.toLowerCase().trim();

      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email: emailLower, password: accessPassword, nome: func?.nome || "" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const userId = data?.user_id;
      if (!userId) throw new Error("Não foi possível vincular o usuário criado");

      // Add to usuarios_liberados
      const { data: existingUL } = await (supabase.from as any)("usuarios_liberados")
        .select("id").eq("email", emailLower).limit(1);

      if (existingUL && existingUL.length > 0) {
        await supabase.from("usuarios_liberados").update({
          nome: func?.nome || "",
          empresa_id: empresaId,
          modulos_permitidos: ["video_treinamentos:view"],
          is_principal: false,
        }).eq("id", existingUL[0].id);
      } else {
        await supabase.from("usuarios_liberados").insert({
          email: emailLower,
          nome: func?.nome || "",
          empresa_id: empresaId,
          modulos_permitidos: ["video_treinamentos:view"],
          is_principal: false,
        });
      }

      // Upsert profile (update won't create if row doesn't exist yet)
      await supabase.from("profiles").upsert({
        user_id: userId, email: emailLower, nome: func?.nome || "", empresa_id: empresaId,
      }, { onConflict: "user_id" });

      // Replace curso assignments
      await supabase.from("cursos_atribuicao").delete().eq("funcionario_id", accessFuncId);
      const assignments = selectedCursoIds.map(cid => ({
        curso_id: cid,
        funcionario_id: accessFuncId,
        empresa_id: empresaId,
      }));
      const { error: assignError } = await supabase.from("cursos_atribuicao").insert(assignments);
      if (assignError) throw new Error("Erro ao salvar cursos: " + assignError.message);

      // Also keep videos_atribuicao in sync for backward compatibility
      await supabase.from("videos_atribuicao").delete().eq("funcionario_id", accessFuncId);
      const videoIds = selectedCursoIds.flatMap(cid => getModulos(cid).map(m => m.id));
      if (videoIds.length > 0) {
        const videoAssignments = videoIds.map(vid => ({
          video_id: vid, funcionario_id: accessFuncId, empresa_id: empresaId,
        }));
        await supabase.from("videos_atribuicao").upsert(videoAssignments, { onConflict: "video_id,funcionario_id" });
      }

      toast({ title: "Acesso criado!", description: `Login: ${accessEmail} / Senha: ${accessPassword}` });
      setOpenAccess(false);
      setAccessFuncId(""); setAccessEmail(""); setAccessPassword(""); setAccessFuncSearch(""); setSelectedCursoIds([]);
    } catch (err: any) {
      toast({ title: "Erro ao criar acesso", description: err.message, variant: "destructive" });
    }
    setCreatingAccess(false);
  };

  // ============ MANAGE COURSES FOR EXISTING EMPLOYEE ============
  const filteredManageFuncionarios = useMemo(() => {
    // Only show employees that already have curso assignments
    const assignedFuncIds = new Set(cursosAtribuicao.map(a => a.funcionario_id));
    const assigned = funcionarios.filter(f => assignedFuncIds.has(f.id));
    if (!manageFuncSearch.trim()) return assigned.sort((a, b) => a.nome.localeCompare(b.nome));
    const q = normalize(manageFuncSearch);
    return assigned.filter(f => normalize(f.nome).includes(q)).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [funcionarios, cursosAtribuicao, manageFuncSearch]);

  const handleOpenManageCursos = () => {
    setManageFuncId(""); setManageFuncSearch(""); setShowManageFuncList(false);
    setManageCursoIds([]); setOpenManageCursos(true);
  };

  const handleSelectManageFunc = (funcId: string) => {
    setManageFuncId(funcId);
    setManageFuncSearch(funcionarios.find(f => f.id === funcId)?.nome || "");
    setShowManageFuncList(false);
    // Pre-select currently assigned courses
    const current = cursosAtribuicao.filter(a => a.funcionario_id === funcId).map(a => a.curso_id);
    setManageCursoIds(current);
  };

  const handleSaveManageCursos = async () => {
    if (!manageFuncId) {
      toast({ title: "Selecione um funcionário", variant: "destructive" });
      return;
    }
    if (manageCursoIds.length === 0) {
      toast({ title: "Selecione ao menos um curso", variant: "destructive" });
      return;
    }
    setSavingManage(true);
    try {
      // Replace curso assignments
      await supabase.from("cursos_atribuicao").delete().eq("funcionario_id", manageFuncId);
      const assignments = manageCursoIds.map(cid => ({
        curso_id: cid,
        funcionario_id: manageFuncId,
        empresa_id: empresaId,
      }));
      const { error } = await supabase.from("cursos_atribuicao").insert(assignments);
      if (error) throw error;

      // Sync videos_atribuicao
      await supabase.from("videos_atribuicao").delete().eq("funcionario_id", manageFuncId);
      const videoIds = manageCursoIds.flatMap(cid => getModulos(cid).map(m => m.id));
      if (videoIds.length > 0) {
        const videoAssignments = videoIds.map(vid => ({
          video_id: vid, funcionario_id: manageFuncId, empresa_id: empresaId,
        }));
        await supabase.from("videos_atribuicao").upsert(videoAssignments, { onConflict: "video_id,funcionario_id" });
      }

      toast({ title: "Cursos atualizados!", description: `${manageCursoIds.length} curso(s) atribuído(s).` });
      setOpenManageCursos(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSavingManage(false);
  };

  // ============ STATS ============
  const stats = useMemo(() => {
    const totalCursos = cursos.length;
    const totalModulos = videos.filter(v => v.curso_id).length;
    const totalFunc = new Set(cursosAtribuicao.map(a => a.funcionario_id)).size;
    const concluidos = visualizacoes.filter(v => v.concluido).length;
    return { totalCursos, totalModulos, totalFunc, concluidos };
  }, [cursos, videos, visualizacoes, cursosAtribuicao]);

  // Per-course consolidated stats
  const cursosConsolidados = useMemo(() => {
    return cursos.map(curso => {
      const modulos = getModulos(curso.id);
      const totalModulos = modulos.length;
      const videoIds = modulos.map(m => m.id);
      const assignedFuncIds = [...new Set(cursosAtribuicao.filter(a => a.curso_id === curso.id).map(a => a.funcionario_id))];
      const totalAtribuidos = assignedFuncIds.length;

      let concluidos = 0;
      let emAndamento = 0;
      let pendentes = 0;

      assignedFuncIds.forEach(funcId => {
        if (totalModulos === 0) { pendentes++; return; }
        const funcVizs = visualizacoes.filter(v => videoIds.includes(v.video_id) && v.funcionario_id === funcId);
        const modulosConcluidos = funcVizs.filter(v => v.concluido).length;
        if (modulosConcluidos >= totalModulos) concluidos++;
        else if (modulosConcluidos > 0 || funcVizs.some(v => v.percentual_assistido > 0)) emAndamento++;
        else pendentes++;
      });

      return { ...curso, totalModulos, totalAtribuidos, concluidos, emAndamento, pendentes };
    }).filter(c => c.totalAtribuidos > 0);
  }, [cursos, videos, visualizacoes, cursosAtribuicao]);

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
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            Treinamentos em Vídeo
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Gerencie cursos com módulos de vídeo</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(isSuperAdmin || isPrincipal) && (
            <Button variant="outline" size="sm" onClick={handleOpenManageCursos} className="text-xs h-8">
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Gerenciar Cursos
            </Button>
          )}
          {(isSuperAdmin || isPrincipal) && (
            <Button variant="outline" size="sm" onClick={() => {
              setAccessFuncId(""); setAccessEmail(""); setAccessPassword(""); setAccessFuncSearch("");
              setShowAccessFuncList(false); setSelectedCursoIds([]); setOpenAccess(true);
            }} className="text-xs h-8">
              <Users className="h-3.5 w-3.5 mr-1.5" /> Criar Acesso
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={() => {
              setEditingCurso(null);
              setCursoForm({ titulo: "", descricao: "", pontuacao_minima: "70" });
              setOpenCursoForm(true);
            }} className="bg-primary hover:bg-primary/90 text-xs h-8">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo Curso
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold text-foreground">{stats.totalCursos}</div>
            <div className="text-xs text-muted-foreground">Cursos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Layers className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold text-foreground">{stats.totalModulos}</div>
            <div className="text-xs text-muted-foreground">Módulos</div>
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
            <CheckCircle className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
            <div className="text-2xl font-bold text-foreground">{stats.concluidos}</div>
            <div className="text-xs text-muted-foreground">Concluídos</div>
          </CardContent>
        </Card>
      </div>

      {/* Painel Consolidado por Curso */}
      {cursosConsolidados.length > 0 && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Painel Consolidado por Curso
            </h3>
            {/* Desktop table */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Curso</TableHead>
                    <TableHead className="text-center">Módulos</TableHead>
                    <TableHead className="text-center">Atribuídos</TableHead>
                    <TableHead className="text-center"><span className="text-emerald-600">Concluídos</span></TableHead>
                    <TableHead className="text-center"><span className="text-amber-600">Em andamento</span></TableHead>
                    <TableHead className="text-center"><span className="text-muted-foreground">Pendentes</span></TableHead>
                    <TableHead className="text-center">Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cursosConsolidados.map(c => {
                    const pct = c.totalAtribuidos > 0 ? Math.round((c.concluidos / c.totalAtribuidos) * 100) : 0;
                    return (
                      <TableRow key={c.id}>
                        <TableCell><span className="font-medium text-sm">{c.titulo}</span></TableCell>
                        <TableCell className="text-center text-sm">{c.totalModulos}</TableCell>
                        <TableCell className="text-center text-sm">{c.totalAtribuidos}</TableCell>
                        <TableCell className="text-center"><Badge className="bg-emerald-100 text-emerald-700 text-xs">{c.concluidos}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">{c.emAndamento}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-xs">{c.pendentes}</Badge></TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground w-8">{pct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {cursosConsolidados.map(c => {
                const pct = c.totalAtribuidos > 0 ? Math.round((c.concluidos / c.totalAtribuidos) * 100) : 0;
                return (
                  <div key={c.id} className="border rounded-lg p-3 bg-background space-y-2">
                    <p className="font-medium text-sm text-foreground">{c.titulo}</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div><span className="text-muted-foreground block">Módulos</span><span className="font-semibold">{c.totalModulos}</span></div>
                      <div><span className="text-muted-foreground block">Atribuídos</span><span className="font-semibold">{c.totalAtribuidos}</span></div>
                      <div><span className="text-emerald-600 block">Concluídos</span><span className="font-semibold text-emerald-700">{c.concluidos}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground w-8">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar curso..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Cursos List */}
      <div className="space-y-4">
        {filteredCursos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum curso cadastrado</p>
              <p className="text-sm">Clique em "Novo Curso" para começar</p>
            </CardContent>
          </Card>
        ) : filteredCursos.map(curso => {
          const modulos = getModulos(curso.id);
          const cursoStats = getCursoStats(curso.id);
          const isExpanded = expandedCursos.has(curso.id);
          return (
            <Card key={curso.id} className="overflow-hidden">
              {/* Course header */}
              <div
                className="p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpand(curso.id)}
              >
                <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                  <div className="bg-primary/10 p-1.5 sm:p-2 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                    <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground text-sm sm:text-lg leading-tight">{curso.titulo}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />}
                      </div>
                    </div>
                    {curso.descricao && <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mt-0.5">{curso.descricao}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">{cursoStats.totalModulos} módulo(s)</Badge>
                      <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">Nota mín: {curso.pontuacao_minima}%</Badge>
                      <div className="flex gap-0.5 ml-auto" onClick={e => e.stopPropagation()}>
                        {canCreate && (
                          <Button variant="ghost" size="icon" title="Adicionar Módulo" className="h-7 w-7" onClick={() => {
                            setEditingModulo(null);
                            setModuloCursoId(curso.id);
                            setModuloForm({ titulo: `Módulo ${modulos.length + 1}`, descricao: "", videoUrl: "" });
                            setVideoFile(null);
                            setOpenModuloForm(true);
                          }}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button variant="ghost" size="icon" title="Editar Curso" className="h-7 w-7" onClick={() => {
                            setEditingCurso(curso);
                            setCursoForm({ titulo: curso.titulo, descricao: curso.descricao || "", pontuacao_minima: String(curso.pontuacao_minima) });
                            setOpenCursoForm(true);
                          }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteCurso(curso.id)} className="text-destructive hover:text-destructive h-7 w-7" title="Excluir Curso">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded modules */}
              {isExpanded && (
                <div className="border-t bg-muted/30">
                  {modulos.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground">
                      <Video className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhum módulo adicionado</p>
                      {canCreate && (
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => {
                          setEditingModulo(null);
                          setModuloCursoId(curso.id);
                          
                          setModuloForm({ titulo: "Módulo 1", descricao: "", videoUrl: "" });
                          setVideoFile(null);
                          setOpenModuloForm(true);
                        }}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar Módulo
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {modulos.map((modulo, idx) => {
                        const vizs = visualizacoes.filter(v => v.video_id === modulo.id);
                        const concluidos = vizs.filter(v => v.concluido).length;
                        return (
                          <div key={modulo.id} className="p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start sm:items-center gap-2 sm:gap-4">
                              <span className="bg-primary/10 text-primary font-bold text-xs sm:text-sm rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                                {String(idx + 1).padStart(2, "0")}
                              </span>

                              <div className="hidden sm:block relative w-24 aspect-video bg-muted rounded overflow-hidden flex-shrink-0">
                                <video src={modulo.video_url} className="w-full h-full object-cover" preload="metadata" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <Play className="h-5 w-5 text-white" />
                                </div>
                              </div>

                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-foreground text-xs sm:text-sm truncate">{modulo.titulo}</h4>
                                {modulo.descricao && <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{modulo.descricao}</p>}
                                <span className="text-[10px] sm:text-xs text-muted-foreground">{concluidos} concluíram</span>
                              </div>

                              <div className="flex gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" onClick={() => openVideoDetail(modulo)} title="Detalhes" className="h-7 w-7 sm:h-8 sm:w-8">
                                  <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                </Button>
                                {canEdit && (
                                  <Button variant="ghost" size="icon" onClick={() => openQuizManager(modulo.id)} title="Quiz" className="h-7 w-7 sm:h-8 sm:w-8">
                                    <Award className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  </Button>
                                )}
                                {canEdit && (
                                  <Button variant="ghost" size="icon" onClick={() => {
                                    setEditingModulo(modulo);
                                    setModuloCursoId(modulo.curso_id || "");
                                    setModuloForm({ titulo: modulo.titulo, descricao: modulo.descricao || "", videoUrl: modulo.video_url || "" });
                                    setVideoFile(null);
                                    setOpenModuloForm(true);
                                  }} title="Editar" className="h-7 w-7 sm:h-8 sm:w-8">
                                    <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteModulo(modulo.id)} className="text-destructive h-7 w-7 sm:h-8 sm:w-8" title="Excluir">
                                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ============ DIALOGS ============ */}

      {/* Curso Form Dialog */}
      <Dialog open={openCursoForm} onOpenChange={setOpenCursoForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCurso ? "Editar Curso" : "Novo Curso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título do Curso *</Label>
              <Input value={cursoForm.titulo} onChange={e => setCursoForm({ ...cursoForm, titulo: e.target.value })} placeholder="Ex: NR-35 Trabalho em Altura" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={cursoForm.descricao} onChange={e => setCursoForm({ ...cursoForm, descricao: e.target.value })} placeholder="Descrição do curso..." rows={3} />
            </div>
            <div>
              <Label>Pontuação Mínima (%)</Label>
              <Input type="number" min={0} max={100} value={cursoForm.pontuacao_minima} onChange={e => setCursoForm({ ...cursoForm, pontuacao_minima: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCursoForm(false)}>Cancelar</Button>
            <Button onClick={handleSaveCurso} className="bg-primary">{editingCurso ? "Salvar" : "Criar Curso"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Module Form Dialog */}
      <Dialog open={openModuloForm} onOpenChange={setOpenModuloForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingModulo ? "Editar Módulo" : "Adicionar Módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título do Módulo *</Label>
              <Input value={moduloForm.titulo} onChange={e => setModuloForm({ ...moduloForm, titulo: e.target.value })} placeholder="Ex: Módulo 01 - Introdução" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={moduloForm.descricao} onChange={e => setModuloForm({ ...moduloForm, descricao: e.target.value })} placeholder="Descrição do módulo..." rows={2} />
            </div>
            <div>
              <Label>URL do Vídeo</Label>
              <Input
                value={moduloForm.videoUrl}
                onChange={e => setModuloForm({ ...moduloForm, videoUrl: e.target.value })}
                placeholder="https://exemplo.com/video.mp4"
              />
              <p className="text-xs text-muted-foreground mt-1">Cole a URL do vídeo ou faça upload abaixo</p>
            </div>
            <div>
              <Label>{editingModulo ? "Substituir vídeo (opcional)" : "Upload de Vídeo"}</Label>
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
            <Button variant="outline" onClick={() => setOpenModuloForm(false)}>Cancelar</Button>
            <Button onClick={handleSaveModulo} disabled={uploading} className="bg-primary">
              {uploading ? "Enviando..." : editingModulo ? "Salvar" : "Adicionar"}
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
              Quiz - {videos.find(v => v.id === quizVideoId)?.titulo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Perguntas ({perguntas.length})</h3>
            {perguntas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pergunta cadastrada.</p>
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
          {canCreate && (
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Nova Pergunta</h3>
              <div>
                <Label className="text-xs">Pergunta *</Label>
                <Input value={novaPergunta.pergunta} onChange={e => setNovaPergunta({ ...novaPergunta, pergunta: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Opção A *</Label><Input value={novaPergunta.opcao_a} onChange={e => setNovaPergunta({ ...novaPergunta, opcao_a: e.target.value })} /></div>
                <div><Label className="text-xs">Opção B *</Label><Input value={novaPergunta.opcao_b} onChange={e => setNovaPergunta({ ...novaPergunta, opcao_b: e.target.value })} /></div>
                <div><Label className="text-xs">Opção C</Label><Input value={novaPergunta.opcao_c} onChange={e => setNovaPergunta({ ...novaPergunta, opcao_c: e.target.value })} /></div>
                <div><Label className="text-xs">Opção D</Label><Input value={novaPergunta.opcao_d} onChange={e => setNovaPergunta({ ...novaPergunta, opcao_d: e.target.value })} /></div>
              </div>
              <div>
                <Label className="text-xs">Resposta Correta</Label>
                <Select value={novaPergunta.resposta_correta} onValueChange={v => setNovaPergunta({ ...novaPergunta, resposta_correta: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">A</SelectItem><SelectItem value="b">B</SelectItem>
                    <SelectItem value="c">C</SelectItem><SelectItem value="d">D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addPergunta} className="w-full bg-primary"><Plus className="h-4 w-4 mr-2" /> Adicionar Pergunta</Button>
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
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <video src={detailVideo.video_url} controls className="w-full h-full" preload="metadata" />
              </div>
              {detailVideo.descricao && <p className="text-sm text-muted-foreground">{detailVideo.descricao}</p>}
              <div>
                <h3 className="font-semibold text-sm mb-2">Acompanhamento de Funcionários</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead className="text-center">% Assistido</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailFuncionarios.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-6">
                            Nenhum funcionário atribuído a este curso
                          </TableCell>
                        </TableRow>
                      ) : detailFuncionarios.map(func => {
                        const viz = detailVisualizacoes.find(v => v.funcionario_id === func.id);
                        return (
                          <TableRow key={func.id}>
                            <TableCell><span className="font-medium text-sm">{func.nome}</span></TableCell>
                            <TableCell className="text-center">
                              {viz ? <span className="text-xs">{viz.percentual_assistido}%</span> : <span className="text-xs text-muted-foreground">--</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {!viz ? <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
                                : viz.concluido ? <Badge className="bg-emerald-100 text-emerald-700 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Concluído</Badge>
                                : <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700"><Play className="h-3 w-3 mr-1" />Em andamento</Badge>}
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

      {/* Create Access Dialog */}
      <Dialog open={openAccess} onOpenChange={setOpenAccess}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Criar Acesso para Funcionário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar funcionário..."
                  value={accessFuncSearch}
                  onChange={e => { setAccessFuncSearch(e.target.value); setAccessFuncId(""); setShowAccessFuncList(true); }}
                  onFocus={() => setShowAccessFuncList(true)}
                  onBlur={() => setTimeout(() => setShowAccessFuncList(false), 200)}
                  className="pl-9"
                />
              </div>
              {accessFuncId && (
                <div className="mt-1 text-xs text-primary font-medium">✓ {funcionarios.find(f => f.id === accessFuncId)?.nome}</div>
              )}
              {!accessFuncId && showAccessFuncList && (
                <div className="border rounded-lg mt-1 max-h-40 overflow-y-auto bg-background">
                  {filteredAccessFuncionarios.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 text-center">Nenhum funcionário encontrado</p>
                  ) : filteredAccessFuncionarios.slice(0, 30).map(f => (
                    <button key={f.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                      onClick={() => {
                        setAccessFuncId(f.id); setAccessFuncSearch(f.nome); setShowAccessFuncList(false);
                        const suggested = f.nome.toLowerCase().replace(/\s+/g, ".").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        setAccessEmail(suggested + "@treinamento.local");
                      }}>
                      <span className="font-medium">{f.nome}</span>
                      <span className="text-xs text-muted-foreground">{f.cargo || ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>E-mail de Login *</Label>
              <Input value={accessEmail} onChange={e => setAccessEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input value={accessPassword} onChange={e => setAccessPassword(e.target.value)} placeholder="Mínimo 6 caracteres" type="text" />
              <p className="text-xs text-muted-foreground mt-1">A senha será exibida ao funcionário para acesso</p>
            </div>
            {/* Curso selection */}
            <div>
              <Label>Cursos *</Label>
              <p className="text-xs text-muted-foreground mb-2">Selecione quais cursos o funcionário deve cursar</p>
              {cursos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhum curso cadastrado</p>
              ) : (
                <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                  {cursos.map(c => (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={selectedCursoIds.includes(c.id)}
                        onCheckedChange={checked => {
                          setSelectedCursoIds(prev => checked ? [...prev, c.id] : prev.filter(id => id !== c.id));
                        }}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">{c.titulo}</span>
                        <span className="text-xs text-muted-foreground ml-2">({getModulos(c.id).length} módulos)</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedCursoIds.length > 0 && (
                <p className="text-xs text-primary mt-1">{selectedCursoIds.length} curso(s) selecionado(s)</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAccess(false)}>Cancelar</Button>
            <Button onClick={handleCreateAccess} disabled={creatingAccess} className="bg-primary">
              {creatingAccess ? "Criando..." : "Criar Acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Courses Dialog */}
      <Dialog open={openManageCursos} onOpenChange={setOpenManageCursos}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Gerenciar Cursos do Funcionário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar funcionário com acesso..."
                  value={manageFuncSearch}
                  onChange={e => { setManageFuncSearch(e.target.value); setManageFuncId(""); setShowManageFuncList(true); }}
                  onFocus={() => setShowManageFuncList(true)}
                  onBlur={() => setTimeout(() => setShowManageFuncList(false), 200)}
                  className="pl-9"
                />
              </div>
              {manageFuncId && (
                <div className="mt-1 text-xs text-primary font-medium">✓ {funcionarios.find(f => f.id === manageFuncId)?.nome}</div>
              )}
              {!manageFuncId && showManageFuncList && (
                <div className="border rounded-lg mt-1 max-h-40 overflow-y-auto bg-background">
                  {filteredManageFuncionarios.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 text-center">Nenhum funcionário com acesso encontrado</p>
                  ) : filteredManageFuncionarios.slice(0, 30).map(f => {
                    const cursoCount = cursosAtribuicao.filter(a => a.funcionario_id === f.id).length;
                    return (
                      <button key={f.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center"
                        onClick={() => handleSelectManageFunc(f.id)}>
                        <span className="font-medium">{f.nome}</span>
                        <span className="text-xs text-muted-foreground">{cursoCount} curso(s)</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {manageFuncId && (
              <div>
                <Label>Cursos *</Label>
                <p className="text-xs text-muted-foreground mb-2">Marque/desmarque os cursos atribuídos</p>
                <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                  {cursos.map(c => (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={manageCursoIds.includes(c.id)}
                        onCheckedChange={checked => {
                          setManageCursoIds(prev => checked ? [...prev, c.id] : prev.filter(id => id !== c.id));
                        }}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">{c.titulo}</span>
                        <span className="text-xs text-muted-foreground ml-2">({getModulos(c.id).length} módulos)</span>
                      </div>
                    </label>
                  ))}
                </div>
                {manageCursoIds.length > 0 && (
                  <p className="text-xs text-primary mt-1">{manageCursoIds.length} curso(s) selecionado(s)</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenManageCursos(false)}>Cancelar</Button>
            <Button onClick={handleSaveManageCursos} disabled={savingManage || !manageFuncId} className="bg-primary">
              {savingManage ? "Salvando..." : "Salvar Cursos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
