import type { ReactNode } from 'react';
import PublicBrandMark from '../../components/public/PublicBrandMark';
import PublicSeo from '../../components/public/PublicSeo';
import { siteConfig } from '../../config/site';
import { PublicShell } from '../../design-system';
import PublicFooter from './components/PublicFooter';

type SectionProps = { id: string; title: string; children: ReactNode };

function Section({ id, title, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8 border-t border-[color:var(--border-subtle)] py-8 sm:py-10">
      <h2 id={`${id}-title`} className="mb-5 text-2xl font-semibold [font-family:var(--font-display)] sm:text-3xl">{title}</h2>
      <div className="space-y-4 text-base leading-7 text-[color:var(--text-secondary)]">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <PublicSeo
        title="Política de Privacidade | Kifer Saúde"
        description="Saiba como a Kifer Saúde coleta, utiliza, compartilha e protege seus dados pessoais, em conformidade com a LGPD."
        canonicalPath="/politica-de-privacidade"
        breadcrumbs={[{ name: 'Política de Privacidade', path: '/politica-de-privacidade' }]}
      />
      <PublicShell width="full" className="min-h-screen">
        <a href="#politica" className="sr-only focus:not-sr-only focus:block focus:p-4">Pular para a política</a>
        <header className="border-b border-[color:var(--border-subtle)] bg-[var(--bg-surface)]">
          <nav aria-label="Navegação principal" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
            <a href="/" className="flex items-center gap-3 font-semibold" aria-label="Kifer Saúde — início">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-primary)]">
                <PublicBrandMark className="h-6 w-auto text-[color:var(--text-on-brand)]" />
              </span>
              <span className="text-xl">Kifer Saúde</span>
            </a>
            <a href="/" className="text-sm font-semibold underline underline-offset-4">Voltar ao site</a>
          </nav>
        </header>
        <main id="politica" className="mx-auto max-w-3xl px-4 pb-12 pt-12 sm:px-6 sm:pt-20">
          <div className="pb-10 sm:pb-14">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[color:var(--brand-primary)]">Transparência e cuidado</p>
            <h1 className="text-4xl leading-tight [font-family:var(--font-display)] sm:text-5xl">Política de Privacidade</h1>
            <p className="mt-6 text-lg leading-8 text-[color:var(--text-secondary)]">Entenda como a Kifer Saúde coleta, utiliza e protege seus dados pessoais.</p>
            <p className="mt-5 text-sm text-[color:var(--text-secondary)]">Última atualização: <time dateTime="2026-10-23">23 de outubro de 2026</time>.</p>
          </div>

          <Section id="responsavel" title="1. Quem cuida dos seus dados">
            <p>A Kifer Saúde atua na intermediação de planos de saúde. Esta política abrange o site, as solicitações de cotação, os formulários de anúncios e o atendimento comercial.</p>
            <p><strong>Identificação empresarial:</strong> {siteConfig.legalName}, CNPJ {siteConfig.cnpj}. Contato institucional: <a className="underline underline-offset-4 break-words" href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> e telefone {siteConfig.telephone}.</p>
          </Section>
          <Section id="dados" title="2. Quais dados recebemos">
            <p><strong>Para cotação:</strong> o formulário da página inicial solicita nome, telefone, cidade, tipo de contratação (pessoa física, MEI ou empresa), quantidade de pessoas e idade do titular ou distribuição por faixas etárias. Os formulários de campanhas podem pedir nome, telefone, e-mail opcional e respostas às perguntas apresentadas em cada etapa.</p>
            <p>Alguns formulários podem solicitar a localização do dispositivo mediante permissão do navegador. Essa etapa é opcional e pode ser pulada. Quando autorizada, podem ser registrados latitude, longitude e precisão da localização.</p>
            <p><strong>No atendimento e na contratação:</strong> recebemos as informações e mensagens que você fornece para comparar opções e acompanhar propostas. O cadastro contratual contempla CPF, data de nascimento, endereço, dados do titular e dependentes e documentos de contratação. Os documentos necessários variam conforme o produto e devem ser solicitados durante a proposta, sem exigir toda essa documentação na cotação inicial.</p>
            <p><strong>Dados técnicos:</strong> formulários podem registrar informações do navegador. O endereço de IP é usado em formato de hash para limitar tentativas abusivas. Há também medição de desempenho do site, conforme a seção sobre tecnologias de navegação.</p>
            <p>Ao informar dados de dependentes, forneça somente o necessário e tenha legitimidade para representá-los. Dados de crianças e adolescentes exigem atenção ao seu melhor interesse e à atuação do responsável legal, conforme aplicável.</p>
          </Section>
          <Section id="finalidades" title="3. Para que usamos os dados">
            <ul className="list-disc space-y-2 pl-6">
              <li>Responder à cotação solicitada e entrar em contato para esclarecer o perfil informado.</li>
              <li>Comparar planos, operadoras, redes e condições de contratação compatíveis com sua necessidade.</li>
              <li>Elaborar e acompanhar propostas e encaminhar a documentação necessária às operadoras e administradoras envolvidas.</li>
              <li>Prestar suporte durante a contratação e no relacionamento com o cliente.</li>
              <li>Atender obrigações legais aplicáveis e proteger os sistemas contra uso abusivo.</li>
            </ul>
            <p>O contato para atender sua cotação é distinto de campanhas de marketing posteriores. O envio de um formulário não autoriza qualquer comunicação futura. Campanhas precisam de finalidade e fundamento próprios, respeitando suas preferências e pedidos de interrupção.</p>
            <p>Quando uma ferramenta de análise está conectada, eventos de interação, como cliques e início de cotação, podem ser utilizados para entender a navegação e medir a efetividade das campanhas, observada a base legal aplicável e suas escolhas de privacidade.</p>
          </Section>
          <Section id="bases" title="4. O que permite o tratamento">
            <p>Para atender à cotação e à proposta que você pede, o tratamento pode se apoiar em procedimentos preliminares à contratação ou na execução do contrato. Registros exigidos por lei dependem da obrigação aplicável.</p>
            <p>Quando necessário, o consentimento deve ser específico e informado. Outras hipóteses, como exercício de direitos ou legítimo interesse, exigem avaliação própria de necessidade e impacto. Nenhuma delas autoriza uso indiscriminado.</p>
          </Section>
          <Section id="sensiveis" title="5. Informações de saúde">
            <p>A cotação inicial do site não solicita diagnósticos. Se informações de saúde forem necessárias na contratação ou recebidas no atendimento, elas exigem proteção reforçada e fundamento específico do art. 11 da LGPD. A atividade de corretagem não recebe automaticamente a base de tutela da saúde.</p>
            <p>Evite enviar informações de saúde que não tenham sido solicitadas para uma finalidade definida. Quando necessárias à proposta, essas informações são destinadas ao atendimento e à análise da contratação pelas entidades envolvidas, conforme os requisitos aplicáveis.</p>
          </Section>
          <Section id="meta" title="6. Formulários do Facebook e Instagram">
            <p>Você pode solicitar cotação por formulários de anúncios no Facebook ou Instagram. Os dados que você envia podem ser recebidos pela Kifer Saúde para responder à solicitação e acompanhar o atendimento, conforme as finalidades desta política.</p>
            <p>O tratamento realizado pela Meta em suas plataformas também segue a <a href="https://www.facebook.com/privacy/policy/" className="underline underline-offset-4">Política de Privacidade da Meta</a>. O envio à Kifer não significa exclusão automática dos dados na plataforma.</p>
          </Section>
          <Section id="compartilhamento" title="7. Com quem os dados podem ser compartilhados">
            <p>Durante a proposta, as informações necessárias podem ser encaminhadas às operadoras e administradoras de benefícios envolvidas na opção escolhida. Essas entidades podem tomar decisões próprias sobre seus tratamentos, como controladoras independentes.</p>
            <p>Utilizamos sistemas de relacionamento com clientes, infraestrutura de hospedagem e armazenamento e serviços de comunicação para manter cadastros, documentos e o atendimento. Esses serviços incluem Supabase, Vercel e WhatsApp com integração Whapi. Recursos de inteligência artificial podem apoiar o atendimento e a análise de conversas, conforme a funcionalidade utilizada e a finalidade do atendimento.</p>
            <p>Fornecedores que tratam dados sob instruções atuam como operadores; aqueles que definem finalidades próprias podem atuar como controladores. Essa classificação depende da atividade e dos contratos. Plataformas de publicidade e análise podem receber dados de interação quando suas integrações estiverem ativas, conforme a finalidade e a base legal aplicáveis.</p>
          </Section>
          <Section id="seguranca" title="8. Armazenamento e proteção">
            <p>O acesso aos sistemas internos exige autenticação e conta com controles de acesso aos registros e documentos. Os formulários públicos utilizam validações e mecanismos de proteção contra robôs e tentativas abusivas.</p>
            <p>Esses recursos ajudam a proteger os dados contra acessos não autorizados e uso indevido. Nenhum sistema oferece segurança absoluta; as medidas de proteção precisam acompanhar os riscos do tratamento.</p>
          </Section>
          <Section id="retencao" title="9. Por quanto tempo os dados ficam guardados">
            <p>Conservamos os dados pelo tempo necessário ao atendimento das finalidades informadas e às obrigações legais aplicáveis, inclusive quando a conservação for necessária ao exercício de direitos. Encerrada essa necessidade, os dados são passíveis de eliminação ou anonimização, conforme o caso e as hipóteses legais de conservação.</p>
          </Section>
          <Section id="direitos" title="10. Seus direitos e suas escolhas">
            <p>Você pode solicitar confirmação do tratamento, acesso, correção, informações sobre compartilhamento e portabilidade conforme as regras aplicáveis; anonimização, bloqueio ou eliminação quando cabíveis; e informações sobre não consentir e suas consequências. Pode revogar o consentimento e pedir eliminação dos dados tratados nessa base, ressalvadas as hipóteses legais de conservação.</p>
            <p>Também pode apresentar oposição a tratamento irregular e solicitar revisão de decisões exclusivamente automatizadas que afetem seus interesses. Use o canal abaixo, sem custo. Para proteger seus dados, podemos pedir confirmação proporcional de identidade e explicar limites legais ao atendimento do pedido. Você também pode recorrer à ANPD.</p>
          </Section>
          <Section id="cookies" title="11. Cookies e tecnologias de navegação">
            <p>Formulários públicos guardam a preferência de tema no armazenamento local do navegador. O site carrega as fontes Inter e Playfair Display pelo Google Fonts, o que envolve requisições ao serviço para exibir a tipografia. O acesso interno ao CRM utiliza armazenamento de sessão para autenticação.</p>
            <p>Utilizamos Vercel Speed Insights para medir o desempenho do site. As informações enviadas por essa integração usam caminhos de navegação simplificados e não incluem os parâmetros de consulta da URL. Esta página de política não aciona essa medição nem consulta sua sessão nos sistemas internos.</p>
            <p>Eventos de navegação podem ser encaminhados a ferramentas de análise quando elas estiverem conectadas. Você pode gerenciar cookies e dados armazenados pelas configurações do navegador. A exclusão desses dados pode remover preferências salvas e exigir novo acesso às áreas restritas.</p>
          </Section>
          <Section id="alteracoes" title="12. Atualizações desta política">
            <p>Esta política pode ser atualizada para refletir mudanças nas operações e nas regras aplicáveis. A versão vigente estará sempre disponível nesta página, com a data da última atualização.</p>
          </Section>
          <Section id="contato" title="13. Fale conosco sobre seus dados">
            <p>Para dúvidas ou pedidos sobre seus dados, escreva para <a href={`mailto:${siteConfig.email}`} className="break-words underline underline-offset-4">{siteConfig.email}</a> ou entre em contato pelo <a href={siteConfig.whatsappUrl} className="underline underline-offset-4">WhatsApp institucional {siteConfig.telephone}</a>. Informe que o assunto é privacidade e descreva o pedido, evitando enviar documentos sensíveis no primeiro contato.</p>
            <p className="text-sm">Referências: <a className="underline underline-offset-4" href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm">Lei Geral de Proteção de Dados Pessoais</a> e <a className="underline underline-offset-4" href="https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais">orientações da ANPD sobre cookies</a>.</p>
          </Section>
        </main>
        <PublicFooter />
      </PublicShell>
    </>
  );
}
