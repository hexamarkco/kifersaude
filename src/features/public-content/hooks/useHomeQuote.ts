import { useRef, useState, type FormEvent } from "react";
import {
  submitPublicLead,
  type PublicLeadSubmission,
} from "../data/publicLeadApi";
import {
  AGE_RANGES,
  buildHomeWhatsAppUrl,
  createInitialAgeRangeCounts,
  formatAgeRangeLabel,
  type ContractKind,
} from "../domain/homeContent";
import { toast } from "../../../lib/toast";

type QuoteValues = {
  nome: string;
  telefone: string;
  cidade: string;
  tipoContratacao: ContractKind;
  numeroVidas: string;
  idadeTitular: string;
};
const initialValues: QuoteValues = {
  nome: "",
  telefone: "",
  cidade: "",
  tipoContratacao: "PF",
  numeroVidas: "",
  idadeTitular: "",
};
type QuoteFeedback = {
  kind: "error" | "success";
  message: string;
  field?: string;
  actionUrl?: string;
} | null;

/** Homepage controller: keeps the existing public-lead-submit contract and age rules. */
export function useHomeQuote() {
  const [values, setValues] = useState(initialValues);
  const [ageCounts, setAgeCounts] = useState(createInitialAgeRangeCounts);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<QuoteFeedback>(null);
  const submittingRef = useRef(false);
  const totalLives = Number.parseInt(values.numeroVidas, 10) || 0;
  const filledRanges = Object.entries(ageCounts)
    .map(([range, count]) => ({ range, quantity: Number.parseInt(count, 10) }))
    .filter(({ quantity }) => Number.isFinite(quantity) && quantity > 0);
  const ageTotal = filledRanges.reduce((sum, item) => sum + item.quantity, 0);
  const update = <K extends keyof QuoteValues>(
    key: K,
    value: QuoteValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFeedback(null);
  };
  const updateAge = (range: string, value: string) => {
    setAgeCounts((current) => ({
      ...current,
      [range]: value.replace(/\D/g, ""),
    }));
    setFeedback(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const form = event.currentTarget;
    const name = values.nome.trim();
    const city = values.cidade.trim();
    const digits = values.telefone.replace(/\D/g, "");
    const phone =
      digits.startsWith("55") && digits.length > 11
        ? digits.slice(2, 13)
        : digits.slice(0, 11);
    const website = new FormData(form).get("website");
    const fail = (message: string, field: string) => {
      setFeedback({ kind: "error", message, field });
      form.querySelector<HTMLElement>(`#${field}`)?.focus();
      toast.warning(message);
    };
    if (name.length < 3)
      return fail("Preencha seu nome completo para continuar.", "quote-name");
    if (phone.length < 10)
      return fail("Preencha um WhatsApp válido para continuar.", "quote-phone");
    if (city.length < 2)
      return fail("Informe sua cidade para montar a cotação.", "quote-city");
    if (totalLives < 1)
      return fail(
        "Informe quantas pessoas vão entrar no plano.",
        "quote-lives",
      );
    if (totalLives > 99)
      return fail(
        "Informe no máximo 99 pessoas para este plano.",
        "quote-lives",
      );
    if (totalLives > 1 && filledRanges.length === 0)
      return fail(
        "Distribua as pessoas nas faixas etárias para continuar.",
        "quote-range-0",
      );
    if (totalLives > 1 && ageTotal !== totalLives)
      return fail(
        "A soma das pessoas nas faixas etárias precisa ser igual ao total informado.",
        "quote-range-0",
      );
    if (totalLives === 1 && !values.idadeTitular.trim())
      return fail("Informe a idade da pessoa para prosseguir.", "quote-age");
    const holderAge = Number(values.idadeTitular);
    if (
      totalLives === 1 &&
      (!Number.isInteger(holderAge) || holderAge < 0 || holderAge > 120)
    )
      return fail("Informe uma idade válida para prosseguir.", "quote-age");

    const payload: PublicLeadSubmission = {
      name,
      phone,
      city,
      contractType: values.tipoContratacao,
      totalLives,
      ageSummary:
        totalLives === 1
          ? { type: "single", age: holderAge }
          : {
              type: "ranges",
              counts: Object.fromEntries(
                AGE_RANGES.map((range) => [
                  range.replace(/\s+/g, ""),
                  Number.parseInt(ageCounts[range], 10) || 0,
                ]),
              ),
            },
      website: typeof website === "string" ? website : "",
    };
    submittingRef.current = true;
    setSubmitting(true);
    setFeedback(null);
    try {
      await submitPublicLead(payload);
      const agesText =
        totalLives === 1
          ? `uma pessoa com ${holderAge} ${holderAge === 1 ? "ano" : "anos"}`
          : `${totalLives} pessoas, sendo ${filledRanges.map(({ range, quantity }) => `${quantity} ${quantity === 1 ? "pessoa" : "pessoas"} na faixa de ${formatAgeRangeLabel(range)}`).join(", ")}`;
      const message = [
        "Olá! Acabei de preencher a cotação no site da Kifer.",
        `Meu nome é ${name}.`,
        `Minha cidade é ${city}.`,
        `Quero cotar ${values.tipoContratacao === "PF" ? "como pessoa física" : values.tipoContratacao === "MEI" ? "como MEI" : "para minha empresa"}.`,
        `O plano será para ${agesText}.`,
      ].join("\n");
      window.open(
        buildHomeWhatsAppUrl(message),
        "_blank",
        "noopener,noreferrer",
      );
      const success =
        "Pedido de cotação enviado. Continue no WhatsApp para falar com a Kifer.";
      setFeedback({
        kind: "success",
        message: success,
        actionUrl: buildHomeWhatsAppUrl(message),
      });
      toast.success(success);
      setValues(initialValues);
      setAgeCounts(createInitialAgeRangeCounts());
    } catch {
      const message =
        "Não foi possível enviar seu pedido de cotação agora. Tente novamente ou fale no WhatsApp.";
      setFeedback({ kind: "error", message });
      toast.error(message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  return {
    values,
    ageCounts,
    totalLives,
    ageTotal,
    update,
    updateAge,
    submitting,
    feedback,
    onSubmit,
  };
}
