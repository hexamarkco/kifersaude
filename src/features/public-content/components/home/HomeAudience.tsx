import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  Button,
  Heading,
  Image,
  Radio,
  RadioGroup,
  Text,
} from "../../../../design-system";
import {
  homeAudiences,
  homeBenefitIcons,
  type ContractKind,
} from "../../domain/homeContent";

export default function HomeAudience({
  onQuote,
}: {
  onQuote: (kind: ContractKind) => void;
}) {
  const [selected, setSelected] = useState<ContractKind>("PF");
  const profile =
    homeAudiences.find(({ kind }) => kind === selected) ?? homeAudiences[0];
  return (
    <section
      id="para-quem"
      className="home-section home-audience"
      aria-labelledby="audience-title"
    >
      <div className="home-container">
        <div className="home-section-intro">
          <Text className="home-eyebrow">Para quem é</Text>
          <Heading id="audience-title" family="display" className="home-title">
            Planos de saúde para cada momento da sua vida.
          </Heading>
          <Text className="home-lead">
            Cada perfil tem necessidades diferentes de cobertura, custo e
            carência.
            <br /> Escolha o seu e conte com a Kifer para entender as opções.
          </Text>
        </div>
        <div className="home-audience-layout">
          <fieldset className="home-audience-selector">
            <legend id="audience-selector-label" className="sr-only">
              Escolha seu perfil
            </legend>
            <RadioGroup
              aria-labelledby="audience-selector-label"
              name="audience-profile"
              value={selected}
              onValueChange={(value) => setSelected(value as ContractKind)}
            >
              {homeAudiences.map(({ kind, label, subtitle, icon: Icon }) => (
                <Radio
                  key={kind}
                  value={kind}
                  aria-controls="audience-panel"
                  label={
                    <span className="home-audience-option">
                      <span className="home-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <strong id={`audience-label-${kind}`}>{label}</strong>
                      <span>{subtitle}</span>
                      <ChevronRight
                        className="home-audience-arrow"
                        aria-hidden="true"
                      />
                    </span>
                  }
                />
              ))}
            </RadioGroup>
          </fieldset>
          <div
            id="audience-panel"
            role="region"
            aria-labelledby={`audience-label-${selected}`}
            className="home-audience-panel"
          >
            <div className="home-audience-copy">
              <Text className="home-eyebrow home-eyebrow-tail">
                {profile.label}
              </Text>
              <Heading
                family="display"
                level={3}
                className="home-audience-title"
              >
                {profile.title}
                <br /> <em>{profile.emphasis}</em>
              </Heading>
              <Text className="home-lead">{profile.description}</Text>
              <ul className="home-profile-benefits">
                {profile.benefits.map((benefit, index) => {
                  const Icon = homeBenefitIcons[index];
                  return (
                    <li key={benefit}>
                      <span className="home-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      {benefit}
                    </li>
                  );
                })}
              </ul>
              <Button type="button" size="lg" onClick={() => onQuote(selected)}>
                {profile.cta}
                <ChevronRight className="kds-control-icon" aria-hidden="true" />
              </Button>
            </div>
            <div className="home-audience-photo">
              <Image
                key={profile.kind}
                src={profile.photo}
                alt={profile.alt}
                width={1122}
                height={1402}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
