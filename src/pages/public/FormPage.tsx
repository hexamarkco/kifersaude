import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Check, MapPin, MessageCircle, Moon, RefreshCw, ShieldCheck, Sun } from 'lucide-react';

import PublicBrandMark from '../../components/public/PublicBrandMark';
import PublicSeo from '../../components/public/PublicSeo';
import { formsService, type PublicFormSubmitPayload } from '../../lib/formsService';
import { formatPhoneInput } from '../../lib/inputFormatters';
import type { PublicForm, PublicFormGeoPermission, PublicFormStep } from '../../features/public-content';
import { toast } from '../../lib/toast';
import {
  Button,
  Field,
  Heading,
  KIFER_THEME_COLORS,
  IconButton,
  Input,
  LinkButton,
  LoadingState,
  PublicEmptyState,
  PublicShell,
  Stepper,
  Text,
  TextLink,
} from '../../design-system';

const DARK_CANVAS_COLOR = KIFER_THEME_COLORS.darkCanvas;
const LIGHT_CANVAS_COLOR = KIFER_THEME_COLORS.lightCanvas;
const WHATSAPP_PHONE = '5521979302389';
const THEME_STORAGE_KEY = 'kifer-forms-theme';
const MIN_STEP_WIDTH_PX = 44;
const MIN_STEPPER_WIDTH_PX = 180;

type FormTheme = 'light' | 'dark';

const getInitialTheme = (): FormTheme => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private browsing / storage blocked — fall through to system preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

type ContactFormState = { name: string; phone: string; email: string };
type GeoState = {
  permission: PublicFormGeoPermission;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  requesting: boolean;
};

type WizardEntry = { kind: 'question'; step: PublicFormStep } | { kind: 'geo' } | { kind: 'contact' };

const EMPTY_CONTACT: ContactFormState = { name: '', phone: '', email: '' };
const EMPTY_GEO: GeoState = { permission: 'not_requested', latitude: null, longitude: null, accuracyMeters: null, requesting: false };

const buildWhatsAppUrl = (template: string, name: string) =>
  `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(template.replace(/\{\{\s*nome\s*\}\}/gi, name))}`;

