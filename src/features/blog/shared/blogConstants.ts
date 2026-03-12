import type { BlogPostFormData } from "./blogTypes";

export const BLOG_CATEGORY_OPTIONS = [
  { value: "Guias", label: "Guias" },
  { value: "Dicas", label: "Dicas" },
  { value: "Economia", label: "Economia" },
  { value: "Novidades", label: "Novidades" },
  { value: "Geral", label: "Geral" },
] as const;

export const BLOG_DEFAULT_FORM_DATA: BlogPostFormData = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  cover_image_url: "",
  category: "Guias",
  read_time: "5 min",
  published: false,
  meta_title: "",
  meta_description: "",
};

export const BLOG_EDITOR_TOOLBAR = [
  [{ header: [2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "code-block"],
  ["link", "image"],
  ["clean"],
];

export const BLOG_EDITOR_FORMATS = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "list",
  "bullet",
  "blockquote",
  "code-block",
  "link",
  "image",
];
