import { useMemo, useState } from "react";
import { loadPublicMunicipalities } from "../data/publicLocations";
import {
  searchMunicipalities,
  type IndexedMunicipality,
} from "../domain/municipalities";

let cachedCities: Promise<IndexedMunicipality[]> | undefined;
export function useCitySuggestions(query: string) {
  const [cities, setCities] = useState<IndexedMunicipality[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const load = async () => {
    if (status === "loading" || status === "ready") return;
    setStatus("loading");
    try {
      cachedCities ??= loadPublicMunicipalities().catch((error) => {
        cachedCities = undefined;
        throw error;
      });
      setCities(await cachedCities);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };
  const matches = useMemo(
    () => searchMunicipalities(cities, query),
    [cities, query],
  );
  return { ...matches, status, load };
}