export default function FormPage() {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [form, setForm] = useState<PublicForm | null>(null);
  const [steps, setSteps] = useState<PublicFormStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [textDraft, setTextDraft] = useState('');
  const [multiDraft, setMultiDraft] = useState<string[]>([]);
  const [contact, setContact] = useState<ContactFormState>(EMPTY_CONTACT);
  const [geo, setGeo] = useState<GeoState>(EMPTY_GEO);
  const [honeypot, setHoneypot] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [theme, setTheme] = useState<FormTheme>(getInitialTheme);
  const originalThemeColorRef = useRef<string | null>(null);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    originalThemeColorRef.current = meta?.getAttribute('content') ?? LIGHT_CANVAS_COLOR;
    return () => {
      meta?.setAttribute('content', originalThemeColorRef.current ?? LIGHT_CANVAS_COLOR);
    };
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'dark' ? DARK_CANVAS_COLOR : LIGHT_CANVAS_COLOR);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: FormTheme = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Private browsing / storage blocked — the choice just won't persist.
      }
      return next;
    });
  };

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setLoadError(false);
    setForm(null);
    setSteps([]);
    setStepIndex(0);
    setAnswers({});
    setTextDraft('');
    setMultiDraft([]);
    setContact(EMPTY_CONTACT);
    setGeo(EMPTY_GEO);
    setHoneypot('');
    setSubmitted(false);

    void formsService.getPublicForm(slug)
      .then((result) => {
        if (!mounted) return;
        setForm(result.form);
        setSteps(result.steps);
      })
      .catch((error) => {
        if (!mounted) return;
        console.error('Erro ao carregar formulário público:', error);
        setLoadError(true);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [loadAttempt, slug]);

  const sequence = useMemo<WizardEntry[]>(() => {
    const questions = steps.filter((step) => step.step_type !== 'contact');
    const entries: WizardEntry[] = questions.map((step) => ({ kind: 'question', step }));
    if (form?.request_geolocation) {
      entries.push({ kind: 'geo' });
    }
    entries.push({ kind: 'contact' });
    return entries;
  }, [steps, form]);

  const totalSteps = sequence.length;
  const current = sequence[stepIndex];

  const syncDraftFromAnswer = (entry: WizardEntry | undefined) => {
    if (!entry || entry.kind !== 'question') return;
    if (entry.step.step_type === 'short_text') {
      const value = answers[entry.step.id];
      setTextDraft(typeof value === 'string' ? value : '');
    } else if (entry.step.step_type === 'multi_choice') {
      const value = answers[entry.step.id];
      setMultiDraft(Array.isArray(value) ? value : []);
    }
  };

  const goTo = (index: number) => {
    setStepIndex(index);
    syncDraftFromAnswer(sequence[index]);
  };

  const goNext = () => {
    if (stepIndex < totalSteps - 1) goTo(stepIndex + 1);
  };

  const goBack = () => {
    if (stepIndex > 0) goTo(stepIndex - 1);
  };

  const handleSelectSingle = (step: PublicFormStep, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [step.id]: optionId }));
    window.setTimeout(() => goNext(), 260);
  };

  const toggleMultiOption = (optionId: string) => {
    setMultiDraft((prev) => (prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]));
  };

  const confirmMultiChoice = (step: PublicFormStep) => {
    if (step.is_required && multiDraft.length === 0) {
      toast.warning('Selecione ao menos uma opção para continuar.');
      return;
    }
    setAnswers((prev) => ({ ...prev, [step.id]: multiDraft }));
    goNext();
  };

  const confirmShortText = (step: PublicFormStep) => {
    const trimmed = textDraft.trim();
    if (step.is_required && trimmed.length === 0) {
      toast.warning('Preencha o campo para continuar.');
      return;
    }
    setAnswers((prev) => ({ ...prev, [step.id]: trimmed }));
    goNext();
  };

  const requestGeolocation = () => {
    if (!('geolocation' in navigator)) {
      setGeo({ ...EMPTY_GEO, permission: 'unavailable' });
      goNext();
      return;
    }

    setGeo((prev) => ({ ...prev, requesting: true }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          permission: 'granted',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? null,
          requesting: false,
        });
        goNext();
      },
      (error) => {
        setGeo({
          ...EMPTY_GEO,
          permission: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
        });
        goNext();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const skipGeolocation = () => {
    setGeo((prev) => ({ ...prev, requesting: false }));
    goNext();
  };

  const handleFinalSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !form) return;

    const name = contact.name.trim();
    const phone = contact.phone.replace(/\D/g, '');
    const email = contact.email.trim();

    if (name.length < 3) {
      toast.warning('Preencha seu nome completo para continuar.');
      return;
    }
    if (phone.length < 10) {
      toast.warning('Preencha um WhatsApp válido para continuar.');
      return;
    }

    setSubmitting(true);

    const payload: PublicFormSubmitPayload = {
      formSlug: form.slug,
      answers,
      contact: { name, phone, email: email.length > 0 ? email : null },
      geo: {
        permission: geo.permission,
        latitude: geo.permission === 'granted' ? geo.latitude : null,
        longitude: geo.permission === 'granted' ? geo.longitude : null,
        accuracyMeters: geo.permission === 'granted' ? geo.accuracyMeters : null,
      },
      website: honeypot,
    };

    const result = await formsService.submitPublicForm(payload);
    setSubmitting(false);

    if (!result.success) {
      toast.error('Não foi possível enviar suas respostas. Tente novamente em instantes.');
      return;
    }

    setSubmitted(true);
  };

  const pageTitle = form?.title || 'Kifer Saúde';

  return (
    <PublicShell
      theme={theme}
      width="narrow"
      className="relative flex min-h-dvh w-full justify-center overflow-y-auto px-4 py-10 sm:py-16"
    >
      <PublicSeo
        title={pageTitle}
        description={form?.description || 'Fale com a Kifer Saúde e receba uma cotação personalizada.'}
        canonicalPath={`/forms/${slug ?? ''}`}
        indexable={false}
      />

      <IconButton
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        size="sm"
        className="kds-public-theme-toggle absolute right-4 top-4 z-10 sm:right-6 sm:top-6"
      >
        {theme === 'dark' ? <Sun className="kds-control-icon" /> : <Moon className="kds-control-icon" />}
      </IconButton>

      <main className="w-full max-w-md">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <LoadingState compact label="Carregando..." />
          </div>
        ) : loadError ? (
          <PublicEmptyState
            icon={<PublicBrandMark className="kds-public-brand-mark kds-public-brand-mark-md" />}
            title="Não foi possível carregar este formulário."
            description="Verifique sua conexão e tente novamente."
          >
            <Button variant="secondary" size="sm" onClick={() => setLoadAttempt((current) => current + 1)}>
              <RefreshCw className="kds-control-icon" />
              <span>Tentar novamente</span>
            </Button>
          </PublicEmptyState>
        ) : !form ? (
          <PublicEmptyState
            icon={<PublicBrandMark className="kds-public-brand-mark kds-public-brand-mark-md" />}
            title="Este formulário não está disponível."
          />
        ) : submitted ? (
          <div className="kds-form-step-in flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
            <div className="kds-public-success-state">
              <Check className="kds-public-success-icon" />
            </div>
            <Heading level={1} size="lg">
              {form.success_headline}
            </Heading>
            <Text size="sm" className="max-w-sm">{form.success_message}</Text>
            {form.whatsapp_redirect && form.whatsapp_message_template && (
              <LinkButton
                href={buildWhatsAppUrl(form.whatsapp_message_template, contact.name.trim())}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="lg"
              >
                <MessageCircle className="kds-control-icon" />
                <span>Continuar no WhatsApp</span>
              </LinkButton>
            )}
            <TextLink
              href="/"
              tone="muted"
              className="kds-public-form-footer-link"
            >
              <PublicBrandMark className="kds-public-brand-mark kds-public-brand-mark-xs" />
              Kifer Saúde
            </TextLink>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
              <PublicBrandMark className="kds-public-brand-mark kds-public-brand-mark-sm mb-1 text-[color:var(--brand-primary)]" />
              <div className="w-full overflow-x-auto">
                <Stepper
                  currentStep={stepIndex}
                  steps={sequence.map(() => ({ label: '' }))}
                  minWidth={Math.max(totalSteps * MIN_STEP_WIDTH_PX, MIN_STEPPER_WIDTH_PX)}
                />
              </div>
              <Text size="xs" weight="medium" tone="muted">
                Etapa {stepIndex + 1} de {totalSteps}
              </Text>
            </div>

            <div key={stepIndex} className="kds-form-step-in space-y-5">
              {current?.kind === 'question' && (
                <QuestionStep
                  step={current.step}
                  textDraft={textDraft}
                  setTextDraft={setTextDraft}
                  multiDraft={multiDraft}
                  onSelectSingle={(optionId) => handleSelectSingle(current.step, optionId)}
                  onToggleMulti={toggleMultiOption}
                  onConfirmMulti={() => confirmMultiChoice(current.step)}
                  onConfirmText={() => confirmShortText(current.step)}
                />
              )}

              {current?.kind === 'geo' && (
                <GeoStep geo={geo} onShare={requestGeolocation} onSkip={skipGeolocation} />
              )}

              {current?.kind === 'contact' && (
                <ContactStep
                  step={steps.find((step) => step.step_type === 'contact') ?? null}
                  contact={contact}
                  setContact={setContact}
                  submitting={submitting}
                  onSubmit={handleFinalSubmit}
                />
              )}

              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
                autoComplete="off"
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none absolute h-0 w-0 opacity-0"
              />

              {stepIndex > 0 && current?.kind !== 'contact' && (
                <Button
                  type="button"
                  onClick={goBack}
                  variant="ghost"
                  size="sm"
                  className="mx-auto"
                >
                  <ArrowLeft className="kds-control-icon" />
                  Voltar
                </Button>
              )}
            </div>
          </>
        )}
      </main>

    </PublicShell>
  );
}

