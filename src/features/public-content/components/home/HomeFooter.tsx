import {
  Heart,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  BrandWordmark,
  Heading,
  Text,
  TextLink,
} from "../../../../design-system";
import { siteConfig } from "../../../../config/site";
import {
  buildHomeWhatsAppUrl,
  homeAudiences,
  homeNavigation,
  type ContractKind,
} from "../../domain/homeContent";

type Props = { onQuote: (kind: ContractKind) => void };
export default function HomeFooter({ onQuote }: Props) {
  return (
    <footer className="home-footer">
      <div className="home-container home-footer-grid">
        <div className="home-footer-brand">
          <BrandWordmark />
          <Text className="home-footer-tagline">
            Mais saúde, mais escolhas
            <br /> para você, sua família e<br /> sua empresa.
          </Text>
          <Text>
            A Kifer compara planos de diferentes operadoras, com atendimento
            consultivo e sem custo, para você escolher com segurança e
            tranquilidade.
          </Text>
          <ul className="home-footer-benefits">
            {[
              { icon: Users, text: "Atendimento especializado" },
              { icon: ShieldCheck, text: "Comparação sem custo" },
              { icon: Heart, text: "Mais saúde para o seu futuro" },
            ].map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className="home-icon">
                  <Icon aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Navegação do rodapé">
          <Heading level={2}>Navegação</Heading>
          <ul>
            {homeNavigation.map(({ section, label }) => (
              <li key={section}>
                <TextLink href={`#${section}`}>{label}</TextLink>
              </li>
            ))}
            <li>
              <TextLink href="#quem-somos">Sobre a Luíza</TextLink>
            </li>
          </ul>
        </nav>
        <div>
          <nav aria-label="Planos por perfil">
            <Heading level={2}>Para quem é</Heading>
            <ul>
              {homeAudiences.map(({ kind, label }) => (
                <li key={kind}>
                  <TextLink
                    href="#cotacao"
                    onClick={(event) => {
                      event.preventDefault();
                      onQuote(kind);
                    }}
                  >
                    {label}
                  </TextLink>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Links úteis" className="home-footer-useful">
            <Heading level={2}>Links úteis</Heading>
            <ul>
              <li>
                <TextLink href="#prova-social">Conheça as operadoras</TextLink>
              </li>
              <li>
                <TextLink href="#faq">Tire suas dúvidas</TextLink>
              </li>
              <li>
                <TextLink
                  href={buildHomeWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fale com um especialista
                </TextLink>
              </li>
            </ul>
          </nav>
        </div>
        <div className="home-footer-contact">
          <Heading level={2}>Fale com a Kifer</Heading>
          <Text>
            Nosso time está pronto para ajudar você a encontrar seu plano.
          </Text>
          <ul>
            <li>
              <span className="home-icon">
                <Phone aria-hidden="true" />
              </span>
              <div>
                <Text>Telefone</Text>
                <TextLink
                  href={`tel:${siteConfig.telephone.replace(/\s/g, "")}`}
                >
                  {siteConfig.telephone}
                </TextLink>
              </div>
            </li>
            <li>
              <span className="home-icon">
                <MessageCircle aria-hidden="true" />
              </span>
              <div>
                <Text>WhatsApp</Text>
                <TextLink
                  href={buildHomeWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {siteConfig.telephone}
                </TextLink>
              </div>
            </li>
            <li>
              <span className="home-icon">
                <Mail aria-hidden="true" />
              </span>
              <div>
                <Text>E-mail</Text>
                <TextLink href={`mailto:${siteConfig.email}`}>
                  {siteConfig.email}
                </TextLink>
              </div>
            </li>
            <li>
              <MapPin aria-hidden="true" />
              <Text>Rio de Janeiro, RJ</Text>
            </li>
          </ul>
          <div className="home-footer-social">
            <Heading level={2}>Siga a Kifer</Heading>
            <TextLink
              href={siteConfig.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram aria-hidden="true" />
              @souluizakifer
            </TextLink>
          </div>
        </div>
      </div>
      <div className="home-footer-bottom">
        <div className="home-container">
          <Text>
            © {new Date().getFullYear()} Kifer Saúde. Todos os direitos
            reservados.
            <br /> CNPJ {siteConfig.cnpj}
          </Text>
          <TextLink href="/politica-de-privacidade">
            Política de Privacidade
          </TextLink>
          <div>
            <ShieldCheck aria-hidden="true" />
            <Text>
              Seus dados tratados com
              <br /> segurança e transparência.
            </Text>
          </div>
        </div>
      </div>
    </footer>
  );
}
