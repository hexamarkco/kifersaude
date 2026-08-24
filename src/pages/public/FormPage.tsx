import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Check, MapPin, MessageCircle, ShieldCheck } from 'lucide-react';

import PublicBrandMark from '../../components/public/PublicBrandMark';
import PublicSeo from '../../components/public/PublicSeo';
import { formsService, type PublicFormSubmitPayload } from '../../lib/formsService';
import { formatPhoneInput } from '../../lib/inputFormatters';
import type { PublicForm, PublicFormGeoPermission, PublicFormStep } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import { Button, Field, getPanelButtonClass, Input, LoadingState, Progress } from '../../design-system';

const DARK_CANVAS_COLOR = '#16110c';
const DEFAULT_THEME_COLOR = '#f4f0e7';
const WHATSAPP_PHONE = '5521979302389';

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

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const previousColor = meta?.getAttribute('content') ?? DEFAULT_THEME_COLOR;
    meta?.setAttribute('content', DARK_CANVAS_COLOR);
    return () => {
      meta?.setAttribute('content', previousColor);
    };
  }, []);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    let mounted = true;
    void formsService.getPublicForm(slug).then((result) => {
      if (!mounted) return;
      setForm(result.form);
      setSteps(result.steps);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [slug]);

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
    <div className="painel-theme kifer-ds theme-dark flex min-h-dvh w-full justify-center overflow-y-auto [background:var(--surface-hero-bg)] px-4 py-10 sm:py-16">
      <PublicSeo
        title={pageTitle}
        description={form?.description || 'Fale com a Kifer Saúde e receba uma cotação personalizada.'}
        canonicalPath={`/forms/${slug ?? ''}`}
      />

      <div className="w-full max-w-md">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <LoadingState compact label="Carregando..." />
          </div>
        ) : !form ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full [background:var(--brand-primary-gradient)] shadow-[var(--shadow-button)]">
              <PublicBrandMark className="h-8 w-auto text-[color:var(--text-on-brand)]" />
            </div>
            <p className="text-sm text-[color:var(--text-secondary)]">Este formulário não está disponível.</p>
          </div>
        ) : submitted ? (
          <div className="form-step-in flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full [background:var(--brand-primary-gradient)] shadow-[var(--shadow-button)]">
              <Check className="h-8 w-8 text-[color:var(--text-on-brand)]" />
            </div>
            <h1 className="font-[var(--font-display)] text-2xl font-bold text-[color:var(--text-primary)]">
              {form.success_headline}
            </h1>
            <p className="max-w-sm text-sm text-[color:var(--text-secondary)]">{form.success_message}</p>
            {form.whatsapp_redirect && form.whatsapp_message_template && (
              <a
                href={buildWhatsAppUrl(form.whatsapp_message_template, contact.name.trim())}
                target="_blank"
                rel="noopener noreferrer"
                className={getPanelButtonClass({ variant: 'primary', size: 'lg' })}
              >
                <MessageCircle className="h-4 w-4" />
                <span>Continuar no WhatsApp</span>
              </a>
            )}
            <a
              href="/"
              className="mt-2 flex items-center gap-2 text-xs font-medium text-[color:var(--text-muted)] transition hover:text-[color:var(--brand-primary)]"
            >
              <PublicBrandMark className="h-4 w-auto" />
              Kifer Saúde
            </a>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <PublicBrandMark className="h-7 w-auto text-[color:var(--brand-primary)]" />
              <Progress value={stepIndex + 1} max={totalSteps} showLabel />
            </div>

            <div key={stepIndex} className="form-step-in space-y-5">
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
                <button
                  type="button"
                  onClick={goBack}
                  className="mx-auto flex items-center gap-1.5 text-xs font-medium text-[color:var(--text-muted)] transition hover:text-[color:var(--brand-primary)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes form-step-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .form-step-in {
          animation: form-step-fade-in 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .form-step-in { animation: none; }
        }
      `}</style>
    </div>
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
        <h1 className="font-[var(--font-display)] text-xl font-bold text-[color:var(--text-primary)] sm:text-2xl">
          {step.title}
        </h1>
        {step.description && <p className="mt-1.5 text-sm text-[color:var(--text-secondary)]">{step.description}</p>}
      </div>

      {step.step_type === 'single_choice' && (
        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={step.title}>
          {step.options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() => onSelectSingle(option.id)}
              className={getPanelButtonClass({ variant: 'secondary', size: 'lg', fullWidth: true, className: 'justify-start text-left' })}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {step.step_type === 'multi_choice' && (
        <div className="space-y-2.5">
          {step.options.map((option) => {
            const checked = multiDraft.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={checked}
                onClick={() => onToggleMulti(option.id)}
                className={getPanelButtonClass({
                  variant: checked ? 'primary' : 'secondary',
                  size: 'lg',
                  fullWidth: true,
                  className: 'justify-between text-left',
                })}
              >
                <span>{option.label}</span>
                {checked && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
          <Button onClick={onConfirmMulti} fullWidth size="lg" className="mt-1">
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
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full [background:var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
        <MapPin className="h-7 w-7" />
      </div>
      <div>
        <h1 className="font-[var(--font-display)] text-xl font-bold text-[color:var(--text-primary)] sm:text-2xl">
          Compartilhar sua localização?
        </h1>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-[color:var(--text-secondary)]">
          Isso ajuda a agilizar seu atendimento com uma equipe mais próxima de você. É totalmente opcional.
        </p>
      </div>
      <div className="space-y-2.5">
        <Button onClick={onShare} loading={geo.requesting} fullWidth size="lg">
          {!geo.requesting && <MapPin className="h-4 w-4" />}
          <span>{geo.requesting ? 'Solicitando...' : 'Compartilhar localização'}</span>
        </Button>
        <button
          type="button"
          onClick={onSkip}
          disabled={geo.requesting}
          className="mx-auto flex items-center justify-center text-xs font-medium text-[color:var(--text-muted)] transition hover:text-[color:var(--brand-primary)] disabled:opacity-50"
        >
          Pular esta etapa
        </button>
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
        <h1 className="font-[var(--font-display)] text-xl font-bold text-[color:var(--text-primary)] sm:text-2xl">
          {step?.title || 'Quase lá! Como podemos te chamar?'}
        </h1>
        {step?.description && <p className="mt-1.5 text-sm text-[color:var(--text-secondary)]">{step.description}</p>}
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
        {!submitting && <ShieldCheck className="h-4 w-4" />}
        <span>{submitting ? 'Enviando...' : 'Enviar'}</span>
      </Button>
    </form>
  );
}
