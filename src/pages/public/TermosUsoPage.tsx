import PublicLayout from '../../components/public/PublicLayout';
import PublicBreadcrumbs from '../../components/public/PublicBreadcrumbs';
import PublicSeo from '../../components/public/PublicSeo';

const clauses = [
  {
    title: '1. Aceitacao dos termos',
    text: 'Ao acessar este site, voce concorda com estes termos de uso e com a legislacao aplicavel. Caso nao concorde, recomenda-se interromper o uso da plataforma.',
  },
  {
    title: '2. Natureza do servico',
    text: 'A Kifer Saude oferece conteudo informativo e atendimento consultivo para comparacao e orientacao sobre planos de saude. A contratacao final depende de regras e aprovacoes das operadoras parceiras.',
  },
  {
    title: '3. Responsabilidade sobre informacoes fornecidas',
    text: 'O usuario e responsavel por fornecer dados verdadeiros e atualizados durante solicitacoes de contato e cotacao. Informacoes incorretas podem comprometer analise e andamento da proposta.',
  },
  {
    title: '4. Conteudo e propriedade intelectual',
    text: 'Textos, estrutura, identidade visual e materiais publicados no site pertencem a Kifer Saude, salvo quando indicado de forma diversa. Nao e permitido uso indevido sem autorizacao previa.',
  },
  {
    title: '5. Limites de responsabilidade',
    text: 'As informacoes do site possuem carater orientativo e podem ser atualizadas conforme mudancas de mercado. Condicoes comerciais, cobertura e regras contratuais devem ser confirmadas na proposta formal da operadora.',
  },
  {
    title: '6. Links externos',
    text: 'O site pode conter links para plataformas de terceiros. Nao nos responsabilizamos por politicas, conteudo ou praticas de privacidade desses ambientes externos.',
  },
  {
    title: '7. Suspensao de acesso',
    text: 'Reservamo-nos o direito de restringir uso indevido da plataforma, especialmente em situacoes que comprometam seguranca, operacao do site ou direitos de terceiros.',
  },
  {
    title: '8. Atualizacoes destes termos',
    text: 'Estes termos podem ser revisados periodicamente. Recomendamos consulta regular para acompanhar eventuais alteracoes de escopo, processo ou exigencia legal.',
  },
  {
    title: '9. Contato institucional',
    text: 'Para esclarecimentos sobre estes termos, utilize o e-mail contato@kifersaude.com.br com o assunto "Termos de uso".',
  },
];

export default function TermosUsoPage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Termos de uso | Kifer Saude"
        description="Termos de uso do site Kifer Saude para acesso, conteudo e atendimento consultivo sobre planos de saude."
        canonicalPath="/termos-de-uso"
        breadcrumbs={[{ name: 'Termos de uso', path: '/termos-de-uso' }]}
      />
      <PublicBreadcrumbs items={[{ name: 'Termos de uso', path: '/termos-de-uso' }]} />

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Documento legal</p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-slate-900 md:text-5xl">Termos de uso</h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">
            Estes termos estabelecem as condicoes de uso do site da Kifer Saude e orientam a relacao entre usuarios e
            nossa equipe de atendimento consultivo.
          </p>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-5">
          {clauses.map((clause) => (
            <article key={clause.title} className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">{clause.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{clause.text}</p>
            </article>
          ))}
          <p className="text-xs text-slate-500">
            Ultima atualizacao: marco de 2026. A continuidade de uso do site apos revisoes implica ciencia da versao vigente.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
