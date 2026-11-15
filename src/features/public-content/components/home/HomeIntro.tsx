import {
  ArrowUpRight,
  CheckCheck,
  FileSearch,
  HeartHandshake,
  MapPin,
  MessageCircle,
} from "lucide-react";
import {
  Button,
  TextLink,
  Heading,
  Text,
  Image,
} from "../../../../design-system";
import { buildHomeWhatsAppUrl, homePhotos } from "../../domain/homeContent";

export function HomeHero({ onQuote }: { onQuote: () => void }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap">
        <div className="hero-grid">
          <div className="hero-copy">
            <Text className="eyebrow">Planos de saúde · Rio de Janeiro</Text>
            <Heading family="display" level={1} id="hero-title">
              O plano certo
              <br />
              para a sua <em>vida.</em>
            </Heading>
            <Text className="hero-subtitle">
              Com orientação próxima,
              <br />
              do primeiro passo ao pós-venda.
            </Text>
            <Text className="lead">
              Escolher um plano de saúde pode ser mais simples. A Kifer compara
              as opções e ajuda você a decidir com clareza, no seu tempo.
            </Text>
            <div className="hero-actions">
              <Button size="lg" className="button" onClick={onQuote}>
                Encontrar meu plano
                <ArrowUpRight aria-hidden="true" />
              </Button>
              <TextLink
                className="text-link"
                href={buildHomeWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden="true" />
                Conversar no WhatsApp
              </TextLink>
            </div>
            <Text className="hero-note">
              <CheckCheck aria-hidden="true" />
              Cotação gratuita. Sem compromisso.
            </Text>
          </div>
          <div className="hero-photo">
            <div className="photo">
              <Image
                src={homePhotos.luizaHero}
                alt="Luíza Kifer em seu escritório"
                width="1448"
                height="1086"
                loading="eager"
              />
            </div>
            <div className="photo-top">
              <span />
              Pessoas no centro. Sempre.
            </div>
            <div className="photo-bottom">
              <div>
                <strong>Luíza Kifer</strong>
                <small>Orientação próxima em cada escolha.</small>
              </div>
              <span className="circle">
                <HeartHandshake aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
        <div className="hero-features">
          <div>
            <FileSearch aria-hidden="true" />
            Operadoras comparadas com clareza
          </div>
          <div>
            <MapPin aria-hidden="true" />
            Rede e condições bem explicadas
          </div>
          <div>
            <HeartHandshake aria-hidden="true" />
            Acompanhamento em cada etapa
          </div>
        </div>
      </div>
    </section>
  );
}
