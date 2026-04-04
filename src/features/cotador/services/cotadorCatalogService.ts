import { configService } from '../../../lib/configService';
import type { Operadora, ProdutoPlano } from '../../../lib/supabase';
import type { CotadorCatalogItem } from '../shared/cotadorTypes';

const toNullableNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const compareCatalogItems = (left: CotadorCatalogItem, right: CotadorCatalogItem) => {
  const operadoraComparison = (left.operadora.name ?? '').localeCompare(right.operadora.name ?? '', 'pt-BR');
  if (operadoraComparison !== 0) {
    return operadoraComparison;
  }

  if (left.source !== right.source) {
    return left.source === 'produto' ? -1 : 1;
  }

  return left.titulo.localeCompare(right.titulo, 'pt-BR');
};

const buildProdutoCatalogItem = (produto: ProdutoPlano, operadora: Operadora | null): CotadorCatalogItem => ({
  id: `produto:${produto.id}`,
  source: 'produto',
  titulo: produto.nome,
  subtitulo: produto.modalidade?.trim() || 'Produto catalogado',
  operadora: {
    id: operadora?.id ?? produto.operadora_id,
    name: operadora?.nome ?? 'Operadora nao encontrada',
    active: operadora?.ativo ?? false,
  },
  administradora: null,
  entidadeClasse: null,
  modalidade: produto.modalidade?.trim() || null,
  abrangencia: produto.abrangencia?.trim() || null,
  acomodacao: produto.acomodacao?.trim() || null,
  comissaoSugerida: toNullableNumber(produto.comissao_sugerida),
  bonusPorVidaValor: toNullableNumber(produto.bonus_por_vida_valor),
  observacao: null,
  ativo: Boolean(produto.ativo && operadora?.ativo !== false),
});

const buildOperadoraFallbackItem = (operadora: Operadora): CotadorCatalogItem => ({
  id: `operadora:${operadora.id}`,
  source: 'operadora',
  titulo: operadora.nome,
  subtitulo: 'Carteira comercial ativa',
  operadora: {
    id: operadora.id,
    name: operadora.nome,
    active: operadora.ativo,
  },
  administradora: null,
  entidadeClasse: null,
  modalidade: null,
  abrangencia: null,
  acomodacao: null,
  comissaoSugerida: toNullableNumber(operadora.comissao_padrao),
  bonusPorVidaValor: toNullableNumber(operadora.bonus_padrao),
  observacao: operadora.observacoes?.trim() || null,
  ativo: operadora.ativo,
});

export async function loadCotadorCatalog(): Promise<CotadorCatalogItem[]> {
  const [operadoras, produtos] = await Promise.all([
    configService.getOperadoras(),
    configService.getProdutosPlanos(),
  ]);

  const operadoraById = new Map(operadoras.map((operadora) => [operadora.id, operadora]));
  const activeOperadoras = operadoras.filter((operadora) => operadora.ativo);
  const productItems = produtos
    .map((produto) => buildProdutoCatalogItem(produto, operadoraById.get(produto.operadora_id) ?? null))
    .filter((item) => item.ativo);

  const coveredOperadoraIds = new Set(productItems.map((item) => item.operadora.id));
  const fallbackItems = activeOperadoras
    .filter((operadora) => !coveredOperadoraIds.has(operadora.id))
    .map(buildOperadoraFallbackItem);

  return [...productItems, ...fallbackItems].sort(compareCatalogItems);
}
