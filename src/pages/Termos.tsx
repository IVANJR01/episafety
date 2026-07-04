import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { TERMS_VERSION, TERMS_UPDATED_AT, COMPANY_LEGAL } from "@/lib/termsConfig";

export default function Termos() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link to="/login" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <FileText className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Termos de Uso</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Termos de Uso — SafetySoluções</h1>
          <p className="text-sm text-muted-foreground">
            Versão {TERMS_VERSION} — Última atualização: {TERMS_UPDATED_AT}
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Aceitação e uso da plataforma</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ao criar uma conta ou utilizar o <strong className="text-foreground">SafetySoluções</strong>,
            você declara que leu, compreendeu e concorda com estes Termos de Uso e com a Política de Privacidade.
            O sistema destina-se à gestão de EPIs, inspeções, exames ocupacionais, capacitações e
            documentação de segurança do trabalho.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Responsabilidades do usuário</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
            <li>Manter suas credenciais de acesso em sigilo.</li>
            <li>Fornecer informações verdadeiras, completas e atualizadas.</li>
            <li>Utilizar o sistema apenas para finalidades lícitas e vinculadas à segurança do trabalho.</li>
            <li>Não tentar acessar dados de outras empresas, contornar RLS ou explorar vulnerabilidades.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Responsabilidades da empresa contratante</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
            <li>Definir usuários autorizados e revogar acessos de colaboradores desligados.</li>
            <li>Validar a exatidão dos dados cadastrais, riscos, exames e prazos.</li>
            <li>Responder pelas decisões técnicas de SST tomadas com base nas informações do sistema.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Limitações do sistema</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O SafetySoluções é uma ferramenta de gestão e apoio, não substituindo a atuação de profissionais
            legalmente habilitados em Segurança e Medicina do Trabalho. As sugestões geradas por IA (auditoria
            documental, referência normativa) têm caráter informativo e devem ser validadas por profissional responsável.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Segurança das informações</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Adotamos controle multiempresa (empresa_id + RLS), autenticação segura e armazenamento
            isolado por cliente. Ainda assim, nenhuma plataforma é 100% imune a incidentes — o usuário
            deve manter senha forte, ativar autenticação em dois fatores quando disponível e não compartilhar acesso.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Uso correto dos dados</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Os dados inseridos pertencem à empresa contratante e são tratados conforme a Política de Privacidade
            e a LGPD (Lei 13.709/2018). Não vendemos, alugamos ou compartilhamos dados com terceiros para
            finalidades comerciais externas à operação do serviço.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Cancelamento e encerramento</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O cliente pode solicitar o encerramento a qualquer momento. Após o encerramento, os dados
            ficam disponíveis para exportação por 30 dias e depois são removidos ou anonimizados,
            respeitadas obrigações legais de retenção.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Suporte</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Suporte oficial é prestado pelos canais divulgados no menu "Suporte" dentro do sistema.
            Não solicite alterações críticas por canais não oficiais.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">9. Atualizações destes Termos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estes Termos podem ser atualizados. Novas versões serão comunicadas dentro do próprio sistema
            e o usuário poderá ser convidado a aceitar novamente para continuar utilizando os serviços.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">10. Foro e legislação</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Aplica-se a legislação brasileira. Fica eleito o foro do domicílio da empresa contratante,
            salvo disposição contratual em contrário.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-border">
          <h2 className="text-sm font-semibold">Fornecedor</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {COMPANY_LEGAL.razaoSocial} — {COMPANY_LEGAL.cnpj}
            <br />
            {COMPANY_LEGAL.endereco}
            <br />
            Contato: {COMPANY_LEGAL.email}
          </p>
          <p className="text-xs text-muted-foreground pt-2">
            <Link to="/privacidade" className="text-primary hover:underline">
              Ver Política de Privacidade
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
