import { ArrowUpRight, Check } from "lucide-react";
import { TextLink, Heading, Text, Image } from "../../../../design-system";
import { homeAudiences, type ContractKind } from "../../domain/homeContent";

export default function HomeAudience({
  onQuote,
}: {
  onQuote: (kind: ContractKind) => void;
}) {
  return (
    <section
      className="section audiences"
      id="para-quem"
      aria-labelledby="audience-title"
    >
      <div className="wrap">
        <div className="section-head">
          <div>
            <Text className="eyebrow">Cada fase pede um cuidado</Text>
            <Heading family="display" level={2} id="audience-title">
              O seu momento.
              <br />O seu jeito de cuidar.
            </Heading>
          </div>
          <Text className="lead">
            Para você, sua família ou sua empresa. O ponto de partida é entender
            o que faz sentido para a sua vida.
          </Text>
        </div>
        <div className="profiles">
          {homeAudiences.map((profile, index) => (
            <article className="profile" key={profile.kind}>
              <div className="profile-img">
                <Image
                  src={profile.photo}
                  alt={profile.alt}
                  width={profile.photoWidth}
                  height={profile.photoHeight}
                  loading="lazy"
                />
                <span className="number">0{index + 1}</span>
              </div>
              <div className="profile-body">
                <Text className="profile-label">
                  {profile.kind === "CNPJ"
                    ? "Pequenas empresas"
                    : profile.label}
                </Text>
                <Heading family="display" level={3}>
                  {profile.title}
                  <br />
                  {profile.emphasis}
                </Heading>
                <Text className="lead">{profile.description}</Text>
                <ul>
                  {profile.benefits.map((text) => (
                    <li key={text}>
                      <Check aria-hidden="true" />
                      {text}
                    </li>
                  ))}
                </ul>
                <TextLink
                  className="text-link"
                  href="#cotacao"
                  onClick={(event) => {
                    event.preventDefault();
                    onQuote(profile.kind);
                  }}
                >
                  {profile.cta}
                  <ArrowUpRight aria-hidden="true" />
                </TextLink>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
