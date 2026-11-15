import assert from "node:assert/strict";
import { test } from "vitest";
import municipalities from "../../data/municipios.json";
import { indexMunicipalities, searchMunicipalities } from "../municipalities";

const cities = indexMunicipalities(municipalities);
test("IBGE snapshot has unique locality IDs, names and every UF", () => {
  assert.equal(cities.length, 5571);
  assert.equal(new Set(cities.map((city) => city.id)).size, cities.length);
  assert.equal(new Set(cities.map((city) => city.uf)).size, 27);
  assert.ok(cities.every((city) => city.name && city.state));
});
test("search ignores accents, prioritizes a matching city and supports UF or full state", () => {
  assert.equal(
    searchMunicipalities(cities, "sao paulo sp").results[0]?.id,
    "3550308",
  );
  assert.equal(
    searchMunicipalities(cities, "rio de janeiro").results[0]?.name,
    "Rio de Janeiro",
  );
  assert.equal(searchMunicipalities(cities, "santa catarina").total, 295);
  assert.ok(
    searchMunicipalities(cities, "SP").results.every(
      (city) => city.uf === "SP",
    ),
  );
  assert.ok(
    searchMunicipalities(cities, "niteroi").results.some(
      (city) => city.name === "Niterói",
    ),
  );
});
test("homonymous cities stay distinguishable and empty searches never dump all results", () => {
  const results = searchMunicipalities(cities, "bom jesus").results;
  assert.ok(new Set(results.map((city) => city.uf)).size > 1);
  assert.equal(searchMunicipalities(cities, "  ").total, 0);
  assert.equal(searchMunicipalities(cities, "zzzzzzzz").total, 0);
  assert.equal(searchMunicipalities(cities, "sao", 7).results.length, 7);
});
