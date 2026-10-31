import { useEffect } from "react";
import PublicSeo from "../../components/public/PublicSeo";
import { PublicShell, TextLink } from "../../design-system";
import PublicHomeHeader from "./components/PublicHomeHeader";
import HomeAudience from "./components/home/HomeAudience";
import { HomeFaq, HomeWhatsApp } from "./components/home/HomeContact";
import HomeFooter from "./components/home/HomeFooter";
import { HomeHero, HomeTrust } from "./components/home/HomeIntro";
import {
  HomeAbout,
  HomeProcess,
  HomeTestimonials,
} from "./components/home/HomeJourney";
import HomeQuoteForm from "./components/home/HomeQuoteForm";
import { homeFaqs, homePhotos, type ContractKind } from "./domain/homeContent";
import { useHomeQuote } from "./hooks/useHomeQuote";

export default function HomeScreen() {
  const quote = useHomeQuote();
  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    window.history.replaceState(null, "", `#${id}`);
    section.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };
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
    const frame = requestAnimationFrame(() =>
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "auto", block: "start" }),
    );
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
      <PublicShell width="full" className="kifer-home">
        <TextLink href="#conteudo-principal" className="home-skip-link">
          Pular para o conteúdo
        </TextLink>
        <PublicHomeHeader
          onNavigate={scrollToSection}
          onRequestQuote={() => requestQuote()}
        />
        <main id="conteudo-principal">
          <HomeHero onQuote={() => requestQuote()} />
          <HomeTrust />
          <HomeAudience onQuote={requestQuote} />
          <HomeProcess />
          <HomeTestimonials />
          <HomeAbout />
          <HomeFaq />
          <HomeQuoteForm quote={quote} />
          <HomeWhatsApp />
        </main>
        <HomeFooter onQuote={requestQuote} />
      </PublicShell>
    </>
  );
}
