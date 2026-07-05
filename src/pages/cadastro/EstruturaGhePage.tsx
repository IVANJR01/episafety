import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import EstruturaGheDialog from "@/components/cadastro/EstruturaGheDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function EstruturaGhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ghe, setGhe] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data, error } = await supabase.from("ghe_ges").select("*").eq("id", id).maybeSingle();
      setLoading(false);
      if (error) return toast.error(error.message);
      if (!data) return toast.error("GES não encontrado");
      setGhe(data);
    })();
  }, [id]);

  const voltar = () => navigate("/cadastro/ghe");

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Carregando…</div>;
  if (!ghe) return (
    <div className="p-4 space-y-3">
      <p className="text-sm">GES não encontrado.</p>
      <Button variant="outline" onClick={voltar}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
    </div>
  );

  return (
    <div className="space-y-3 w-full max-w-full overflow-x-hidden">
      <Button variant="ghost" size="sm" onClick={voltar} className="mb-1">
        <ArrowLeft className="h-4 w-4 mr-1" />Voltar para lista de GES
      </Button>
      <EstruturaGheDialog ghe={ghe} onClose={voltar} mode="page" />
    </div>
  );
}
