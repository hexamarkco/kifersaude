import { useState } from "react";
import { ArrowUpRight, MessageCircle, Plus } from "lucide-react";
import {
  Button,
  LinkButton,
  TextLink,
  Heading,
  Text,
  Image,
} from "../../../../design-system";
import PublicBrandMark from "../../../../components/public/PublicBrandMark";
import {
  buildHomeWhatsAppUrl,
  homeFaqs,
  homePhotos,
} from "../../domain/homeContent";

export function HomeFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="section faq" id="duvidas" aria-labelledby="faq-title">
      <div className="wrap faq-grid">
        <div>
          <Text className="eyebrow">Uma conversa mais clara</Text>
          <Heading family="display" level={2} id="faq-title">
            Dúvidas fazem parte.
            <br />A gente explica.
          </Heading>
          <Text className="lead">
            Algumas respostas para você começar a escolher com mais
            tranquilidade.
          </Text>
          <TextLink
            className="text-link"
            href={buildHomeWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            Minha dúvida é outra
            <ArrowUpRight aria-hidden="true" />
          </TextLink>
        </div>
        <div className="faq-list">
          {homeFaqs.map((item, index) => (
            <div
              className={open === index ? "faq-item is-open" : "faq-item"}
              key={item.question}
            >
              <Heading family="display" level={3}>
                <Button
                  variant="ghost"
                  fullWidth
                  className="faq-trigger"
                  id={`faq-trigger-${index}`}
                  aria-expanded={open === index}
                  aria-controls={`faq-answer-${index}`}
                  onClick={() =>
                    setOpen((current) => (current === index ? null : index))
                  }
                >
                  {item.question}
                  <Plus aria-hidden="true" />
                </Button>
              </Heading>
              <div className="faq-answer">
                <div
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${index}`}
                  hidden={open !== index}
                >
                  <Text>{item.answer}</Text>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeWhatsApp() {
  return (
    <section className="contact" id="conversa" aria-labelledby="contact-title">
      <div className="wrap">
        <div className="contact-banner">
          <PublicBrandMark className="contact-mark" />
          <div className="contact-copy">
            <Text className="eyebrow">Do seu jeito</Text>
            <Heading family="display" level={2} id="contact-title">
              Prefere começar
              <br />
              com uma conversa?
            </Heading>
            <Text>
              Tire suas dúvidas e conte o que você precisa.
              <br />A Kifer está aqui para ajudar a encontrar o caminho.
            </Text>
          </div>
          <div className="contact-action">
            <LinkButton
              className="button white"
              href={buildHomeWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
            >
              Falar com a Kifer no WhatsApp
              <MessageCircle aria-hidden="true" />
            </LinkButton>
            <div className="contact-person">
              <Image
                src={homePhotos.luizaWhatsApp}
                alt="Luíza Kifer"
                width="1122"
                height="1402"
                loading="lazy"
              />
              <span>
                <strong>Um atendimento com gente de verdade.</strong>Clareza,
                proximidade e cuidado.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
