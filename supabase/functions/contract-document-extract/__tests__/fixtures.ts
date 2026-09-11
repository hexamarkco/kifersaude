import type { ParsedPdfDocument } from '../engine/types.ts';

export const syntheticPdf = (
  fileId: string,
  pages: string[],
): ParsedPdfDocument => ({
  fileId,
  fileName: `${fileId}.pdf`,
  hash: `synthetic-${fileId}`,
  bytes: new Uint8Array(),
  pages: pages.map((text, index) => ({
    page: index + 1,
    text,
    characterCount: text.replace(/\s/g, '').length,
  })),
  textQuality: 'good',
  extractionError: null,
});

export const hcommerceCompany = (bundle = 'PJ100001') => syntheticPdf('empresa', [
  `Proposta de Admissão - Coletivo Empresarial
   Assim Saúde ${bundle}
   EMPRESA CONTRATANTE
   Razão Social: EMPRESA EXEMPLO LTDA Nome fantasia: EXEMPLO
   CNPJ: 11.222.333/0001-81
   ENDEREÇO DE FATURAMENTO CEP: 20000-000 Endereço: Rua Exemplo, 100 Cidade / UF: Rio de Janeiro / RJ
   PLANOS ADERIDOS PELA EMPRESA`,
]);

export const hcommerceBeneficiaries = (bundle = 'PJ100001') => syntheticPdf('beneficiarios', [
  `Proposta de Admissão - Coletivo Empresarial
   Assim Saúde ${bundle}
   DADOS DO BENEFICIÁRIO TITULAR
   Nome Completo: Pessoa Exemplo CPF: 529.982.247-25 Data de Nascimento: 01/02/1980
   Plano: ASSIM CLASSIC Código ANS: 123456 Cobertura: ambulatorial
   Acomodação: ENFERMARIA
   Condição de carência: Reduzida Profissão: Analista
   Total de dependentes: 2
   INFORMAÇÕES SOBRE O PAGAMENTO
   Valor do Plano Contratado: R$ 1.234,56`,
]);

