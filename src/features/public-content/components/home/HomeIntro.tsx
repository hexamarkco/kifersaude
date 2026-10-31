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
            Seu plano de saúde,
            <br />{" "}
            <em>
              com orientação
              <br /> de verdade.
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
          <Image
            src={homePhotos.luizaHero}
            alt="Luíza Kifer no escritório, com a mão apoiada no queixo"
            width={1672}
            height={941}
            loading="eager"
            className="home-luiza-photo"
          />
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
          d="M0 55C190 55 160 165 360 110S620 45 820 158H0Z"
          fill="currentColor"
        />
        <path
          d="M0 0C160 45 120 140 310 130S480 115 590 160"
          stroke="currentColor"
        />
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
                  src={homePhotos.work}
                  alt="Imagem ilustrativa de uma mulher tomando café ao lado do notebook"
                  width={1536}
                  height={1024}
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
