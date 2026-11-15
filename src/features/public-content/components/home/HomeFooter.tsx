import { Instagram, Mail, MessageCircle } from "lucide-react";
import { TextLink, Heading, Text } from "../../../../design-system";
import { siteConfig } from "../../../../config/site";
import {
  buildHomeWhatsAppUrl,
  homeNavigation,
  type ContractKind,
} from "../../domain/homeContent";
import HomeBrand from "./HomeBrand";

export default function HomeFooter({
  onQuote,
}: {
  onQuote: (kind: ContractKind) => void;
}) {
  const profiles = [
    ["PF", "Pessoa física e família"],
    ["MEI", "Planos para MEI"],
    ["CNPJ", "Pequenas empresas"],
  ] as const;
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <TextLink href="#topo" aria-label="Kifer Saúde, início">
              <HomeBrand />
            </TextLink>
            <Text>
              Mais clareza nas escolhas.
              <br />
              Mais cuidado em cada fase.
            </Text>
          </div>
          <nav aria-label="Navegação do rodapé">
            <Heading family="display" level={2}>
              Explore a Kifer
            </Heading>
            <ul>
              {homeNavigation.map(({ section, label }) => (
                <li key={section}>
                  <TextLink href={`#${section}`}>{label}</TextLink>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Planos por perfil">
            <Heading family="display" level={2}>
              Encontre seu plano
            </Heading>
            <ul>
              {profiles.map(([kind, label]) => (
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
              <li>
                <TextLink href="#operadoras">Conheça as operadoras</TextLink>
              </li>
            </ul>
          </nav>
          <div className="footer-contact">
            <Heading family="display" level={2}>
              Vamos conversar
            </Heading>
            <Text>
              <TextLink href={siteConfig.telephoneHref}>
                {siteConfig.telephone}
              </TextLink>
            </Text>
            <Text>
              <TextLink href={`mailto:${siteConfig.email}`}>
                {siteConfig.email}
              </TextLink>
            </Text>
            <Text>Rio de Janeiro · RJ</Text>
            <div className="footer-social">
              <TextLink
                href={siteConfig.instagramUrl}
                aria-label="Instagram da Kifer Saúde"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram aria-hidden="true" />
              </TextLink>
              <TextLink
                href={buildHomeWhatsAppUrl()}
                aria-label="WhatsApp da Kifer Saúde"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden="true" />
              </TextLink>
              <TextLink
                href={`mailto:${siteConfig.email}`}
                aria-label="E-mail da Kifer Saúde"
              >
                <Mail aria-hidden="true" />
              </TextLink>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <Text>
            © {new Date().getFullYear()} Kifer Saúde. Todos os direitos
            reservados.
            <br />
            CNPJ {siteConfig.cnpj}
          </Text>
          <div>
            <TextLink href="/politica-de-privacidade">
              Política de Privacidade
            </TextLink>
            <span>As condições variam conforme a operadora e o produto.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
