import { ArrowLeft, Shield, FileText } from "lucide-react";
import { Link } from "react-router-dom";

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link to="/login" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Política de Privacidade</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Política de Privacidade — SafetySoluções</h1>
          <p className="text-sm text-muted-foreground">Última atualização: 09 de março de 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Introdução</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O <strong className="text-foreground">SafetySoluções</strong> é um sistema de gestão de Equipamentos de Proteção Individual (EPIs) e segurança do trabalho.
            Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais ao utilizar nosso aplicativo.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Dados Coletados</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Coletamos os seguintes dados para o funcionamento do sistema:</p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li><strong className="text-foreground">Dados de conta:</strong> nome, e-mail e senha (criptografada)</li>
            <li><strong className="text-foreground">Dados de empresa:</strong> nome, CNPJ, endereço, telefone e e-mail da empresa</li>
            <li><strong className="text-foreground">Dados de funcionários:</strong> nome, CPF, cargo, setor, matrícula e data de admissão</li>
            <li><strong className="text-foreground">Registros de EPIs:</strong> entregas, devoluções, trocas e fichas de entrega com assinatura digital</li>
            <li><strong className="text-foreground">Registros de saúde ocupacional:</strong> exames médicos e treinamentos</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Finalidade do Uso</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Utilizamos seus dados exclusivamente para:</p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Gerenciar o controle de EPIs e segurança do trabalho</li>
            <li>Gerar fichas de entrega e relatórios obrigatórios</li>
            <li>Controlar exames médicos ocupacionais (PCMSO)</li>
            <li>Registrar treinamentos de segurança</li>
            <li>Garantir conformidade com as Normas Regulamentadoras (NRs)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Armazenamento e Segurança</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Seus dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso.
            O acesso aos dados é restrito por meio de autenticação e políticas de controle de acesso baseadas em funções (RBAC).
            Somente usuários autorizados pela empresa podem acessar os dados do sistema.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Compartilhamento de Dados</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Não vendemos, alugamos ou compartilhamos</strong> seus dados pessoais com terceiros para fins comerciais.
            Dados podem ser compartilhados apenas:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Com provedores de infraestrutura necessários para o funcionamento do sistema</li>
            <li>Quando exigido por lei ou por autoridades competentes</li>
            <li>Com a empresa empregadora do funcionário, conforme cadastro no sistema</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Direitos do Usuário (LGPD)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Acessar seus dados pessoais armazenados</li>
            <li>Solicitar correção de dados incompletos ou desatualizados</li>
            <li>Solicitar a exclusão dos seus dados pessoais</li>
            <li>Revogar o consentimento de uso dos dados</li>
            <li>Solicitar a portabilidade dos dados</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Cookies e Dados Locais</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O SafetySoluções utiliza armazenamento local (localStorage) para permitir o funcionamento offline do aplicativo.
            Esses dados são armazenados exclusivamente no seu dispositivo e sincronizados com o servidor quando a conexão é restabelecida.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Alterações nesta Política</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Podemos atualizar esta Política de Privacidade periodicamente. Quaisquer alterações significativas serão comunicadas
            por meio do aplicativo. Recomendamos a revisão periódica desta página.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">9. Contato</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Para dúvidas, solicitações ou exercício dos seus direitos sobre privacidade, entre em contato pelo e-mail:
          </p>
          <p className="text-sm font-medium text-primary">contato@safetysolucoes.com.br</p>
        </section>

        <div className="border-t border-border pt-6 flex flex-col items-center gap-3">
          <Link to="/termos" className="text-sm text-primary hover:underline inline-flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Ver Termos de Uso
          </Link>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-primary hover:underline inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