type QuestionStepProps = {
  step: PublicFormStep;
  textDraft: string;
  setTextDraft: (value: string) => void;
  multiDraft: string[];
  onSelectSingle: (optionId: string) => void;
  onToggleMulti: (optionId: string) => void;
  onConfirmMulti: () => void;
  onConfirmText: () => void;
};

function QuestionStep({
  step,
  textDraft,
  setTextDraft,
  multiDraft,
  onSelectSingle,
  onToggleMulti,
  onConfirmMulti,
  onConfirmText,
}: QuestionStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <Heading level={1} size="lg">
          {step.title}
        </Heading>
        {step.description && <Text size="sm" className="mt-1.5">{step.description}</Text>}
      </div>

      {step.step_type === 'single_choice' && (
        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={step.title}>
          {step.options.map((option) => (
            <Button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() => onSelectSingle(option.id)}
              variant="secondary"
              size="lg"
              fullWidth
              className="justify-start text-left"
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}

      {step.step_type === 'multi_choice' && (
        <div className="space-y-2.5">
          {step.options.map((option) => {
            const checked = multiDraft.includes(option.id);
            return (
              <Button
                key={option.id}
                type="button"
                aria-pressed={checked}
                onClick={() => onToggleMulti(option.id)}
                variant={checked ? 'primary' : 'secondary'}
                size="lg"
                fullWidth
                className="justify-between text-left"
              >
                <span>{option.label}</span>
                {checked && <Check className="kds-control-icon shrink-0" />}
              </Button>
            );
          })}
          <Button onClick={onConfirmMulti} fullWidth size="lg">
            Continuar
          </Button>
        </div>
      )}

      {step.step_type === 'short_text' && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirmText();
          }}
        >
          <Input
            autoFocus
            value={textDraft}
            onChange={(event) => setTextDraft(event.target.value)}
            placeholder={step.placeholder ?? 'Digite sua resposta'}
          />
          <Button type="submit" fullWidth size="lg">
            Continuar
          </Button>
        </form>
      )}
    </div>
  );
}

