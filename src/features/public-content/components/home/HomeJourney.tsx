import { ArrowUpRight, FileSearch, HeartHandshake, Users } from "lucide-react";
import { TextLink, Heading, Text, Image } from "../../../../design-system";
import PublicBrandMark from "../../../../components/public/PublicBrandMark";
import {
  buildHomeWhatsAppUrl,
  homePhotos,
  homeSteps,
} from "../../domain/homeContent";

export function HomeClarity() {
  const points = [
    [
      "A rede que você realmente usa.",
      "Hospitais, laboratórios e locais de atendimento avaliados para a sua rotina.",
    ],
    [
      "Os custos, sem entrelinhas.",
      "Mensalidade, coparticipação e condições da proposta explicadas antes da decisão.",
    ],
    [
      "O cuidado continua depois.",
      "Orientação com a documentação e acompanhamento até a ativação do seu plano.",
    ],
  ];
  return (
    <section className="clarity" id="clareza" aria-labelledby="clarity-title">
      <PublicBrandMark className="clarity-mark" />
      <div className="wrap">
        <div>
          <Text className="eyebrow">É sobre escolher com confiança</Text>
          <Heading family="display" level={2} id="clarity-title">
            Você não precisa
            <br />
            entender tudo.
            <br />
            <span>
              Precisa de alguém
              <br />
              que explique bem.
            </span>
          </Heading>
          <Text className="lead">
            Preço é importante. Entender o que você está contratando também. A
            gente coloca os detalhes na mesa, sem complicar a conversa.
          </Text>
        </div>
        <div>
          {points.map(([title, text], index) => (
            <div className="clarity-item" key={title}>
              <span className="n">0{index + 1}</span>
              <div>
                <Heading family="display" level={3}>
                  {title}
                </Heading>
                <Text>{text}</Text>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeProcess({ onQuote }: { onQuote: () => void }) {
  return (
    <section
      className="section process"
      id="como-funciona"
      aria-labelledby="process-title"
    >
      <div className="wrap">
        <div className="section-head">
          <div>
            <Text className="eyebrow">Como funciona</Text>
            <Heading family="display" level={2} id="process-title">
              Do primeiro oi
              <br />
              ao plano na sua vida.
            </Heading>
          </div>
          <Text className="lead">
            Quatro etapas, uma conversa de cada vez. Você sabe o que acontece e
            qual é o próximo passo.
          </Text>
        </div>
        <ol className="steps">
          {homeSteps.map(({ title, text }, index) => (
            <li className="step" key={title}>
              <div className="step-top">
                <span>0{index + 1}</span>
              </div>
              <div>
                <Heading family="display" level={3}>
                  {title}
                </Heading>
                <Text>{text}</Text>
              </div>
            </li>
          ))}
        </ol>
        <div className="process-cta">
          Pronto para dar o primeiro passo?
          <TextLink
            className="text-link"
            href="#cotacao"
            onClick={(event) => {
              event.preventDefault();
              onQuote();
            }}
          >
            Pedir uma cotação
            <ArrowUpRight aria-hidden="true" />
          </TextLink>
        </div>
      </div>
    </section>
  );
}

export function HomeAbout() {
  return (
    <section className="about" id="sobre" aria-labelledby="about-title">
      <div className="wrap about-grid">
        <div className="about-photo">
          <Image
            src={homePhotos.luizaAbout}
            alt="Luíza Kifer à mesa de trabalho"
            width="1448"
            height="1086"
            loading="lazy"
          />
          <div className="about-photo-caption">
            <strong>Luíza Kifer</strong>
            <span>Sua corretora de planos de saúde.</span>
          </div>
        </div>
        <div>
          <Text className="eyebrow">Prazer, Kifer Saúde</Text>
          <Heading family="display" level={2} id="about-title">
            Uma escolha importante merece um atendimento próximo.
          </Heading>
          <Text className="lead">
            Por trás de cada cotação, tem uma pessoa, uma família ou uma equipe.
            Nosso trabalho começa por entender essa história — e continua na
            orientação para cada decisão.
          </Text>
          <Text className="about-name">Sou a Luíza Kifer.</Text>
          <Text className="about-role">
            Clareza para escolher. Cuidado para acompanhar.
          </Text>
          <div className="about-values">
            <div>
              <Users aria-hidden="true" />
              Sua rotina antes da proposta.
            </div>
            <div>
              <FileSearch aria-hidden="true" />
              Cada detalhe explicado com calma.
            </div>
            <div>
              <HeartHandshake aria-hidden="true" />
              Suporte do começo à ativação.
            </div>
          </div>
          <TextLink
            className="text-link"
            href={buildHomeWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            Vamos conversar?
            <ArrowUpRight aria-hidden="true" />
          </TextLink>
        </div>
      </div>
    </section>
  );
}
