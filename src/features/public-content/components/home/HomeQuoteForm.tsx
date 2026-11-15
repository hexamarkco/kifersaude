import {
  ArrowUpRight,
  CheckCheck,
  HeartHandshake,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import {
  Button,
  Field,
  Heading,
  Image,
  Input,
  LinkButton,
  Radio,
  RadioGroup,
  Select,
  Text,
  TextLink,
} from "../../../../design-system";
import { formatPhoneInput } from "../../../../lib/inputFormatters";
import {
  AGE_RANGES,
  buildHomeWhatsAppUrl,
  formatAgeRangeLabel,
  homeAudiences,
  homePhotos,
  type ContractKind,
} from "../../domain/homeContent";
import type { useHomeQuote } from "../../hooks/useHomeQuote";
import HomeCityAutocomplete from "./HomeCityAutocomplete";

type Quote = ReturnType<typeof useHomeQuote>;

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
  const manyLives = totalLives !== 1 && totalLives !== 2;
  return (
    <section className="quote" id="cotacao" aria-labelledby="quote-title">
      <div className="wrap quote-grid">
        <div>
          <Text className="eyebrow">Seu próximo passo</Text>
          <Heading family="display" id="quote-title">
            Vamos encontrar
            <br />o plano que faz
            <br />
            sentido para você?
          </Heading>
          <Text className="lead">
            Conte um pouco do que precisa. Nossa equipe prepara as opções para
            você comparar, com orientação e sem compromisso.
          </Text>
          <div className="quote-benefits">
            <div>
              <ShieldCheck aria-hidden="true" />
              Condições verificadas para o seu perfil.
            </div>
            <div>
              <HeartHandshake aria-hidden="true" />
              Atendimento próximo em cada etapa.
            </div>
            <div>
              <CheckCheck aria-hidden="true" />
              Cotação gratuita e sem pressão.
            </div>
          </div>
          <div className="quote-photo">
            <Image
              src={homePhotos.quote}
              alt="Família reunida em casa"
              width={1448}
              height={1086}
              loading="lazy"
            />
          </div>
          <Text className="quote-photo-note">
            O melhor ponto de partida é conhecer a sua rotina.
            <br />A escolha vem depois, com todas as informações.
          </Text>
        </div>
        <form
          className="quote-card"
          onSubmit={onSubmit}
          aria-label="Solicite sua cotação"
          aria-busy={submitting}
          noValidate
        >
          <Text className="form-top">Solicite sua cotação</Text>
          <Heading family="display" level={3}>
            Primeiro, vamos conhecer você.
          </Heading>
          <Text>
            Preencha os dados abaixo para receber uma proposta personalizada.
          </Text>
          <fieldset disabled={submitting} className="fields">
            <legend className="sr-only">Dados para a cotação</legend>
            <fieldset className="profile-fieldset full">
              <legend className="form-label">Qual é o seu perfil?</legend>
              <RadioGroup
                className="profile-selector"
                name="quote-contract-type"
                aria-label="Perfil da cotação"
                value={values.tipoContratacao}
                onValueChange={(value) =>
                  update("tipoContratacao", value as ContractKind)
                }
                orientation="horizontal"
                disabled={submitting}
              >
                {homeAudiences.map(({ kind, label, icon: Icon }) => (
                  <Radio
                    key={kind}
                    value={kind}
                    label={
                      <span>
                        <Icon aria-hidden="true" />
                        {label}
                      </span>
                    }
                  />
                ))}
              </RadioGroup>
            </fieldset>
            <Field
              label="Quantas pessoas?"
              required
              error={error("quote-lives")}
              className="field"
            >
              <Select
                id="quote-lives"
                size="lg"
                value={manyLives ? "many" : values.numeroVidas}
                onChange={(event) =>
                  update(
                    "numeroVidas",
                    event.target.value === "many" ? "3" : event.target.value,
                  )
                }
                options={[
                  { value: "1", label: "1 pessoa" },
                  { value: "2", label: "2 pessoas" },
                  { value: "many", label: "3 ou mais pessoas" },
                ]}
              />
            </Field>
            <Field
              label="Em qual cidade?"
              required
              error={error("quote-city")}
              className="field"
            >
              <HomeCityAutocomplete
                id="quote-city"
                value={values.cidade}
                onChange={(city) => update("cidade", city)}
                disabled={submitting}
              />
            </Field>
            {manyLives && (
              <Field
                label="Total de pessoas"
                required
                className="field full"
                hint="Informe de 3 a 99 pessoas."
              >
                <Input
                  id="quote-total-lives"
                  type="number"
                  size="lg"
                  min="3"
                  max="99"
                  step="1"
                  inputMode="numeric"
                  value={values.numeroVidas}
                  onChange={(event) =>
                    update("numeroVidas", event.target.value)
                  }
                />
              </Field>
            )}
            {totalLives === 1 && (
              <Field
                label="Qual a idade de quem vai participar?"
                required
                error={error("quote-age")}
                className="field full"
              >
                <Input
                  id="quote-age"
                  type="number"
                  size="lg"
                  min="0"
                  max="120"
                  step="1"
                  inputMode="numeric"
                  placeholder="Informe a idade"
                  value={values.idadeTitular}
                  onChange={(event) =>
                    update("idadeTitular", event.target.value)
                  }
                />
              </Field>
            )}
            {totalLives > 1 && (
              <div className="full home-age-ranges">
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
                      className="field"
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
              label="Como podemos chamar você?"
              required
              error={error("quote-name")}
              className="field full"
            >
              <Input
                id="quote-name"
                size="lg"
                type="text"
                autoComplete="name"
                placeholder="Seu nome completo"
                value={values.nome}
                onChange={(event) => update("nome", event.target.value)}
              />
            </Field>
            <Field
              label="Seu WhatsApp"
              required
              error={error("quote-phone")}
              className="field full"
            >
              <Input
                id="quote-phone"
                size="lg"
                type="tel"
                autoComplete="tel-national"
                placeholder="(21) 99999-9999"
                value={values.telefone}
                onChange={(event) =>
                  update("telefone", formatPhoneInput(event.target.value))
                }
              />
            </Field>
            <div className="home-honeypot" aria-hidden="true">
              <Input
                name="website"
                id="quote-website"
                aria-label="Website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              fullWidth
              className="button full"
              loading={submitting}
            >
              {submitting ? "Enviando…" : "Receber minha cotação"}
              <ArrowUpRight aria-hidden="true" />
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
                <LinkButton
                  href={buildHomeWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="text"
                >
                  Falar no WhatsApp
                </LinkButton>
              )}
            </Text>
          )}
          <div className="privacy-note">
            <LockKeyhole aria-hidden="true" />
            <Text>
              Ao enviar, você solicita contato para uma cotação. Saiba como
              usamos seus dados na{" "}
              <TextLink
                href="/politica-de-privacidade"
                target="_blank"
                rel="noopener noreferrer"
              >
                Política de Privacidade
                <span className="sr-only"> (abre em nova aba)</span>
              </TextLink>
              .
            </Text>
          </div>
        </form>
      </div>
    </section>
  );
}
