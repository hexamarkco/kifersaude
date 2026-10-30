import { useEffect, useState, type KeyboardEvent } from "react";
import {
  ChevronRight,
  LockKeyhole,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import {
  Button,
  Field,
  FieldLabel,
  Heading,
  Image,
  Input,
  LinkButton,
  Radio,
  RadioGroup,
  Text,
} from "../../../../design-system";
import { fetchCitiesByState } from "../../../../lib/brasilLocations";
import { formatPhoneInput } from "../../../../lib/inputFormatters";
import {
  AGE_RANGES,
  buildHomeWhatsAppUrl,
  formatAgeRangeLabel,
  homeAudiences,
  homePhotos,
  homeQuoteBenefits,
  type ContractKind,
} from "../../domain/homeContent";
import type { useHomeQuote } from "../../hooks/useHomeQuote";
import PrivacyNotice from "../PrivacyNotice";

type Quote = ReturnType<typeof useHomeQuote>;
type CityProps = {
  id?: string;
  value: string;
  onChange: (city: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  required?: boolean;
  disabled?: boolean;
};

function CityAutocomplete({
  id = "quote-city",
  value,
  onChange,
  ...props
}: CityProps) {
  const [cities, setCities] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  useEffect(() => {
    let active = true;
    fetchCitiesByState("RJ")
      .then((list) => {
        if (active) setCities(list);
      })
      .catch(() => {
        /* Free text remains available. */
      });
    return () => {
      active = false;
    };
  }, []);
  const query = value.trim().toLocaleLowerCase("pt-BR");
  const matches =
    query.length >= 2
      ? cities
          .filter((city) => city.toLocaleLowerCase("pt-BR").includes(query))
          .slice(0, 6)
      : [];
  const visible = open && matches.length > 0;
  const choose = (city: string) => {
    onChange(city);
    setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!visible) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted(
        (current) =>
          (current + (event.key === "ArrowDown" ? 1 : matches.length - 1)) %
          matches.length,
      );
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(matches[highlighted]);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };
  return (
    <div className="home-city">
      <Input
        {...props}
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        size="lg"
        leftIcon={MapPin}
        placeholder="Digite sua cidade"
        autoComplete="off"
        role="combobox"
        aria-expanded={visible}
        aria-autocomplete="list"
        aria-controls={visible ? `${id}-list` : undefined}
        aria-activedescendant={
          visible ? `${id}-option-${highlighted}` : undefined
        }
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {visible && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-label="Cidades do Rio de Janeiro"
          className="home-city-options"
        >
          {matches.map((city, index) => (
            <Button
              id={`${id}-option-${index}`}
              key={city}
              type="button"
              role="option"
              aria-selected={highlighted === index}
              tabIndex={-1}
              variant="ghost"
              fullWidth
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => choose(city)}
            >
              {city}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomeQuoteForm({ quote }: { quote: Quote }) {
  const {
    values,
    update,
    updateAge,
    ageCounts,
    ageTotal,
    totalLives,
    submitting,
    feedback,
    onSubmit,
  } = quote;
  const error = (id: string) =>
    feedback?.kind === "error" && feedback.field === id
      ? feedback.message
      : undefined;
  return (
    <section
      id="cotacao"
      className="home-section home-quote"
      aria-labelledby="quote-title"
    >
      <div className="home-quote-background" aria-hidden="true">
        <Image
          src={homePhotos.family}
          alt=""
          width={1122}
          height={1402}
          loading="lazy"
        />
        <span />
      </div>
      <div className="home-container home-quote-layout">
        <div className="home-quote-copy">
          <Text className="home-eyebrow">Cotação</Text>
          <Heading id="quote-title" family="display" className="home-title">
            Encontre o <em>plano ideal</em>
            <br /> para você, sua família
            <br /> ou sua empresa.
          </Heading>
          <Text className="home-lead">
            Compare operadoras, receba uma proposta personalizada e conte com o
            suporte da Kifer em todo o processo. É gratuito e sem compromisso.
          </Text>
          <ul className="home-quote-benefits">
            {homeQuoteBenefits.map(({ title, text, icon: Icon }) => (
              <li key={title}>
                <span className="home-icon">
                  <Icon aria-hidden="true" />
                </span>
                <Heading level={3}>{title}</Heading>
                <Text>{text}</Text>
              </li>
            ))}
          </ul>
        </div>
        <form
          className="home-quote-form"
          onSubmit={onSubmit}
          aria-label="Solicite sua cotação"
          aria-busy={submitting}
        >
          <Text className="home-eyebrow">Solicite sua cotação</Text>
          <Heading level={3} family="display">
            Vamos encontrar o plano certo para você?
          </Heading>
          <Text>
            Preencha os dados e receba uma proposta personalizada da nossa
            equipe, sem compromisso.
          </Text>
          <fieldset disabled={submitting} className="home-quote-fields">
            <legend className="sr-only">Dados para a cotação</legend>
            <div className="home-quote-full">
              <FieldLabel id="quote-profile-label">
                Qual é o seu perfil? *
              </FieldLabel>
              <RadioGroup
                aria-labelledby="quote-profile-label"
                name="quote-contract-type"
                value={values.tipoContratacao}
                onValueChange={(value) =>
                  update("tipoContratacao", value as ContractKind)
                }
                orientation="horizontal"
                className="home-quote-profiles"
              >
                {homeAudiences.map(({ kind, label, icon: Icon }) => (
                  <Radio
                    key={kind}
                    value={kind}
                    aria-labelledby={`quote-profile-${kind}`}
                    label={
                      <span>
                        <Icon aria-hidden="true" />
                        <strong id={`quote-profile-${kind}`}>{label}</strong>
                        <small>
                          {kind === "PF"
                            ? "Eu ou minha família"
                            : kind === "MEI"
                              ? "Com CNPJ ativo"
                              : "Para o seu time"}
                        </small>
                      </span>
                    }
                  />
                ))}
              </RadioGroup>
            </div>
            <Field
              label="Quantas pessoas serão incluídas?"
              required
              error={error("quote-lives")}
            >
              <Input
                id="quote-lives"
                type="number"
                min="1"
                max="99"
                step="1"
                inputMode="numeric"
                size="lg"
                placeholder="Ex.: 1, 2 ou 3"
                value={values.numeroVidas}
                onChange={(event) => update("numeroVidas", event.target.value)}
              />
            </Field>
            <Field label="Em qual cidade?" required error={error("quote-city")}>
              <CityAutocomplete
                id="quote-city"
                value={values.cidade}
                onChange={(city) => update("cidade", city)}
              />
            </Field>
            {totalLives === 1 && (
              <Field
                label="Idade da pessoa"
                required
                error={error("quote-age")}
                className="home-quote-full"
              >
                <Input
                  id="quote-age"
                  type="number"
                  min="0"
                  max="120"
                  step="1"
                  inputMode="numeric"
                  size="lg"
                  placeholder="Informe a idade"
                  value={values.idadeTitular}
                  onChange={(event) =>
                    update("idadeTitular", event.target.value)
                  }
                />
              </Field>
            )}
            {totalLives > 1 && (
              <div className="home-quote-full home-age-ranges">
                <div className="home-age-heading">
                  <Text weight="medium">Pessoas por faixa etária *</Text>
                  <Text role="status">
                    {ageTotal} de {totalLives} pessoas
                  </Text>
                </div>
                <div className="home-age-grid">
                  {AGE_RANGES.map((range, index) => (
                    <Field
                      key={range}
                      label={formatAgeRangeLabel(range)}
                      error={index === 0 ? error("quote-range-0") : undefined}
                    >
                      <Input
                        id={`quote-range-${index}`}
                        type="number"
                        min="0"
                        max="99"
                        step="1"
                        inputMode="numeric"
                        placeholder="0"
                        value={ageCounts[range]}
                        onChange={(event) =>
                          updateAge(range, event.target.value)
                        }
                      />
                    </Field>
                  ))}
                </div>
              </div>
            )}
            <Field
              label="Seu nome completo"
              required
              error={error("quote-name")}
            >
              <Input
                id="quote-name"
                type="text"
                autoComplete="name"
                size="lg"
                leftIcon={UserRound}
                placeholder="Digite seu nome"
                value={values.nome}
                onChange={(event) => update("nome", event.target.value)}
              />
            </Field>
            <Field label="Seu WhatsApp" required error={error("quote-phone")}>
              <Input
                id="quote-phone"
                type="tel"
                autoComplete="tel-national"
                size="lg"
                leftIcon={Phone}
                placeholder="(21) 99999-9999"
                value={values.telefone}
                onChange={(event) =>
                  update("telefone", formatPhoneInput(event.target.value))
                }
              />
            </Field>
            <div className="home-honeypot" aria-hidden="true">
              <FieldLabel htmlFor="quote-website">Website</FieldLabel>
              <Input
                id="quote-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              loading={submitting}
              fullWidth
              className="home-quote-full"
            >
              Quero receber minha cotação
              <ChevronRight className="kds-control-icon" aria-hidden="true" />
            </Button>
          </fieldset>
          {feedback && (
            <Text
              className="home-form-feedback"
              role={feedback.kind === "error" ? "alert" : "status"}
              tone={feedback.kind === "error" ? "danger" : "success"}
            >
              {feedback.message}
              {feedback.actionUrl && (
                <LinkButton
                  href={feedback.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="text"
                >
                  Continuar no WhatsApp
                </LinkButton>
              )}
              {feedback.kind === "error" && !feedback.field && (
                <>
                  {" "}
                  <LinkButton
                    href={buildHomeWhatsAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="text"
                  >
                    Falar no WhatsApp
                  </LinkButton>
                </>
              )}
            </Text>
          )}
          <div className="home-quote-privacy">
            <LockKeyhole aria-hidden="true" />
            <Text>Seus dados são usados para atender sua solicitação.</Text>
          </div>
          <PrivacyNotice />
        </form>
      </div>
    </section>
  );
}
