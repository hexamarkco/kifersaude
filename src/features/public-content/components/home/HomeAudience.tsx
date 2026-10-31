import { useRef, useState } from "react";
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
import { useHomeProfileMotion } from "../../hooks/useHomeMotion";

export default function HomeAudience({
  onQuote,
}: {
  onQuote: (kind: ContractKind) => void;
}) {
  const [selected, setSelected] = useState<ContractKind>("PF");
  const slides = useRef<HTMLDivElement>(null);
  useHomeProfileMotion(slides, selected);
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
          <fieldset className="home-audience-selector" data-profile={selected}>
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
                  aria-controls={`audience-panel-${kind}`}
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
          <div className="home-audience-slides" ref={slides}>
            {homeAudiences.map((profile) => (
              <div
                key={profile.kind}
                id={`audience-panel-${profile.kind}`}
                role="region"
                aria-labelledby={`audience-label-${profile.kind}`}
                aria-hidden={profile.kind !== selected}
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
                  <Button
                    type="button"
                    size="lg"
                    tabIndex={profile.kind === selected ? 0 : -1}
                    onClick={() => onQuote(profile.kind)}
                  >
                    {profile.cta}
                    <ChevronRight className="kds-control-icon" aria-hidden="true" />
                  </Button>
                </div>
                <div className="home-audience-photo">
                  <Image
                    src={profile.photo}
                    alt={profile.alt}
                    width={profile.photoWidth}
                    height={profile.photoHeight}
                    loading="lazy"
                  />
                  <svg className="home-audience-curve" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 1000C310 850 680 930 1000 670V1000Z" />
                    <path d="M0 230C280 35 560 150 1000 20M260 1000C530 1110 760 840 1000 800" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
