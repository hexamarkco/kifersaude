import { MessageCircle, Quote, Users } from "lucide-react";
import { Heading, Image, Text } from "../../../../design-system";
import {
  homeAboutBenefits,
  homePhotos,
  homeSteps,
} from "../../domain/homeContent";

export function HomeProcess() {
  return (
    <section
      id="como-funciona"
      className="home-section home-process"
      aria-labelledby="process-title"
    >
      <div className="home-container">
        <div className="home-section-intro">
          <Text className="home-eyebrow">Como funciona</Text>
          <Heading id="process-title" family="display" className="home-title">
            Em poucos passos, você encontra
            <br /> o <em>plano ideal.</em>
          </Heading>
          <Text className="home-lead">
            A Kifer simplifica sua escolha. Você fala o que precisa, a gente
            compara
            <br /> as melhores opções e te acompanha até o seu plano estar
            ativo.
          </Text>
        </div>
        <div className="home-process-line">
          <svg
            viewBox="0 0 1200 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 50C110 130 190-30 300 50S490-30 600 50S790-30 900 50S1090-30 1200 50" />
            <circle cx="150" cy="50" r="6" />
            <circle cx="450" cy="50" r="6" />
            <circle cx="750" cy="50" r="6" />
            <circle cx="1050" cy="50" r="6" />
          </svg>
          <ol>
            {homeSteps.map(({ title, text, icon: Icon }, index) => (
              <li key={title}>
                <div className="home-process-icon">
                  <span className="home-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="home-process-number">0{index + 1}</span>
                </div>
                <Heading level={3} family="display">
                  {title}
                </Heading>
                <Text>{text}</Text>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function HomeTestimonials() {
  // Supplied reference portraits are reserved until real testimonials are approved.
  // Keep the reference's main + secondary composition without attributing invented stories.
  return (
    <section
      id="depoimentos"
      className="home-section home-testimonials"
      aria-labelledby="testimonials-title"
    >
      <div className="home-container">
        <div className="home-section-intro">
          <Text className="home-eyebrow">Depoimentos</Text>
          <Heading
            id="testimonials-title"
            family="display"
            className="home-title"
          >
            Cada escolha tem uma história.
          </Heading>
          <Text className="home-lead">
            Um espaço para as experiências de quem conta com a Kifer Saúde.
          </Text>
        </div>
        <div className="home-testimonial-layout">
          <div className="home-testimonial-main">
            <div className="home-testimonial-portrait" aria-hidden="true">
              <Users />
              <span />
            </div>
            <div className="home-testimonial-empty">
              <Quote aria-hidden="true" />
              <Heading level={3} family="display">
                Sua confiança merece
                <br /> histórias de verdade.
              </Heading>
              <Text>Ainda não há depoimentos disponíveis nesta página.</Text>
              <div className="home-testimonial-rule" />
            </div>
          </div>
          <div className="home-testimonial-secondary" aria-hidden="true">
            <div>
              <span className="home-icon">
                <MessageCircle />
              </span>
              <Quote />
              <span className="home-empty-lines" />
            </div>
            <div>
              <span className="home-icon">
                <Users />
              </span>
              <Quote />
              <span className="home-empty-lines" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeAbout() {
  return (
    <section
      id="quem-somos"
      className="home-about"
      aria-labelledby="about-title"
    >
      <div className="home-about-photo">
        <span aria-hidden="true" />
        <Image
          src={homePhotos.luizaAbout}
          alt="Luíza Kifer, corretora independente de planos de saúde"
          width={1448}
          height={1086}
          loading="lazy"
        />
        <svg className="home-about-curve" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 620C170 610 170 910 390 950S780 960 1000 1000M730 0C780 110 880 130 940 105" />
        </svg>
      </div>
      <div className="home-about-copy">
        <Text className="home-eyebrow home-eyebrow-tail">Sobre a Luíza</Text>
        <Heading id="about-title" family="display" className="home-title">
          Mais do que planos,
          <br /> <em>pessoas em primeiro lugar.</em>
        </Heading>
        <Text className="home-lead">
          Oi, eu sou a Luíza, corretora independente de planos de saúde no Rio
          de Janeiro. Trabalho com diferentes operadoras e oriento cada cliente
          com a mesma atenção que dedicaria à minha família.
        </Text>
        <Text className="home-lead">
          Meu trabalho é te orientar na comparação de custos, rede credenciada e
          regras de contratação, com linguagem simples e sem pressão. Da cotação
          à ativação, você conta com acompanhamento para escolher com mais
          segurança.
        </Text>
        <ul className="home-about-benefits">
          {homeAboutBenefits.map(({ title, text, icon: Icon }) => (
            <li key={title}>
              <span className="home-icon">
                <Icon aria-hidden="true" />
              </span>
              <Heading level={3}>{title}</Heading>
              <Text>{text}</Text>
            </li>
          ))}
        </ul>
        <div className="home-about-name">
          <strong>Luíza Kifer</strong>
          <Text className="home-eyebrow">Especialista em planos de saúde</Text>
        </div>
      </div>
    </section>
  );
}
