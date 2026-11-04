import {
  ChevronRight,
  MessageCircle,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Button,
  Heading,
  Image,
  LinkButton,
  Text,
  TextLink,
} from "../../../../design-system";
import {
  buildHomeWhatsAppUrl,
  homePartners,
  homePhotos,
  homeTrust,
} from "../../domain/homeContent";

type Props = { onQuote: () => void };

export function HomeHero({ onQuote }: Props) {
  return (
    <section id="topo" className="home-hero" aria-labelledby="home-title">
      <div className="home-hero-art" aria-hidden="true">
        <span />
        <span />
      </div>
      <svg className="home-hero-desktop-art" viewBox="0 0 1672 856" preserveAspectRatio="none" aria-hidden="true">
        <path className="home-hero-desktop-halo" d="M957 0C866 108 827 221 844 397C854 542 737 666 674 856H1672V0Z" />
        <path className="home-hero-desktop-sweep" d="M1015 240C878 269 743 396 668 547C604 676 626 778 587 856H1139V240Z" />
        <path className="home-hero-desktop-sand" d="M0 739C85 744 138 799 232 799C342 799 395 750 507 768C597 782 625 825 699 856H0Z" />
        <path className="home-hero-desktop-line" d="M0 677C110 719 128 821 251 833C335 841 403 805 490 856" />
      </svg>
      <div className="home-container home-hero-grid">
        <div className="home-hero-copy">
          <Text className="home-eyebrow home-eyebrow-line">
            Planos de saúde com orientação especializada
          </Text>
          <Heading
            id="home-title"
            level={1}
            family="display"
            className="home-hero-title"
          >
            <span className="home-hero-line">Seu plano de saúde,{" "}</span>
            <em>
              <span className="home-hero-line">com orientação{" "}</span>
              <span className="home-hero-line">de verdade.</span>
            </em>
          </Heading>
          <Text className="home-lead home-hero-description">
            Compare operadoras, entenda a rede credenciada e receba orientação
            especializada para escolher o plano ideal no{" "}
            <strong>Rio de Janeiro.</strong>
          </Text>
          <div className="home-hero-actions">
            <Button type="button" size="lg" onClick={onQuote}>
              Quero minha cotação gratuita{" "}
              <ChevronRight className="kds-control-icon" aria-hidden="true" />
            </Button>
            <LinkButton
              href={buildHomeWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="lg"
            >
              <MessageCircle className="kds-control-icon" aria-hidden="true" />
              Falar no WhatsApp
            </LinkButton>
          </div>
          <ul className="home-hero-benefits">
            {[
              {
                icon: Search,
                text: (
                  <>
                    Compare
                    <br /> operadoras
                  </>
                ),
              },
              {
                icon: Users,
                text: (
                  <>
                    Entenda a rede
                    <br /> credenciada
                  </>
                ),
              },
              {
                icon: ShieldCheck,
                text: (
                  <>
                    Orientação
                    <br /> especializada no RJ
                  </>
                ),
              },
            ].map(({ icon: Icon, text }, index) => (
              <li key={index}>
                <span className="home-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <TextLink
            className="home-support-link"
            href={buildHomeWhatsAppUrl(
              "Olá! Já sou cliente da Kifer Saúde e preciso de suporte.",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Já sou cliente e preciso de suporte{" "}
            <ChevronRight aria-hidden="true" />
          </TextLink>
        </div>
        <div className="home-hero-portrait">
          <div className="home-hero-photo-mask">
            <Image
              src={homePhotos.luizaHero}
              alt="Luíza Kifer no escritório, com a mão apoiada no queixo"
              width={1448}
              height={1086}
              loading="eager"
              className="home-luiza-photo"
            />
          </div>
          <svg className="home-hero-photo-wave" viewBox="0 0 1000 160" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 40C190 30 235 150 440 112S680 30 855 95S970 143 1000 145V160H0Z" />
            <path d="M0 40C190 30 235 150 440 112S680 30 855 95S970 143 1000 145" />
          </svg>
          <div className="home-portrait-label">
            <strong>Luíza Kifer</strong>
            <span>Orientação de verdade, de perto.</span>
          </div>
        </div>
      </div>
      <svg
        className="home-hero-wave"
        viewBox="0 0 1100 160"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          className="home-hero-sand-desktop"
          d="M0 55C190 55 160 165 360 110S620 45 820 158H0Z"
          fill="currentColor"
        />
        <path
          className="home-hero-sand-desktop"
          d="M0 0C160 45 120 140 310 130S480 115 590 160"
          stroke="currentColor"
        />
        <path className="home-hero-sand-mobile" d="M0 10C160 45 195 140 360 115S570 10 740 45S980 145 1100 100V145C950 175 810 95 680 90S455 160 310 150S100 45 0 40Z" fill="currentColor" />
        <path className="home-hero-sand-mobile" d="M0 10C160 45 195 140 360 115S570 10 740 45S980 145 1100 100" stroke="currentColor" />
      </svg>
    </section>
  );
}

export function HomeTrust() {
  return (
    <section
      id="prova-social"
      className="home-section home-trust"
      aria-labelledby="trust-title"
    >
      <div className="home-container">
        <div className="home-trust-grid">
          <div>
            <Text className="home-eyebrow home-eyebrow-tail">
              Confiança e operadoras
            </Text>
            <Heading id="trust-title" family="display" className="home-title">
              Boas escolhas começam
              <br /> com <em>informação clara.</em>
            </Heading>
            <Text className="home-lead">
              A Kifer compara as principais operadoras de saúde e ajuda você a
              entender o que realmente importa: cobertura, rede credenciada,
              custo e o melhor encaixe para o seu perfil.
            </Text>
            <div className="home-trust-photo-row">
              <div className="home-trust-photo">
                <Image
                  src={homePhotos.trust}
                  alt="Imagem ilustrativa de uma mulher tomando café ao lado do notebook"
                  width={1448}
                  height={1086}
                  loading="lazy"
                />
              </div>
              <Text className="home-trust-note">
                Mais clareza
                <br /> para uma vida
                <br /> mais tranquila.
                <span />
              </Text>
            </div>
          </div>
          <ol className="home-trust-list">
            {homeTrust.map(({ title, text, icon: Icon }, index) => (
              <li key={title}>
                <span className="home-icon">
                  <Icon aria-hidden="true" />
                </span>
                <div>
                  <Text className="home-step-number">
                    0{index + 1}
                    <span />
                  </Text>
                  <Heading family="display" level={3}>
                    {title}
                  </Heading>
                  <Text>{text}</Text>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="home-partner-heading">
          <Text>Principais operadoras</Text>
          <span />
          <Text>Mais opções para a sua escolha.</Text>
        </div>
        <ul className="home-partner-logos">
          {homePartners.map((partner) => (
            <li key={partner.alt}>
              <TextLink
                href={partner.href}
                aria-label={`Conhecer planos ${partner.alt}`}
              >
                <Image src={partner.src} alt={partner.alt} loading="lazy" />
              </TextLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
