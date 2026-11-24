import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import PublicSeo from '../../components/public/PublicSeo';
import { siteConfig } from '../../config/site';
import { DisclosureTrigger, Heading, PublicShell, Text, TextLink } from '../../design-system';
import PublicHomeHeader from './components/PublicHomeHeader';
import HomeFooter from './components/home/HomeFooter';

const sectionTitles = {
  responsavel: '1. Quem cuida dos seus dados',
  dados: '2. Quais dados recebemos',
  finalidades: '3. Para que usamos os dados',
  bases: '4. O que permite o tratamento',
  sensiveis: '5. Informações de saúde',
  meta: '6. Formulários do Facebook e Instagram',
  compartilhamento: '7. Com quem os dados podem ser compartilhados',
  seguranca: '8. Armazenamento e proteção',
  retencao: '9. Por quanto tempo os dados ficam guardados',
  direitos: '10. Seus direitos e suas escolhas',
  cookies: '11. Cookies e tecnologias de navegação',
  alteracoes: '12. Atualizações desta política',
  contato: '13. Fale conosco sobre seus dados',
} as const;

type SectionProps = { id: keyof typeof sectionTitles; children: ReactNode };

function Section({ id, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="privacy-section">
      <Heading family="display" level={2} id={`${id}-title`}>{sectionTitles[id]}</Heading>
      <div className="privacy-section-copy">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  const sectionLinks = (
    <ol className="privacy-index-links">
      {Object.entries(sectionTitles).map(([id, title]) => (
        <li key={id}><TextLink href={`#${id}`}>{title}</TextLink></li>
      ))}
    </ol>
  );

  return (
    <>
      <PublicSeo
        title="Política de Privacidade | Kifer Saúde"
        description="Saiba como a Kifer Saúde coleta, utiliza, compartilha e protege seus dados pessoais, em conformidade com a LGPD."
        canonicalPath="/politica-de-privacidade"
        breadcrumbs={[{ name: 'Política de Privacidade', path: '/politica-de-privacidade' }]}
      />
      <PublicShell width="full" className="kifer-landing kifer-privacy">
        <TextLink href="#politica" className="home-skip-link">Pular para a política</TextLink>
        <PublicHomeHeader />
        <main id="politica" tabIndex={-1}>
          <header className="privacy-intro wrap">
            <TextLink href="/" className="privacy-back-link text-link"><ArrowLeft aria-hidden="true" />Voltar ao site</TextLink>
            <Text className="eyebrow">Transparência e cuidado</Text>
            <Heading family="display" level={1} id="politica-titulo">Política de Privacidade</Heading>
            <Text className="lead">Entenda como a Kifer Saúde coleta, utiliza e protege seus dados pessoais.</Text>
            <Text className="privacy-updated">Última atualização: <time dateTime="2026-10-23">23 de outubro de 2026</time>.</Text>
          </header>
          <div className="privacy-layout wrap">
            <nav className="privacy-index privacy-index-desktop" aria-label="Nesta página">
              <Text className="privacy-index-title">Nesta página</Text>
              {sectionLinks}
            </nav>
            <details className="privacy-index privacy-index-mobile">
              <DisclosureTrigger>Nesta página</DisclosureTrigger>
              <nav aria-label="Nesta página">{sectionLinks}</nav>
            </details>
            <article className="privacy-document" aria-labelledby="politica-titulo">
              <Section id="responsavel">
                <Text>A Kifer Saúde atua na intermediação de planos de saúde. Esta política abrange o site, as solicitações de cotação, os formulários de anúncios e o atendimento comercial.</Text>
                <Text><strong>Identificação empresarial:</strong> {siteConfig.legalName}, CNPJ {siteConfig.cnpj}. Contato institucional: <TextLink className="underline underline-offset-4 break-words" href={`mailto:${siteConfig.email}`}>{siteConfig.email}</TextLink> e telefone {siteConfig.telephone}.</Text>
              </Section>
              <Section id="dados">
                <Text><strong>Para cotação:</strong> o formulário da página inicial solicita nome, telefone, cidade, tipo de contratação (pessoa física, MEI ou empresa), quantidade de pessoas e idade do titular ou distribuição por faixas etárias. Os formulários de campanhas podem pedir nome, telefone, e-mail opcional e respostas às perguntas apresentadas em cada etapa.</Text>
                <Text>Alguns formulários podem solicitar a localização do dispositivo mediante permissão do navegador. Essa etapa é opcional e pode ser pulada. Quando autorizada, podem ser registrados latitude, longitude e precisão da localização.</Text>
                <Text><strong>No atendimento e na contratação:</strong> recebemos as informações e mensagens que você fornece para comparar opções e acompanhar propostas. O cadastro contratual contempla CPF, data de nascimento, endereço, dados do titular e dependentes e documentos de contratação. Os documentos necessários variam conforme o produto e devem ser solicitados durante a proposta, sem exigir toda essa documentação na cotação inicial.</Text>
                <Text><strong>Dados técnicos:</strong> formulários podem registrar informações do navegador. O endereço de IP é usado em formato de hash para limitar tentativas abusivas. Há também medição de desempenho do site, conforme a seção sobre tecnologias de navegação.</Text>
                <Text>Ao informar dados de dependentes, forneça somente o necessário e tenha legitimidade para representá-los. Dados de crianças e adolescentes exigem atenção ao seu melhor interesse e à atuação do responsável legal, conforme aplicável.</Text>
              </Section>
              <Section id="finalidades">
                <ul className="list-disc space-y-2 pl-6">
                  <li>Responder à cotação solicitada e entrar em contato para esclarecer o perfil informado.</li>
                  <li>Comparar planos, operadoras, redes e condições de contratação compatíveis com sua necessidade.</li>
                  <li>Elaborar e acompanhar propostas e encaminhar a documentação necessária às operadoras e administradoras envolvidas.</li>
                  <li>Prestar suporte durante a contratação e no relacionamento com o cliente.</li>
                  <li>Atender obrigações legais aplicáveis e proteger os sistemas contra uso abusivo.</li>
                </ul>
                <Text>O contato para atender sua cotação é distinto de campanhas de marketing posteriores. O envio de um formulário não autoriza qualquer comunicação futura. Campanhas precisam de finalidade e fundamento próprios, respeitando suas preferências e pedidos de interrupção.</Text>
                <Text>Quando uma ferramenta de análise está conectada, eventos de interação, como cliques e início de cotação, podem ser utilizados para entender a navegação e medir a efetividade das campanhas, observada a base legal aplicável e suas escolhas de privacidade.</Text>
              </Section>
              <Section id="bases">
                <Text>Para atender à cotação e à proposta que você pede, o tratamento pode se apoiar em procedimentos preliminares à contratação ou na execução do contrato. Registros exigidos por lei dependem da obrigação aplicável.</Text>
                <Text>Quando necessário, o consentimento deve ser específico e informado. Outras hipóteses, como exercício de direitos ou legítimo interesse, exigem avaliação própria de necessidade e impacto. Nenhuma delas autoriza uso indiscriminado.</Text>
              </Section>
              <Section id="sensiveis">
                <Text>A cotação inicial do site não solicita diagnósticos. Se informações de saúde forem necessárias na contratação ou recebidas no atendimento, elas exigem proteção reforçada e fundamento específico do art. 11 da LGPD. A atividade de corretagem não recebe automaticamente a base de tutela da saúde.</Text>
                <Text>Evite enviar informações de saúde que não tenham sido solicitadas para uma finalidade definida. Quando necessárias à proposta, essas informações são destinadas ao atendimento e à análise da contratação pelas entidades envolvidas, conforme os requisitos aplicáveis.</Text>
              </Section>
              <Section id="meta">
                <Text>Você pode solicitar cotação por formulários de anúncios no Facebook ou Instagram. Os dados que você envia podem ser recebidos pela Kifer Saúde para responder à solicitação e acompanhar o atendimento, conforme as finalidades desta política.</Text>
                <Text>O tratamento realizado pela Meta em suas plataformas também segue a <TextLink href="https://www.facebook.com/privacy/policy/" className="underline underline-offset-4">Política de Privacidade da Meta</TextLink>. O envio à Kifer não significa exclusão automática dos dados na plataforma.</Text>
              </Section>
              <Section id="compartilhamento">
                <Text>Durante a proposta, as informações necessárias podem ser encaminhadas às operadoras e administradoras de benefícios envolvidas na opção escolhida. Essas entidades podem tomar decisões próprias sobre seus tratamentos, como controladoras independentes.</Text>
                <Text>Utilizamos sistemas de relacionamento com clientes, infraestrutura de hospedagem e armazenamento e serviços de comunicação para manter cadastros, documentos e o atendimento. Esses serviços incluem Supabase, Vercel e WhatsApp com integração Whapi. Recursos de inteligência artificial podem apoiar o atendimento e a análise de conversas, conforme a funcionalidade utilizada e a finalidade do atendimento.</Text>
                <Text>Fornecedores que tratam dados sob instruções atuam como operadores; aqueles que definem finalidades próprias podem atuar como controladores. Essa classificação depende da atividade e dos contratos. Plataformas de publicidade e análise podem receber dados de interação quando suas integrações estiverem ativas, conforme a finalidade e a base legal aplicáveis.</Text>
              </Section>
              <Section id="seguranca">
                <Text>O acesso aos sistemas internos exige autenticação e conta com controles de acesso aos registros e documentos. Os formulários públicos utilizam validações e mecanismos de proteção contra robôs e tentativas abusivas.</Text>
                <Text>Esses recursos ajudam a proteger os dados contra acessos não autorizados e uso indevido. Nenhum sistema oferece segurança absoluta; as medidas de proteção precisam acompanhar os riscos do tratamento.</Text>
              </Section>
              <Section id="retencao">
                <Text>Conservamos os dados pelo tempo necessário ao atendimento das finalidades informadas e às obrigações legais aplicáveis, inclusive quando a conservação for necessária ao exercício de direitos. Encerrada essa necessidade, os dados são passíveis de eliminação ou anonimização, conforme o caso e as hipóteses legais de conservação.</Text>
              </Section>
              <Section id="direitos">
                <Text>Você pode solicitar confirmação do tratamento, acesso, correção, informações sobre compartilhamento e portabilidade conforme as regras aplicáveis; anonimização, bloqueio ou eliminação quando cabíveis; e informações sobre não consentir e suas consequências. Pode revogar o consentimento e pedir eliminação dos dados tratados nessa base, ressalvadas as hipóteses legais de conservação.</Text>
                <Text>Também pode apresentar oposição a tratamento irregular e solicitar revisão de decisões exclusivamente automatizadas que afetem seus interesses. Use o canal abaixo, sem custo. Para proteger seus dados, podemos pedir confirmação proporcional de identidade e explicar limites legais ao atendimento do pedido. Você também pode recorrer à ANPD.</Text>
              </Section>
              <Section id="cookies">
                <Text>Formulários públicos guardam a preferência de tema no armazenamento local do navegador. O site carrega as fontes Poppins e Sora pelo Google Fonts, o que envolve requisições ao serviço para exibir a tipografia. O acesso interno ao CRM utiliza armazenamento de sessão para autenticação.</Text>
                <Text>Utilizamos Vercel Speed Insights para medir o desempenho do site. As informações enviadas por essa integração usam caminhos de navegação simplificados e não incluem os parâmetros de consulta da URL. Esta página de política não aciona essa medição nem consulta sua sessão nos sistemas internos.</Text>
                <Text>Eventos de navegação podem ser encaminhados a ferramentas de análise quando elas estiverem conectadas. Você pode gerenciar cookies e dados armazenados pelas configurações do navegador. A exclusão desses dados pode remover preferências salvas e exigir novo acesso às áreas restritas.</Text>
              </Section>
              <Section id="alteracoes">
                <Text>Esta política pode ser atualizada para refletir mudanças nas operações e nas regras aplicáveis. A versão vigente estará sempre disponível nesta página, com a data da última atualização.</Text>
              </Section>
              <Section id="contato">
                <Text>Para dúvidas ou pedidos sobre seus dados, escreva para <TextLink href={`mailto:${siteConfig.email}`} className="break-words underline underline-offset-4">{siteConfig.email}</TextLink> ou entre em contato pelo <TextLink href={siteConfig.whatsappUrl} className="underline underline-offset-4">WhatsApp institucional {siteConfig.telephone}</TextLink>. Informe que o assunto é privacidade e descreva o pedido, evitando enviar documentos sensíveis no primeiro contato.</Text>
                <Text className="text-sm">Referências: <TextLink className="underline underline-offset-4" href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm">Lei Geral de Proteção de Dados Pessoais</TextLink> e <TextLink className="underline underline-offset-4" href="https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais">orientações da ANPD sobre cookies</TextLink>.</Text>
              </Section>
            </article>
          </div>
        </main>
        <HomeFooter />
      </PublicShell>
    </>
  );
}
