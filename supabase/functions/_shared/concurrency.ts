/**
 * Executa `worker` para cada item de `items`, limitando o número de execuções
 * em voo simultaneamente a `concurrency` (pool de workers puxando o próximo
 * índice disponível). Os resultados são retornados na mesma ordem de `items`,
 * independente da ordem real de conclusão.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const poolSize = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    for (;;) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: poolSize }, () => runWorker()));

  return results;
}
