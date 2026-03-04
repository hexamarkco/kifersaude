import PublicLayout from '../../components/public/PublicLayout';
import PublicBreadcrumbs from '../../components/public/PublicBreadcrumbs';
import PublicSeo from '../../components/public/PublicSeo';

const sections = [
  {
    title: '1. Escopo desta politica',
    content:
      'Esta politica descreve como a Kifer Saude coleta, utiliza e protege informacoes fornecidas por visitantes e clientes no site. O objetivo e garantir transparencia sobre tratamento de dados em todas as etapas de contato e atendimento.',
  },
  {
    title: '2. Dados que podemos coletar',
    content:
      'Podemos coletar dados informados diretamente por voce, como nome, telefone, e-mail, cidade e informacoes basicas para triagem de cotacao. Tambem podem ser coletados dados tecnicos de navegacao para melhorar desempenho e seguranca do site.',
  },
  {
    title: '3. Finalidade do tratamento',
    content:
      'Os dados sao utilizados para responder contato, elaborar comparativos de plano, conduzir proposta, apoiar o pos-venda e melhorar a experiencia de atendimento. Nao utilizamos dados para finalidades incompatíveis com a natureza da relacao comercial.',
  },
  {
    title: '4. Compartilhamento de dados',
    content:
      'Dados podem ser compartilhados com operadoras parceiras e fornecedores estritamente necessarios para viabilizar o atendimento solicitado. Sempre buscamos limitar o compartilhamento ao minimo indispensavel para cada finalidade.',
  },
  {
    title: '5. Seguranca e armazenamento',
    content:
      'Adotamos medidas tecnicas e organizacionais para proteger dados contra acesso nao autorizado, alteracao indevida e perda acidental. O periodo de armazenamento considera obrigacoes legais, regulatórias e necessidades operacionais legitimas.',
  },
  {
    title: '6. Direitos do titular',
    content:
      'Voce pode solicitar confirmacao de tratamento, acesso, correcao, atualizacao e demais direitos previstos na legislacao aplicavel. Sempre que possivel, responderemos de forma objetiva e dentro de prazo razoavel.',
  },
  {
    title: '7. Cookies e tecnologias similares',
    content:
      'O site pode utilizar cookies para funcionamento tecnico, analise de desempenho e melhoria de experiencia. Voce pode gerenciar preferencias no navegador, considerando que algumas funcionalidades podem ser impactadas.',
  },
  {
    title: '8. Contato sobre privacidade',
    content:
      'Para duvidas ou solicitacoes relacionadas a privacidade e tratamento de dados, entre em contato pelo e-mail contato@kifersaude.com.br com o assunto "Privacidade".',
  },
];

export default function PoliticaPrivacidadePage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Politica de privacidade | Kifer Saude"
        description="Politica de privacidade da Kifer Saude sobre coleta, uso e protecao de dados em atendimentos e solicitacoes de cotacao."
        canonicalPath="/politica-de-privacidade"
        breadcrumbs={[{ name: 'Politica de privacidade', path: '/politica-de-privacidade' }]}
      />
      <PublicBreadcrumbs items={[{ name: 'Politica de privacidade', path: '/politica-de-privacidade' }]} />

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Documento legal</p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-slate-900 md:text-5xl">Politica de privacidade</h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">
            A transparencia no tratamento de dados faz parte do nosso compromisso com atendimento responsavel. Leia abaixo
            como lidamos com informacoes pessoais no contexto dos nossos servicos.
          </p>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-5">
          {sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">{section.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{section.content}</p>
            </article>
          ))}
          <p className="text-xs text-slate-500">
            Ultima atualizacao: marco de 2026. Este documento pode ser revisado para refletir atualizacoes regulatórias e
            melhorias de processo.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