type GeoStepProps = {
  geo: GeoState;
  onShare: () => void;
  onSkip: () => void;
};

function GeoStep({ geo, onShare, onSkip }: GeoStepProps) {
  return (
    <div className="space-y-4 text-center">
      <div className="kds-public-geo-icon mx-auto">
        <MapPin className="kds-public-geo-symbol" />
      </div>
      <div>
        <Heading level={1} size="lg">
          Compartilhar sua localização?
        </Heading>
        <Text size="sm" className="mx-auto mt-1.5 max-w-xs">
          Isso ajuda a agilizar seu atendimento com uma equipe mais próxima de você. É totalmente opcional.
        </Text>
      </div>
      <div className="space-y-2.5">
        <Button onClick={onShare} loading={geo.requesting} fullWidth size="lg">
          {!geo.requesting && <MapPin className="kds-control-icon" />}
          <span>{geo.requesting ? 'Solicitando...' : 'Compartilhar localização'}</span>
        </Button>
        <Button
          type="button"
          onClick={onSkip}
          disabled={geo.requesting}
          variant="ghost"
          size="sm"
          className="mx-auto"
        >
          Pular esta etapa
        </Button>
      </div>
    </div>
  );
}

type ContactStepProps = {
  step: PublicFormStep | null;
  contact: ContactFormState;
  setContact: (updater: (prev: ContactFormState) => ContactFormState) => void;
  submitting: boolean;
  onSubmit: (event: FormEvent) => void;
};

function ContactStep({ step, contact, setContact, submitting, onSubmit }: ContactStepProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="text-center">
        <Heading level={1} size="lg">
          {step?.title || 'Quase lá! Como podemos te chamar?'}
        </Heading>
        {step?.description && <Text size="sm" className="mt-1.5">{step.description}</Text>}
      </div>

      <Field label="Nome completo">
        <Input
          autoFocus
          value={contact.name}
          onChange={(event) => setContact((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Seu nome completo"
        />
      </Field>

      <Field label="WhatsApp">
        <Input
          value={contact.phone}
          onChange={(event) => setContact((prev) => ({ ...prev, phone: formatPhoneInput(event.target.value) }))}
          placeholder="(21) 99999-9999"
          inputMode="tel"
        />
      </Field>

      <Field label="E-mail (opcional)">
        <Input
          type="email"
          value={contact.email}
          onChange={(event) => setContact((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="voce@email.com"
        />
      </Field>

      <Button type="submit" fullWidth size="lg" loading={submitting}>
        {!submitting && <ShieldCheck className="kds-control-icon" />}
        <span>{submitting ? 'Enviando...' : 'Enviar'}</span>
      </Button>
    </form>
  );
}
