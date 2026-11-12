import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingHtmlFrame, landingHtmlDocument } from "../src/components/landing-html-frame";
import { landingPageInputSchema, newLandingBlock, normalizeCustomHtml } from "../src/lib/landing-builder";

test("landing builder requires unique anchors and at least one active published block", () => {
  const hero = newLandingBlock("HERO");
  const input = { slug: "promo-kulinerkit", title: "Promo KulinerKit", seoDescription: "", status: "published", blocks: [hero] };
  assert.equal(landingPageInputSchema.parse(input).metaViewContentEnabled, false);
  assert.equal(landingPageInputSchema.parse({ ...input, metaViewContentEnabled: true }).metaViewContentEnabled, true);
  assert.equal(landingPageInputSchema.safeParse({ ...input, blocks: [{ ...hero, enabled: false }] }).success, false);
  assert.equal(landingPageInputSchema.safeParse({ ...input, blocks: [hero, { ...newLandingBlock("CTA"), anchorId: hero.anchorId }] }).success, false);
});

test("standard CTA links reject unsafe schemes and protocol-relative URLs", () => {
  const block = newLandingBlock("CTA");
  const input = { slug: "promo-kulinerkit", title: "Promo KulinerKit", seoDescription: "", status: "published", blocks: [block] };
  for (const href of ["javascript:alert(1)", "//example.com", "http://example.com", "https://", "/\\example.com"])
    assert.equal(landingPageInputSchema.safeParse({ ...input, blocks: [{ ...block, href }] }).success, false, href);
  for (const href of ["#checkout", "/checkout", "https://example.com/checkout"])
    assert.equal(landingPageInputSchema.safeParse({ ...input, blocks: [{ ...block, href }] }).success, true, href);
});

test("custom HTML accepts a full document but removes page-level tags", () => {
  const cleaned = normalizeCustomHtml('<!doctype html><html><head><title>Wrong title</title><meta name="robots" content="index"><base href="https://evil.test"><style>.hero{color:red}</style></head><body><div class="hero">Hello</div><script>window.test=1</script></body></html>');
  assert.match(cleaned, /<style>/);
  assert.match(cleaned, /<script>/);
  assert.doesNotMatch(cleaned, /<base|<meta|<title|<html|<head|<body/i);
  const block = newLandingBlock("CUSTOM_HTML");
  assert.equal(landingPageInputSchema.safeParse({ slug: "html", title: "HTML", seoDescription: "", status: "draft", blocks: [{ ...block, html: "x".repeat(300_001) }] }).success, false);
});

test("HTML block uses an isolated iframe and forwards only page anchor clicks", () => {
  const markup = renderToStaticMarkup(createElement(LandingHtmlFrame, { anchorId: "custom-html-1", html: "<p>Hello</p>" }));
  assert.match(markup, /sandbox="allow-scripts allow-forms/);
  assert.doesNotMatch(markup, /allow-same-origin/);
  const document = landingHtmlDocument("<p>Hello</p>", "frame-1");
  assert.match(document, /Content-Security-Policy/);
  assert.match(document, /kk:html-anchor/);
  assert.match(document, /destination|target\.origin===current\.origin/);
  assert.match(document, /ResizeObserver/);
});
