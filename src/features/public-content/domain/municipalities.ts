export type Municipality = {
  id: string;
  name: string;
  uf: string;
  state: string;
};
export type IndexedMunicipality = Municipality & {
  normalizedName: string;
  search: string;
};

export const normalizeLocationSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const indexMunicipalities = (
  cities: readonly Municipality[],
): IndexedMunicipality[] =>
  cities.map((city) => ({
    ...city,
    normalizedName: normalizeLocationSearch(city.name),
    search: normalizeLocationSearch(`${city.name} ${city.uf} ${city.state}`),
  }));

const stateCodes = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
    .toLowerCase()
    .split(" "),
);

/** City matches precede state matches; UF tokens always refer to the exact state. */
export function searchMunicipalities(
  cities: readonly IndexedMunicipality[],
  query: string,
  limit = 50,
) {
  const terms = normalizeLocationSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return { results: [], total: 0 };
  const matches = cities
    .filter((city) =>
      terms.every((term) =>
        stateCodes.has(term)
          ? city.uf.toLowerCase() === term
          : city.search.includes(term),
      ),
    )
    .map((city) => ({
      city,
      score: terms.filter((term) => city.normalizedName.includes(term)).length,
    }))
    .sort((a, b) => b.score - a.score);
  return {
    results: matches.slice(0, limit).map((match) => match.city),
    total: matches.length,
  };
}
