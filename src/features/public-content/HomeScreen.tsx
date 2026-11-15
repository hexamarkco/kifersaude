import { useEffect, useRef } from "react";
import PublicSeo from "../../components/public/PublicSeo";
import { ArrowUpRight } from "lucide-react";
import { Button, PublicShell, Text, TextLink } from "../../design-system";
import PublicHomeHeader from "./components/PublicHomeHeader";
import HomeAudience from "./components/home/HomeAudience";
import { HomeFaq, HomeWhatsApp } from "./components/home/HomeContact";
import HomeFooter from "./components/home/HomeFooter";
import { HomeHero } from "./components/home/HomeIntro";
import HomePartners from "./components/home/HomePartners";
import {
  HomeAbout,
  HomeProcess,
  HomeClarity,
} from "./components/home/HomeJourney";
import HomeQuoteForm from "./components/home/HomeQuoteForm";
import { homeFaqs, homePhotos, type ContractKind } from "./domain/homeContent";
import { useHomeQuote } from "./hooks/useHomeQuote";
import { useHomeMotion } from "./hooks/useHomeMotion";

const scrollToSection = (id: string, initial = false) => {
  const aliases: Record<string, string> = {
    "prova-social": "operadoras",
    faq: "duvidas",
    "quem-somos": "sobre",
    "fale-agora": "conversa",
    depoimentos: "clareza",
  };
  const resolvedId = aliases[id] ?? id;
  const section = document.getElementById(resolvedId);
  if (!section) return;
  window.history.replaceState(null, "", `#${resolvedId}`);
  section.scrollIntoView({
    behavior:
      initial || window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    block: "start",
  });
};

export default function HomeScreen() {
  const quote = useHomeQuote();
  const motionAnchor = useRef<HTMLElement>(null);
  useHomeMotion(motionAnchor);
  const requestQuote = (kind?: ContractKind) => {
    if (kind) quote.update("tipoContratacao", kind);
    scrollToSection("cotacao");
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLInputElement>(
          '#cotacao input[name="quote-contract-type"]:checked',
        )
        ?.focus({ preventScroll: true }),
    );
  };
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const frame = requestAnimationFrame(() => scrollToSection(id, true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      <PublicSeo
        title="Plano de saúde no RJ para PF, MEI e empresas"
        description="Compare planos de saúde no Rio de Janeiro para pessoa física, MEI e empresas. Receba uma cotação gratuita da Kifer com orientação sobre rede, carência e custos."
        canonicalPath="/"
        imagePath={homePhotos.luizaHero}
        imageAlt="Luíza Kifer no escritório da Kifer Saúde"
        faqItems={homeFaqs}
      />
      <PublicShell width="full" className="kifer-landing">
        <TextLink href="#conteudo-principal" className="home-skip-link">
          Pular para o conteúdo
        </TextLink>
        <PublicHomeHeader
          onNavigate={scrollToSection}
          onRequestQuote={() => requestQuote()}
        />
        <main id="conteudo-principal" ref={motionAnchor} tabIndex={-1}>
          <HomeHero onQuote={() => requestQuote()} />
          <HomePartners onQuote={() => requestQuote()} />
          <HomeAudience onQuote={requestQuote} />
          <HomeClarity />
          <HomeProcess onQuote={() => requestQuote()} />
          <HomeAbout />
          <HomeFaq />
          <HomeQuoteForm quote={quote} />
          <HomeWhatsApp />
        </main>
        <HomeFooter onQuote={requestQuote} />
        <div className="mobile-cta">
          <Text>
            <strong>Seu plano começa aqui.</strong>Cotação gratuita, sem
            compromisso.
          </Text>
          <Button className="button" onClick={() => requestQuote()}>
            Quero uma cotação
            <ArrowUpRight aria-hidden="true" />
          </Button>
        </div>
      </PublicShell>
    </>
  );
}
