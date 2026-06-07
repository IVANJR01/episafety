import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Server, Layers, Clock, Shield, ExternalLink } from "lucide-react";

const sections = [
  {
    icon: Database,
    title: "Banco de Dados",
    desc: "Tabelas, RLS, funções e migrações são gerenciadas pelo Lovable Cloud.",
  },
  {
    icon: Server,
    title: "Edge Functions",
    desc: "Funções serverless deployadas automaticamente (gdrive-proxy, nr-chatbot, scheduled-backup, etc.).",
  },
  {
    icon: Layers,
    title: "Storage",
    desc: "8 buckets ativos: logos, inspecoes, conformidades, fotos-reconhecimento, videos-treinamento, documentos-treinamento, empresa-assets, backups.",
  },
  {
    icon: Clock,
    title: "Cron / Backups",
    desc: "Backup semanal aos domingos às 03:00 (JSON + SQL) salvos no Google Drive da matriz.",
  },
  {
    icon: Shield,
    title: "Segredos",
    desc: "Chaves OAuth, Service Account, Gemini e Service Role gerenciadas com segurança.",
  },
];

export default function AdminCloud() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Infraestrutura Cloud</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral dos componentes de backend usados pelo SafetySoluções.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <s.icon className="w-4 h-4 text-primary" />
                {s.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 text-sm">
          <p className="font-semibold mb-1">⚠ Operações destrutivas</p>
          <p className="text-muted-foreground">
            Alterações de schema, políticas RLS e backups são feitas via console do Lovable Cloud.
            Esta tela é apenas informativa para evitar que ações administrativas sejam executadas no
            mesmo fluxo dos usuários operacionais.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
