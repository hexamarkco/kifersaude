import { indexMunicipalities } from "../domain/municipalities";

// Snapshot of the official IBGE Localidades API, 2026-11-14; see municipios.SOURCES.md.
// The module is fetched only when the visitor interacts with the city field.
export const loadPublicMunicipalities = () =>
  import("./municipios.json").then(({ default: cities }) =>
    indexMunicipalities(cities),
  );
