export async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize = 1_000,
): Promise<T[]> {
  const allData: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      throw error;
    }

    const page = data ?? [];
    allData.push(...page);
    if (page.length < pageSize) {
      return allData;
    }

    from += pageSize;
  }
}
