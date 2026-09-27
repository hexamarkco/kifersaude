import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  HeartHandshake,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';

import PublicBrandMark from '../../components/public/PublicBrandMark';
import PublicSeo, { type PublicFaqItem } from '../../components/public/PublicSeo';
import { Button, LinkButton, PublicShell } from '../../design-system';
import { absoluteUrl, siteConfig } from '../../config/site';
import { trackPublicConversion } from '../public-content';
import { getOperatorQuotePath } from './data/operatorLandingRepository';
import type { OperatorAccentTone, OperatorLandingContent } from './domain/types';

type OperatorLandingScreenProps = {
  page: OperatorLandingContent | null;
};

const accentClassByTone: Record<OperatorAccentTone, string> = {
  terracotta: 'operator-landing-accent-terracotta',
  gold: 'operator-landing-accent-gold',
  copper: 'operator-landing-accent-copper',
  success: 'operator-landing-accent-success',
  info: 'operator-landing-accent-info',
};

const operatorWhatsappUrl = (page: OperatorLandingContent) => {
  const message = `Olá! Quero conhecer as opções de ${page.name} com a Kifer Saúde.`;
  return `${siteConfig.whatsappUrl}?text=${encodeURIComponent(message)}`;
};

function OperatorLogo({ page }: { page: OperatorLandingContent }) {
  if (page.logoPath) {
    return (
      <img
        src={page.logoPath}
        alt={page.logoAlt}
        width="240"
        height="96"
        loading="eager"
        decoding="async"
        className="max-h-16 w-auto max-w-[13rem] object-contain"
      />
    );
  }

  return (
    <span className="font-[var(--font-display)] text-2xl font-semibold leading-tight text-[color:var(--operator-accent-ink)]">
      {page.name}
    </span>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--operator-accent)]">{eyebrow}</p>
      <h2 className="mt-4 font-[var(--font-display)] text-4xl font-semibold leading-tight text-[color:var(--text-primary)] md:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-lg leading-relaxed text-[color:var(--text-secondary)]">{description}</p>
    </div>
  );
}

function OperatorLandingNotFound() {
  return (
    <>
      <PublicSeo
        title="Plano de saúde"
        description="A página de operadora não foi encontrada. Conheça a Kifer Saúde e peça uma cotação consultiva."
        canonicalPath="/planos"
        indexable={false}
      />
      <PublicShell width="full" className="min-h-screen">
        <main className="flex min-h-screen items-center justify-center px-6 py-20">
          <div className="max-w-xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--brand-primary)]">Página não encontrada</p>
            <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold text-[color:var(--text-primary)]">Vamos encontrar o plano certo para você.</h1>
            <p className="mt-5 text-lg leading-relaxed text-[color:var(--text-secondary)]">A operadora informada não está disponível nesta arquitetura. A Kifer pode ajudar a comparar as opções atuais.</p>
            <LinkButton href="/#cotacao" size="lg" className="mt-8">
              Pedir uma cotação
              <ArrowRight className="kds-control-icon" aria-hidden="true" />
            </LinkButton>
          </div>
        </main>
      </PublicShell>
    </>
  );
}

