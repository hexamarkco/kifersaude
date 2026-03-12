import assert from "node:assert/strict";
import { test } from "vitest";

import {
  buildBlogPostPayload,
  createEmptyBlogFormData,
  estimateBlogReadTime,
  filterBlogPosts,
  generateBlogSlug,
  mapBlogPostToFormData,
} from "../blogUtils";
import type { BlogPost } from "../blogTypes";

const samplePost: BlogPost = {
  id: "post-1",
  title: "Plano de Saude para PME",
  slug: "plano-de-saude-para-pme",
  excerpt: "Resumo do artigo",
  content: "<p>Conteudo</p>",
  category: "Guias",
  read_time: "3 min",
  author_id: "user-1",
  published: true,
  created_at: "2026-03-12T10:00:00.000Z",
  updated_at: "2026-03-12T10:00:00.000Z",
  views_count: 12,
  meta_title: "",
  meta_description: "",
};

test("generateBlogSlug removes accents and separators", () => {
  assert.equal(
    generateBlogSlug("Plano Empresarial: Sao Paulo & Regiao"),
    "plano-empresarial-sao-paulo-regiao",
  );
});

test("estimateBlogReadTime keeps at least one minute", () => {
  assert.equal(estimateBlogReadTime("<p>texto curto</p>"), "1 min");
});

test("filterBlogPosts searches by title and category", () => {
  assert.deepEqual(filterBlogPosts([samplePost], "guias"), [samplePost]);
  assert.deepEqual(filterBlogPosts([samplePost], "pme"), [samplePost]);
  assert.deepEqual(filterBlogPosts([samplePost], "economia"), []);
});

test("blog form helpers keep editor payloads aligned", () => {
  const emptyFormData = createEmptyBlogFormData();
  const mappedFormData = mapBlogPostToFormData(samplePost);
  const payload = buildBlogPostPayload({
    authorId: "user-99",
    formData: { ...emptyFormData, ...mappedFormData, published: false },
    now: new Date("2026-03-12T15:30:00.000Z"),
  });

  assert.equal(emptyFormData.category, "Guias");
  assert.equal(mappedFormData.meta_title, samplePost.title);
  assert.equal(mappedFormData.meta_description, samplePost.excerpt);
  assert.equal(payload.author_id, "user-99");
  assert.equal(payload.published_at, null);
});
