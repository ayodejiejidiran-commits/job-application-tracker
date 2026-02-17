// sanitize-html does not ship types for helpers on the default export, so we import the default and rely on runtime shape.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import sanitizeHtml from "sanitize-html";

// Safe tags we allow for resume content (no script/style/iframe/object/embed/link).
const ALLOWED_TAGS = [
  "p",
  "br",
  "div",
  "span",
  "strong",
  "em",
  "u",
  "s",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3"
];

// Allowed inline CSS properties for resume formatting (font/size/color/alignment/spacing only).
const STYLE_ALLOW_LIST = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "color",
  "background-color",
  "text-align",
  "line-height",
  "letter-spacing",
  "margin",
  "margin-top",
  "margin-bottom",
  "padding",
  "white-space"
];

const allowedStyles: Record<string, Record<string, RegExp[]>> = {
  "*": STYLE_ALLOW_LIST.reduce((acc, prop) => {
    // Allow simple values (words, numbers, px/em/% and common #hex colors). This is intentionally strict.
    acc[prop] = [/^[#a-zA-Z0-9\s,.'\-_%()]+$/];
    return acc;
  }, {} as Record<string, RegExp[]>)
};

const allowedAttributes: Record<string, string[] | Record<string, RegExp[]>> = {
  a: ["href", "name", "target", "rel"],
  span: ["style"],
  p: ["style"],
  div: ["style"],
  li: ["style"],
  ul: ["style"],
  ol: ["style"],
  strong: ["style"],
  em: ["style"],
  u: ["style"],
  s: ["style"],
  h1: ["style"],
  h2: ["style"],
  h3: ["style"],
  '*': ["style"]
};

const allowedSchemes = ["http", "https", "mailto", "tel"];

/**
 * Sanitize resume/editor HTML with a strict allowlist. No script/style tags allowed.
 */
export function sanitizeResumeHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes,
    allowedSchemes,
    allowedStyles,
    transformTags: {
      // Force links to safe rel + target when supplied
      a: (tagName: string, attribs: Record<string, string>) => {
        const attrs = { ...attribs };
        delete attrs.target; // prevent _blank tabnabbing unless explicitly added after sanitize
        attrs.rel = "noopener noreferrer";
        return { tagName, attribs: attrs };
      }
    },
    // Disallow anything else (including style/script/object/embed/iframe)
    disallowedTagsMode: "discard"
  });
}

/**
 * Utility to detect if anything was stripped (for optional logging).
 */
export function sanitizeWithReport(html: string): { clean: string; changed: boolean } {
  const clean = sanitizeResumeHtml(html);
  return { clean, changed: clean !== html };
}

export const sanitizeConfig = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes,
  allowedSchemes,
  allowedStyles
};