export default function OperatorLandingScreen({ page }: OperatorLandingScreenProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (!page) {
    return <OperatorLandingNotFound />;
  }

  const quotePath = getOperatorQuotePath(page.slug);
  const whatsappUrl = operatorWhatsappUrl(page);
  const faqItems: PublicFaqItem[] = page.faqs.map((faq) => ({ question: faq.question, answer: faq.answer }));
  const canonicalPath = page.path;

  const trackCta = (position: 'hero' | 'midpage' | 'final' | 'whatsapp') => {
    trackPublicConversion('operator_landing_cta_click', {
      operator_slug: page.slug,
      operator_name: page.name,
      cta_position: position,
      destination: position === 'whatsapp' ? 'whatsapp' : 'quote_flow',
    });
  };

  const serviceStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${absoluteUrl(canonicalPath)}#service`,
    name: `Cotação ${page.name}`,
    serviceType: 'Corretagem de planos de saúde',
    provider: { '@id': `${siteConfig.url}/#organization` },
    areaServed: { '@type': 'State', name: siteConfig.areaServed },
    url: absoluteUrl(canonicalPath),
  };

  return (
    <>
      <PublicSeo
        title={page.seo.title}
        description={page.seo.description}
        canonicalPath={canonicalPath}
        imagePath={page.logoPath ?? siteConfig.defaultOgImage}
        imageAlt={`${page.name} apresentado pela Kifer Saúde`}
        faqItems={faqItems}
        breadcrumbs={[{ name: 'Planos', path: '/planos' }, { name: page.name, path: canonicalPath }]}
        extraStructuredData={[serviceStructuredData]}
      />

      <PublicShell width="full" className={`operator-landing ${accentClassByTone[page.accentTone]}`}>
        <header className="border-b border-[color:var(--border-subtle)] bg-[var(--bg-surface)]">
          <nav aria-label="Navegação da página da operadora" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <a href="/#topo" className="flex items-center gap-3" aria-label="Voltar para a Kifer Saúde">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-primary)] shadow-[var(--shadow-button)]">
                <PublicBrandMark className="h-6 w-auto text-[color:var(--text-on-brand)]" />
              </span>
              <span className="text-xl font-bold text-[color:var(--text-primary)]">Kifer Saúde</span>
            </a>
            <div className="flex items-center gap-2 sm:gap-4">
              <a href="/#prova-social" className="hidden text-sm font-semibold text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--operator-accent)] sm:inline">
                Outras operadoras
              </a>
              <LinkButton href={quotePath} size="sm" onClick={() => trackCta('hero')}>
                Cotar agora
              </LinkButton>
            </div>
          </nav>
        </header>

        <main id="conteudo-principal">
          <section className="relative overflow-hidden bg-[var(--surface-hero-bg)] px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[var(--operator-accent-soft)] opacity-50" />
            <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--operator-accent-border)] bg-[var(--operator-accent-soft)] px-4 py-2 text-sm font-semibold text-[color:var(--operator-accent-ink)]">
                  <Stethoscope className="kds-control-icon" aria-hidden="true" />
                  {page.eyebrow}
                </div>
                <h1 className="mt-7 max-w-3xl font-[var(--font-display)] text-5xl font-semibold leading-[1.02] text-[color:var(--text-primary)] sm:text-6xl lg:text-7xl">
                  {page.heroHeadline}
                </h1>
                <p className="mt-7 max-w-2xl text-lg leading-8 text-[color:var(--text-secondary)] sm:text-xl">{page.heroDescription}</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <LinkButton href={quotePath} size="lg" onClick={() => trackCta('hero')}>
                    Quero comparar opções
                    <ArrowRight className="kds-control-icon" aria-hidden="true" />
                  </LinkButton>
                  <LinkButton href={whatsappUrl} target="_blank" rel="noopener noreferrer" variant="success" size="lg" onClick={() => trackCta('whatsapp')}>
                    <MessageCircle className="kds-control-icon" aria-hidden="true" />
                    Falar no WhatsApp
                    <ExternalLink className="kds-control-icon" aria-hidden="true" />
                  </LinkButton>
                </div>
                <p className="mt-5 text-sm leading-relaxed text-[color:var(--text-muted)]">A Kifer Saúde é a corretora responsável pelo atendimento. A operadora é o produto apresentado.</p>
              </div>

              <div className="relative mx-auto w-full max-w-md">
                <div aria-hidden="true" className="absolute -inset-5 rounded-[var(--kds-radius-xl)] bg-[var(--operator-accent-soft)] blur-2xl" />
                <div className="relative rounded-[var(--kds-radius-xl)] border border-[color:var(--operator-accent-border)] bg-[var(--bg-elevated)] p-7 shadow-[var(--shadow-modal)] sm:p-9">
                  <div className="flex min-h-36 items-center justify-center rounded-[var(--kds-radius-lg)] border border-[color:var(--operator-accent-border)] bg-[var(--bg-surface)] px-6 py-8 text-center">
                    <OperatorLogo page={page} />
                  </div>
                  <div className="mt-7 flex items-start gap-3 border-t border-[color:var(--border-subtle)] pt-6">
                    <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[color:var(--operator-accent)]" aria-hidden="true" />
                    <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">Informações organizadas pela Kifer para uma conversa comercial mais clara e responsável.</p>
                  </div>
                  <LinkButton href={quotePath} variant="secondary" size="md" className="mt-6 w-full justify-between" onClick={() => trackCta('hero')}>
                    Receber orientação da Kifer
                    <ArrowRight className="kds-control-icon" aria-hidden="true" />
                  </LinkButton>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[var(--bg-surface)] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--operator-accent)]">A leitura da Kifer</p>
                <h2 className="mt-4 font-[var(--font-display)] text-4xl font-semibold leading-tight text-[color:var(--text-primary)]">O produto é da operadora. A orientação é da Kifer Saúde.</h2>
              </div>
              <div className="rounded-[var(--kds-radius-lg)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)] p-7 shadow-[var(--shadow-card)] sm:p-9">
                <HeartHandshake className="h-9 w-9 text-[color:var(--operator-accent)]" aria-hidden="true" />
                <p className="mt-5 text-lg leading-relaxed text-[color:var(--text-secondary)]">{page.valueProposition}</p>
                <div className="mt-7 grid gap-4 sm:grid-cols-3">
                  {['Perfil e cidade', 'Rede e condições', 'Acompanhamento'].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]">
                      <Check className="h-5 w-5 shrink-0 text-[color:var(--operator-accent)]" aria-hidden="true" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[var(--bg-surface-muted)] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <SectionHeading eyebrow="Possibilidades" title="O que entra na análise da sua cotação" description="A página orienta a conversa. A Kifer confirma a disponibilidade e as condições comerciais para o seu caso." />
            <div className="mx-auto mt-12 grid max-w-7xl gap-5 md:grid-cols-2">
              {page.contractProfiles.map((profile) => (
                <article key={profile.label} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-card)]">
                  <p className="text-lg font-semibold text-[color:var(--text-primary)]">{profile.label}</p>
                  <p className="mt-3 leading-relaxed text-[color:var(--text-secondary)]">{profile.detail}</p>
                </article>
              ))}
              <article className="rounded-[var(--kds-radius-lg)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-card)]">
                <p className="flex items-center gap-2 text-lg font-semibold text-[color:var(--text-primary)]"><UsersIcon /> Quantidade mínima de vidas</p>
                <p className="mt-3 leading-relaxed text-[color:var(--text-secondary)]">{page.minimumLives}</p>
              </article>
              <article className="rounded-[var(--kds-radius-lg)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-card)]">
                <p className="flex items-center gap-2 text-lg font-semibold text-[color:var(--text-primary)]"><MapPin className="h-5 w-5 text-[color:var(--operator-accent)]" aria-hidden="true" /> Abrangência</p>
                <p className="mt-3 leading-relaxed text-[color:var(--text-secondary)]">{page.coverage}</p>
              </article>
            </div>
          </section>

          <section className="bg-[var(--bg-surface)] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-3">
              <InfoList title="Produtos e linhas" icon={<Sparkles className="h-6 w-6" aria-hidden="true" />} items={page.products} />
              <InfoList title="Rede e atendimento" icon={<MapPin className="h-6 w-6" aria-hidden="true" />} items={page.networkHighlights} />
              <InfoList title="Diferenciais da Kifer" icon={<HeartHandshake className="h-6 w-6" aria-hidden="true" />} items={page.differentials} />
            </div>
            <div className="mx-auto mt-8 max-w-7xl rounded-[var(--kds-radius-lg)] border border-[color:var(--operator-accent-border)] bg-[var(--operator-accent-soft)] p-6">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[color:var(--operator-accent-ink)]">Antes de contratar</p>
              <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-[color:var(--text-secondary)] md:grid-cols-3">
                {page.commercialNotes.map((note) => <li key={note} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--operator-accent)]" aria-hidden="true" />{note}</li>)}
              </ul>
            </div>
          </section>

          <section className="bg-[var(--bg-surface-muted)] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <SectionHeading eyebrow="Como funciona" title="Você decide com mais clareza em três passos" description="A Kifer conduz o processo sem transformar a landing page em uma promessa de contratação automática." />
            <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
              {[
                { number: '01', title: 'Você conta seu cenário', text: 'Cidade, vidas, idade e prioridade de rede entram na primeira conversa.' },
                { number: '02', title: 'A Kifer compara', text: `A equipe confere as possibilidades de ${page.name} e explica as diferenças importantes.` },
                { number: '03', title: 'Você escolhe', text: 'Depois da decisão, a corretora acompanha documentação, proposta e ativação.' },
              ].map((step) => (
                <article key={step.number} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-card)]">
                  <span className="font-[var(--font-display)] text-4xl font-semibold text-[color:var(--operator-accent)]">{step.number}</span>
                  <h3 className="mt-5 text-lg font-semibold text-[color:var(--text-primary)]">{step.title}</h3>
                  <p className="mt-3 leading-relaxed text-[color:var(--text-secondary)]">{step.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="bg-[var(--bg-surface)] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-4xl">
              <SectionHeading eyebrow="Dúvidas frequentes" title={`Antes de falar sobre ${page.name}`} description="Respostas iniciais para orientar a conversa. As condições válidas são sempre confirmadas na cotação." />
              <div className="mt-10 space-y-3">
                {page.faqs.map((faq, index) => {
                  const isOpen = openFaq === index;
                  return (
                    <div key={faq.question} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)] px-5 py-2 shadow-[var(--shadow-card)]">
                      <Button type="button" variant="ghost" fullWidth className="justify-between text-left" aria-expanded={isOpen} onClick={() => setOpenFaq(isOpen ? null : index)}>
                        <span className="text-base font-semibold text-[color:var(--text-primary)]">{faq.question}</span>
                        <ChevronDown className={`kds-control-icon shrink-0 text-[color:var(--operator-accent)] transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </Button>
                      {isOpen ? <p className="px-1 pb-5 leading-relaxed text-[color:var(--text-secondary)]">{faq.answer}</p> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="bg-[var(--operator-accent)] px-4 py-16 text-[color:var(--text-on-brand)] sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] opacity-80">Próximo passo</p>
                <h2 className="mt-4 max-w-3xl font-[var(--font-display)] text-4xl font-semibold leading-tight md:text-5xl">Quer saber se {page.name} é uma boa opção para você?</h2>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed opacity-90">Peça uma análise sem compromisso e receba orientação da Kifer Saúde para o seu perfil.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <LinkButton href={quotePath} variant="secondary" size="lg" onClick={() => trackCta('final')}>
                  Pedir cotação
                  <ArrowRight className="kds-control-icon" aria-hidden="true" />
                </LinkButton>
                <LinkButton href={whatsappUrl} target="_blank" rel="noopener noreferrer" variant="success" size="lg" onClick={() => trackCta('whatsapp')}>
                  <MessageCircle className="kds-control-icon" aria-hidden="true" />
                  Falar com a Kifer
                </LinkButton>
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-[var(--text-primary)] px-4 py-10 text-[color:var(--text-inverse)] sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)]"><PublicBrandMark className="h-5 w-auto text-[color:var(--text-on-brand)]" /></span>
              <span><strong>Kifer Saúde</strong> · corretora responsável pelo atendimento</span>
            </div>
            <a href="/#topo" className="font-semibold opacity-80 transition-opacity hover:opacity-100">Voltar ao início</a>
          </div>
        </footer>
      </PublicShell>
    </>
  );
}

function InfoList({ title, icon, items }: { title: string; icon: ReactNode; items: readonly string[] }) {
  return (
    <article className="rounded-[var(--kds-radius-lg)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 text-[color:var(--operator-accent)]">{icon}<h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{title}</h3></div>
      <ul className="mt-5 space-y-3">
        {items.map((item) => <li key={item} className="flex gap-3 text-sm leading-relaxed text-[color:var(--text-secondary)]"><Check className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--operator-accent)]" aria-hidden="true" />{item}</li>)}
      </ul>
    </article>
  );
}

function UsersIcon() {
  return <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--operator-accent-border)] text-[color:var(--operator-accent)]" aria-hidden="true">+</span>;
}
