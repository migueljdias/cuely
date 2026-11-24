import type { Recipe } from "../types";

const V = "2026-11-20";

export const onlineStore: Recipe = {
  slug: "online-store",
  title: "Online store selling products to shoppers",
  summary:
    "A store that sells physical or digital products. Start on a hosted store builder, which already has checkout, payments, shipping labels, taxes and order email, and only build a custom storefront or move to an open-source commerce framework when the store needs something the builder can't do.",
  matches: [
    "online store", "online shop", "web shop", "ecommerce", "e-commerce", "shopify", "storefront", "physical products",
    "dropshipping", "subscription box", "shopping cart", "sell products", "merch store", "product catalog",
  ],
  fitsWhen: [
    "You sell products (physical, digital or subscriptions) to shoppers at prices you set.",
    "You want checkout, payments, shipping and taxes working without building them.",
    "Non-developers will add products and handle orders day to day.",
  ],
  notFor: [
    "Marketplaces where users sell to each other and you take a cut: the marketplace recipe covers payouts.",
    "Selling software subscriptions or seats: the b2b-saas recipe covers Stripe Billing.",
    "Warehouse, ERP or 3PL integration across many locations: plan those systems first.",
  ],
  stack: [
    {
      category: "commerce",
      tool: "shopify",
      why: "Checkout, payments, shipping labels, taxes, order email and hosting in one subscription: Basic is $39/month billed monthly ($29 billed yearly). Use Shopify Payments, since any other provider adds 2% per sale on Basic.",
      alternatives: [
        { tool: "medusa", when: "Checkout, pricing or catalog logic is unusual enough that you need your own code, or you want no platform fee on sales; you build the storefront and bring your own payments." },
      ],
    },
    {
      category: "cms",
      tool: "sanity",
      why: "Only if the store has a real content side (lookbooks, guides, a blog) beyond product pages; the store builder's own pages cover the basics.",
      alternatives: [{ tool: "payload", when: "You build a custom Next.js storefront and want the content in the same app and database." }],
      optional: true,
    },
    {
      category: "search",
      tool: "algolia",
      why: "Only for large catalogs that need instant search with facets; the store builder's own search covers a few hundred products.",
      alternatives: [{ tool: "meilisearch", when: "You'd rather pay a flat $20/month with unlimited searches." }],
      optional: true,
    },
    {
      category: "hosting",
      tool: "vercel",
      why: "Only for a custom (headless) storefront in Next.js that reads products from the store's API; a theme-based store needs no hosting of its own.",
      alternatives: [{ tool: "cloudflare-workers", when: "You want the storefront at the edge on Cloudflare." }],
      optional: true,
    },
    {
      category: "payments",
      tool: "stripe",
      why: "Only with a custom build on Medusa or your own checkout; on Shopify, use Shopify Payments.",
      alternatives: [{ tool: "paddle", when: "You sell digital products worldwide and want a merchant of record to handle VAT." }],
      optional: true,
    },
    {
      category: "analytics",
      tool: "posthog",
      why: "Funnels from product page to checkout, beyond the store builder's own reports.",
      alternatives: [{ tool: "plausible", when: "You want simple, cookie-free traffic numbers." }],
      optional: true,
    },
  ],
  steps: [
    {
      title: "Decide: hosted builder, headless, or custom",
      detail: "Most stores should start on the hosted builder and change only when they hit a real limit.",
      actions: [
        "List what the store must do: products and variants, subscriptions, digital downloads, countries you ship to, B2B pricing.",
        "If a standard theme plus apps covers that list, use the hosted builder with a theme (this recipe's default).",
        "If you need a fully custom front end but standard checkout, go headless: a Next.js storefront on the builder's storefront API.",
        "If checkout, pricing or catalog logic itself is unusual, or per-sale platform fees matter at your volume, build on Medusa.",
      ],
      check: "You've written down which of the three you chose and the one requirement that decided it.",
      docs: ["https://www.shopify.com/pricing", "https://medusajs.com/pricing"],
    },
    {
      title: "Set up the store, products and payments",
      detail: "Products, prices and payments are the core; get them right before the theme.",
      actions: [
        "Start the trial (3 days free, then $1/month for 3 months) and pick the plan you'll keep before launch.",
        "Turn on Shopify Payments if it's available in your country; on Basic, any other payment provider adds 2% per sale.",
        "Add products with variants, SKUs, weights (for shipping rates) and good photos; import a CSV for large catalogs.",
        "Set up collections and navigation so shoppers find products in two clicks.",
      ],
      check: "A test order with a real card goes through checkout, shows in Orders, and the refund works.",
      docs: ["https://help.shopify.com/en/manual/payments/shopify-payments"],
    },
    {
      title: "Set up shipping and fulfillment",
      detail: "Shipping cost and speed decide whether shoppers finish checkout.",
      actions: [
        "Define shipping zones and rates (flat, by weight or carrier-calculated) for every country you ship to.",
        "Decide who packs orders: you, a fulfillment service or print-on-demand, and connect it before launch.",
        "Buy and print labels from the store admin, and test a full order from purchase to tracking email.",
        "Write a shipping and returns policy and link it in the footer and at checkout.",
      ],
      check: "A test order to each shipping zone shows the right rate at checkout and sends a tracking email once the label is bought.",
      docs: ["https://help.shopify.com/en/manual/fulfillment/setup/shipping-rates"],
    },
    {
      title: "Handle sales tax and VAT",
      detail: "Where you owe tax depends on where buyers are and how much you sell there; the store can calculate it, but you register and file.",
      actions: [
        "Turn on tax collection in the store's tax settings for each place you're registered.",
        "Track sales by state or country; selling past a threshold can create a duty to register there.",
        "For digital products sold worldwide, consider a merchant of record (for example Paddle) that registers and files for you.",
        "Ask an accountant which registrations you need before launch.",
      ],
      check: "A test order to a state or country where you're registered shows the right tax, and one where you're not shows none.",
      docs: ["https://help.shopify.com/en/manual/taxes"],
    },
    {
      title: "Theme, content and legal pages",
      detail: "Shoppers decide fast; product pages and trust signals matter more than a custom design.",
      actions: [
        "Pick a theme close to what you want and change colors, type and the homepage rather than rebuilding it.",
        "Write product descriptions with sizes, materials and care, and add reviews when you have them.",
        "Publish refund, shipping, privacy and terms pages, and a contact page with a real way to reach you.",
        "Add a CMS only if you'll publish guides or lookbooks regularly.",
      ],
      check: "Every product page shows price, shipping estimate, returns policy and photos on a phone screen without scrolling sideways.",
    },
    {
      title: "Go headless or custom only if you chose to",
      detail: "Skip this step for a theme-based store.",
      actions: [
        "Headless: build a Next.js storefront on the store's storefront API, host it on Vercel, and keep the builder's checkout.",
        "Medusa: start a Medusa project, add Stripe as the payment provider, and build the storefront from its Next.js starter.",
        "Keep product data in one place (the store platform), and cache product pages so a traffic spike doesn't hit the API on every view.",
      ],
      commands: ["npx create-medusa-app@latest"],
      check: "The custom storefront completes a test order end to end, and product pages load from cache under a load test.",
      docs: ["https://shopify.dev/docs/storefronts/headless", "https://docs.medusajs.com"],
    },
    {
      title: "Launch and measure",
      detail: "Launch with the basics that recover sales and catch problems.",
      actions: [
        "Connect your domain and turn on abandoned-checkout emails.",
        "Place one last real order from a phone, refund it, and check every email it sent.",
        "Watch the funnel: product views, add to cart, checkout started, orders.",
        "Review store apps monthly and remove ones you don't use; each adds cost and page weight.",
      ],
      check: "You can see this week's conversion from product view to order, and abandoned-checkout emails are going out.",
    },
  ],
  bestPractices: [
    "Start on the hosted builder and move to headless or custom only for a specific requirement.",
    "Use the builder's own payments to avoid extra per-sale fees.",
    "Put weights on every product so shipping rates are right at checkout.",
    "Register for sales tax where you must before you collect it, and ask an accountant.",
    "Publish refund, shipping, privacy and terms pages before the first sale.",
    "Keep product data in one system, even with a custom storefront.",
  ],
  pitfalls: [
    "Building a custom checkout for a standard store and spending months on what a builder already has.",
    "Using another payment provider on Shopify Basic and paying 2% extra on every sale.",
    "Free shipping everywhere without checking what heavy orders to far zones cost you.",
    "Collecting sales tax without being registered, or not collecting where you must.",
    "Stacking many paid apps until the monthly bill passes a higher plan's price.",
    "A headless storefront that calls the store API on every page view and slows down under traffic.",
  ],
  complianceNotes: [
    "Consumer protection rules apply: clear prices, total cost before payment, and a stated refund policy; the EU and UK add a 14-day right to cancel most online purchases.",
    "Collect sales tax and VAT where you're registered or required to; this changes with where and how much you sell.",
    "Card payments must stay with your payment provider's checkout so card numbers never touch your servers (PCI DSS).",
    "Marketing emails and texts need consent and an unsubscribe option.",
  ],
  catches: [
    {
      text: "Shopify Basic is $39/month billed monthly ($29 billed yearly), with online card rates from 2.9% + 30¢ on Shopify Payments. Using another payment provider adds a 2% third-party transaction fee per sale on Basic (1% on Grow, 0.6% on Advanced).",
      source: "https://www.shopify.com/pricing",
      verifiedOn: V,
    },
    {
      text: "A custom store on Medusa has no per-sale platform fee (0.0% GMV on every Cloud plan), but Medusa Cloud starts at $29/month and you add your own payment provider, storefront hosting and build time.",
      source: "https://medusajs.com/pricing",
      verifiedOn: V,
    },
    {
      text: "For a custom checkout on Stripe, Stripe Tax adds 0.5% per transaction where you're registered, on top of 2.9% + 30¢ card fees.",
      source: "https://stripe.com/pricing",
      verifiedOn: "2026-11-07",
    },
  ],
  costNotes: [
    "Store platform: Shopify Basic at $39/month billed monthly, or $29 billed yearly.",
    "Per sale with Shopify Payments: 2.9% + 30¢ online; on 1,000 orders of $40 a month that's $1,160 + $300 = $1,460 in card fees.",
    "Apps, themes and shipping labels are extra; premium themes are a one-time purchase, apps are often monthly.",
  ],
  verifiedOn: V,
};
