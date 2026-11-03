import { useState } from "react";
import {
  ArrowLeft,
  BatteryFull,
  Briefcase,
  Building2,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Heart,
  MapPin,
  MessageCircle,
  Mic,
  MoreVertical,
  Phone,
  Plus,
  Signal,
  UserRound,
  Video,
  Wifi,
} from "lucide-react";
import {
  BrandWordmark,
  Button,
  Heading,
  Image,
  LinkButton,
  Text,
} from "../../../../design-system";
import {
  buildHomeWhatsAppUrl,
  homeFaqs,
  homePhotos,
} from "../../domain/homeContent";

const faqIcons = [Briefcase, Building2, Clock, MapPin, FileText];
export function HomeFaq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section
      id="faq"
      className="home-section home-faq"
      aria-labelledby="faq-title"
    >
      <div className="home-container home-faq-layout">
        <div className="home-faq-copy">
          <Text className="home-eyebrow">Dúvidas</Text>
          <Heading id="faq-title" family="display" className="home-title">
            Perguntas
            <br /> <em>frequentes.</em>
          </Heading>
          <Text className="home-lead">
            Aqui você encontra respostas para as dúvidas mais comuns sobre
            planos de saúde, contratação e atendimento.
          </Text>
          <div className="home-faq-art" aria-hidden="true">
            <svg viewBox="-112 0 684 393" focusable="false">
              <circle cx="229" cy="341" r="340" fill="none" stroke="var(--brand-primary-border)" strokeOpacity=".4" strokeWidth="2" />
              <circle cx="204" cy="350" r="301" fill="var(--home-soft)" fillOpacity=".4" />
              <g transform="translate(147 113) rotate(-8)">
                <path className="home-faq-art-bubble" d="M0 48C0 21 22 0 50 0H154C179 0 197 17 197 42V97C197 126 177 145 149 145H72L11 184Q3 189 5 179L10 147Q-8 135 -8 109Z" />
                <g fill="var(--brand-primary)" opacity=".23">
                  <circle cx="55" cy="78" r="10" />
                  <circle cx="92" cy="78" r="10" />
                  <circle cx="129" cy="78" r="10" />
                </g>
              </g>
              <g transform="translate(274 189) rotate(-8)">
                <path d="M0 36C0 15 17 0 38 0H103C124 0 138 15 138 36V68Q138 97 107 102L105 127Q104 133 98 128L69 103H31C12 103 -9 92 -9 70Z" fill="var(--home-paper)" />
                <g fill="var(--brand-primary)" opacity=".23">
                  <circle cx="38" cy="54" r="7" />
                  <circle cx="64" cy="54" r="7" />
                  <circle cx="90" cy="54" r="7" />
                </g>
              </g>
            </svg>
          </div>
        </div>
        <div className="home-faq-list">
          {homeFaqs.map((item, index) => {
            const Icon = faqIcons[index];
            return (
              <div
                key={item.question}
                className={`home-faq-item${open === index ? " is-open" : ""}`}
              >
                <Heading level={3}>
                  <Button
                    id={`faq-trigger-${index}`}
                    type="button"
                    variant="ghost"
                    fullWidth
                    aria-expanded={open === index}
                    aria-controls={`faq-answer-${index}`}
                    onClick={() =>
                      setOpen((current) => (current === index ? null : index))
                    }
                    className="home-faq-trigger"
                  >
                    <span className="home-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span>{item.question}</span>
                    <ChevronDown
                      className="kds-control-icon"
                      aria-hidden="true"
                    />
                  </Button>
                </Heading>
                <div className="home-faq-answer">
                  <div
                    id={`faq-answer-${index}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${index}`}
                    aria-hidden={open !== index}
                  >
                    <Text>{item.answer}</Text>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HomeWhatsApp() {
  return (
    <section
      id="fale-agora"
      className="home-whatsapp"
      aria-labelledby="whatsapp-title"
    >
      <div className="home-container home-whatsapp-layout">
        <div className="home-whatsapp-copy">
          <Text className="home-eyebrow">Atendimento via WhatsApp</Text>
          <Heading id="whatsapp-title" family="display" className="home-title">
            Fale com a gente
            <br /> pelo <em>WhatsApp.</em>
          </Heading>
          <Text className="home-lead">
            Tire suas dúvidas, compare opções e receba uma recomendação
            personalizada. Nosso time te atende de forma humana e sem
            complicação.
          </Text>
          <ul className="home-whatsapp-benefits">
            {[
              {
                title: "Conversa sem complicação",
                text: "Tire suas dúvidas diretamente com a Kifer.",
                icon: MessageCircle,
              },
              {
                title: "Atendimento especializado",
                text: "Fale com quem entende de planos de saúde.",
                icon: UserRound,
              },
              {
                title: "Orientação personalizada",
                text: "Opções de acordo com seu perfil e necessidade.",
                icon: Heart,
              },
            ].map(({ title, text, icon: Icon }) => (
              <li key={title}>
                <span className="home-icon">
                  <Icon aria-hidden="true" />
                </span>
                <div>
                  <Heading level={3}>{title}</Heading>
                  <Text>{text}</Text>
                </div>
              </li>
            ))}
          </ul>
          <LinkButton
            href={buildHomeWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
          >
            <MessageCircle className="kds-control-icon" aria-hidden="true" />
            Falar no WhatsApp
            <ChevronRight className="kds-control-icon" aria-hidden="true" />
          </LinkButton>
          <Text className="home-whatsapp-free">
            Atendimento gratuito e sem compromisso.
          </Text>
        </div>
        <div className="home-whatsapp-visual">
          <div className="home-whatsapp-photo">
            <Image
              src={homePhotos.luizaWhatsApp}
              alt="Luíza Kifer no escritório da Kifer Saúde, com a mão apoiada no queixo"
              width={1122}
              height={1402}
              loading="lazy"
            />
            <div className="home-portrait-label">
              <strong>Luíza Kifer</strong>
              <span>Time Kifer Saúde</span>
            </div>
          </div>
          <figure
            className="home-phone"
            aria-label="Exemplo ilustrativo de uma conversa com a Kifer no WhatsApp"
          >
            <div className="home-phone-screen">
              <div className="home-phone-status" aria-hidden="true">
                <span>9:41</span>
                <i />
                <span>
                  <Signal />
                  <Wifi />
                  <BatteryFull />
                </span>
              </div>
              <div className="home-phone-header">
                <ArrowLeft aria-hidden="true" />
                <div className="home-phone-avatar">
                  <BrandWordmark />
                </div>
                <div>
                  <strong>Kifer Saúde</strong>
                  <span>Conversa ilustrativa</span>
                </div>
                <Video aria-hidden="true" />
                <Phone aria-hidden="true" />
                <MoreVertical aria-hidden="true" />
              </div>
              <div className="home-phone-conversation">
                <div className="home-message home-message-out">
                  Olá! Gostaria de ajuda para encontrar um plano de saúde para
                  mim e minha família.
                  <CheckCheck aria-hidden="true" />
                </div>
                <div className="home-message">
                  Oi! Sou a Luíza, da Kifer Saúde. Vou te ajudar a comparar as
                  opções para o seu perfil.
                </div>
                <div className="home-message">
                  Para começar, vamos entender o que é mais importante para você
                  na cobertura?
                </div>
                <div className="home-message home-message-out">
                  Claro!
                  <CheckCheck aria-hidden="true" />
                </div>
                <div className="home-message">
                  Você procura um plano individual, familiar ou para o seu CNPJ?
                </div>
              </div>
              <div className="home-phone-input" aria-hidden="true">
                <Plus />
                <span>Mensagem</span>
                <Mic />
              </div>
              <div className="home-phone-home" aria-hidden="true" />
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
