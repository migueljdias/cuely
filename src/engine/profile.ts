import { maskText, wordPattern } from "./needs";

/**
 * The product profile: the few facts about a product that change which kinds of
 * tools it needs at all (not which tool wins a category). Detected from plain words,
 * like needs, and published here as part of the method.
 *
 * When a fact is unknown and it would change the picks, recommend_stack asks the
 * agent to put a short question to the user instead of guessing.
 */
export type Platform = "web" | "mobile" | "both";
export type Money = "none" | "users_pay_you" | "users_pay_each_other";
export type Audience = "customers" | "internal";

export interface Answers {
  platform?: Platform;
  money?: Money;
  audience?: Audience;
}

export interface Profile {
  platform: Platform;
  money: Money;
  audience: Audience;
  ai: boolean;
  rag: boolean;
  realtime: boolean;
  /** People provide services in person (walking, cleaning, care): background checks matter. */
  inPerson: boolean;
  socialLogin: boolean;
  /** A casual or daily game that runs in a web browser (engine, console and phone games are outside coverage). */
  game: boolean;
  /** Players share results, so traffic can arrive in viral spikes. */
  shareable: boolean;
  /** An iPhone or iPad app written in Swift with Xcode, with no Android or cross-platform build. */
  nativeIos: boolean;
  /** The description asks for push notifications or reminders. */
  push: boolean;
  /** Sends or receives text messages (codes, alerts, reminders by text). */
  sms: boolean;
  /** Has a search bar over its own records (not semantic search over documents). */
  search: boolean;
  /** Non-developers write or edit content: a blog, marketing pages, articles. */
  cms: boolean;
  /** An AI agent: the model takes multi-step actions with tools, not just answers. */
  agent: boolean;
  /** The product is an API or developer tool that other developers call with keys. */
  api: boolean;
  /** Where each value came from. */
  source: Record<"platform" | "money" | "audience", "described" | "answered" | "assumed">;
  matched: Partial<Record<"platform" | "money" | "audience" | "ai" | "game" | "nativeIos", string>>;
}

export interface Question {
  id: "platform" | "money" | "audience" | "what";
  question: string;
  /** Why the answer changes the stack, so the agent can explain if asked. */
  why: string;
  options?: { value: string; label: string }[];
}

export interface Coverage {
  status: "covered" | "partial" | "outside";
  /** What Cuely does not cover for this product, in plain words. */
  notes: string[];
}

const any = (text: string, words: string[]) => words.find((w) => wordPattern(w).test(text)) ?? null;

const MOBILE = ["ios", "android", "iphone", "ipad", "mobile app", "mobile apps", "phone app", "app store",
  "play store", "google play", "react native", "expo", "flutter", "swift", "swiftui", "uikit", "xcode", "kotlin", "native app"];
const WEB = ["web", "web app", "webapp", "website", "site", "saas", "dashboard", "browser", "next.js", "nextjs",
  "landing page", "portal", "web first", "web-first", "chrome extension", "pwa"];
/** Words that ask for notifications sent to the phone. */
export const PUSH = ["push", "push notification", "push notifications", "notification", "notifications", "notify", "notifies",
  "reminder", "reminders", "remind", "reminds", "nudge", "nudges", "alert", "alerts"];
/** Words that say the app is written natively for Apple platforms. */
const NATIVE_IOS = ["swift", "swiftui", "uikit", "xcode", "native ios", "native iphone", "native ipad", "storekit", "cloudkit"];
/** Words that say it also ships on Android or through a cross-platform framework, so the Expo recipe fits better. */
const CROSS_PLATFORM = ["android", "react native", "expo", "flutter", "kotlin", "play store", "google play", "cross-platform", "cross platform"];
const BOTH = ["web and mobile", "mobile and web", "web and ios", "ios and web", "web plus mobile", "cross-platform web"];
const APP_WORDS = ["app", "apps", "application"];

const MARKETPLACE = ["marketplace", "commission", "take rate", "our cut", "we keep", "payout", "payouts", "pay out",
  "split payments", "pay walkers", "pay sellers", "pay hosts", "pay providers", "pay freelancers", "pay drivers",
  "pay tutors", "pay creators", "service fee", "booking fee", "connect buyers", "buyers and sellers"];
const PAY_YOU = ["subscription", "subscriptions", "per month", "/month", "/mo", "monthly plan", "paid plan",
  "paid plans", "pricing", "per-seat", "per seat", "freemium", "charge users", "charge customers", "paywall",
  "in-app purchase", "in-app purchases", "one-time purchase", "sell it", "sell to", "usage-based", "usage based",
  "billing", "monetize", "premium", "online store", "my store", "online shop", "web shop", "checkout", "sell", "selling", "subscription box", "shopify", "ecommerce", "e-commerce"];
const TWO_SIDED = ["book a", "book and pay", "book appointments", "booking", "bookings", "hire", "hiring", "providers", "sellers", "buyers", "hosts",
  "freelancers", "walkers", "sitters", "tutors", "drivers", "cleaners", "creators", "vendors", "two-sided",
  "connects", "connect people"];
const NO_MONEY = ["free app", "no payments", "non-profit", "nonprofit", "internal", "no money"];

const INTERNAL = ["internal tool", "internal app", "internal", "staff", "employees", "employee", "back office",
  "back-office", "admin panel", "our team uses", "for my team", "for our team", "inventory", "timesheets",
  "shift schedule", "-person", "person team"];
const OWN_BUSINESS = ["i run a", "i own a", "my business", "my company", "my shop", "my store", "my restaurant",
  "my bakery", "my cafe", "my salon", "my clinic", "my gym", "my studio", "my agency", "our business", "our company"];
const CUSTOMER = ["customers", "clients", "users sign up", "sign up", "the public", "consumers", "subscribers",
  "patients book", "members", "sell it", "sell to"];

const AI = ["ai", "llm", "llms", "gpt", "chatgpt", "claude", "gemini", "chatbot", "chat bot", "ai assistant", "copilot",
  "ai agent", "ai agents", "rag", "embeddings", "summarize", "summarise", "answers questions",
  "answer questions", "chat with", "semantic search", "openai", "anthropic", "machine learning"];
const RAG = ["rag", "pdf", "pdfs", "documents", "knowledge base", "handbook", "policies", "manuals", "embeddings",
  "over our docs", "over their docs", "company docs", "files"];
const IN_PERSON = ["walk", "walker", "walkers", "walking", "sitter", "sitters", "babysit", "babysitter", "nanny",
  "cleaning", "cleaners", "cleaner", "caregiver", "caregivers", "home care", "handyman", "tutor", "tutors", "drivers",
  "pet care", "dog"];
const SOCIAL_LOGIN = ["google login", "google sign-in", "sign in with google", "social login", "facebook login"];

/** Casual and daily games that run in a browser: covered since 2026-11-09. */
export const GAME = ["game", "games", "daily game", "web game", "browser game", "puzzle game", "word game", "trivia",
  "trivia game", "quiz game", "guessing game", "daily puzzle", "puzzle", "puzzles", "word puzzle", "crossword", "wordle", "party game", "io game"];
const PHONE_GAME = [...MOBILE, "phone", "phones", "mobile game", "mobile games", "tablet", "tablets"];
const SHARE = ["share", "shares", "shareable", "share results", "share their results", "share their score", "viral",
  "go viral", "goes viral", "spike", "spikes", "traffic spikes"];
/** Games Cuely doesn't cover: built in an engine, for consoles or in 3D. These words say so on their own. */
const GAME_ENGINE = ["unity", "unreal", "unreal engine", "godot", "game engine", "playstation", "xbox", "nintendo",
  "mmorpg", "battle royale"];
/** These say so only next to a game word ("steam" alone could mean anything). */
const GAME_3D = ["3d", "console", "consoles", "steam", "fps", "first-person shooter", "mmo", "vr", "virtual reality", "ar"];
/** Fast multiplayer needs an authoritative game server, which Cuely doesn't cover. */
const FAST_MULTIPLAYER = ["multiplayer", "real-time multiplayer", "realtime multiplayer", "matchmaking", "netcode",
  "game server", "game servers", "pvp", "player vs player", "lobbies"];

/** Text messages and phone verification: the SMS and voice category. */
export const SMS = ["sms", "text message", "text messages", "texting", "text reminder", "text reminders", "send a text",
  "sends a text", "by text", "via text", "otp", "one-time code", "one-time codes", "verification code", "verification codes",
  "phone verification", "verify phone", "verify their phone", "two-way texting", "mms"];
/** A search bar over the product's own records. Semantic search over documents is RAG, not this. */
export const SEARCH = ["search bar", "search box", "full-text search", "full text search", "site search", "searchable",
  "search across", "search and filter", "search and filters", "search their", "search our", "search the catalog",
  "faceted", "facets", "typo-tolerant", "typo tolerance", "instant search", "search-as-you-type", "search as you type"];
/** Content written by non-developers: the CMS category. */
export const CMS = ["cms", "headless cms", "blog", "blog posts", "content site", "marketing site", "marketing pages",
  "content editors", "content team", "editors publish", "publish articles", "write articles", "landing pages", "help center articles"];

/** An AI that acts, not only answers. "agents" alone could be real-estate or support agents, so it needs an AI word too. */
export const AGENT = ["ai agent", "ai agents", "agentic", "autonomous agent", "autonomous agents", "agent that", "agents that",
  "tool use", "tool calling", "tool calls", "function calling", "takes actions", "take actions", "acts on", "multi-step tasks",
  "research agent", "coding agent", "browser agent", "browses the web", "computer use", "agent workflows", "agent workflow"];
/** Agent words that only ever mean an AI, so they count as AI on their own. */
const AGENT_AI = ["ai agent", "ai agents", "agentic", "autonomous agent", "autonomous agents", "tool calling", "function calling",
  "coding agent", "research agent", "browser agent", "computer use"];
/** A product that developers call with API keys. */
export const API_PRODUCT = ["public api", "rest api", "graphql api", "developer api", "api for developers", "api product",
  "sdk", "sdks", "developer tool", "developer tools", "dev tool", "dev tools", "devtool", "devtools",
  "developer platform", "per api call", "api-first", "api first", "sell api access", "paid api"];

const ENGINE_NOTE = "Cuely doesn't cover game engines, console or 3D games; it covers casual and daily games that run in a web browser.";

/** Things Cuely doesn't cover. "outside" means the core of the product is out of scope. */
const OUTSIDE: { words: string[]; note: string; status: "partial" | "outside"; needs?: string[]; unless?: string[] }[] = [
  { words: GAME_ENGINE, status: "outside", note: ENGINE_NOTE },
  { words: GAME_3D, needs: GAME, status: "outside", note: ENGINE_NOTE },
  { words: PHONE_GAME, needs: GAME, status: "outside",
    note: "Cuely doesn't cover phone games, which are usually built in a game engine; it covers casual and daily games that run in a web browser." },
  { words: FAST_MULTIPLAYER, needs: GAME, status: "partial",
    note: "Cuely doesn't cover authoritative game servers or matchmaking for fast real-time multiplayer; the stack below covers accounts, votes, scores, leaderboards and updates every few seconds." },
  { words: ["iot", "firmware", "embedded", "arduino", "raspberry pi", "hardware device", "microcontroller"], status: "outside",
    note: "Cuely doesn't cover hardware, firmware or IoT device fleets." },
  { words: ["crypto", "blockchain", "web3", "nft", "nfts", "smart contract", "smart contracts", "defi", "token sale"], status: "outside",
    note: "Cuely doesn't cover blockchain or crypto infrastructure." },
  { words: ["desktop app", "electron", "tauri", "macos app", "windows app"], status: "partial",
    note: "Cuely doesn't cover desktop packaging, signing or auto-updates; the stack below covers only the backend parts." },
  { words: ["online store", "ecommerce", "e-commerce", "shopify", "shipping", "shipped", "physical products", "dropshipping", "subscription box"], status: "partial",
    note: "Cuely doesn't compare store builders, shipping or inventory systems; for a standard online store, a hosted store builder may beat a custom build." },
  { words: ["chrome extension", "browser extension"], status: "partial",
    note: "Cuely doesn't cover browser-extension publishing or store rules." },
  { words: ["live streaming", "video streaming", "video calls", "video calling"], status: "partial",
    note: "Cuely doesn't cover video streaming or calling providers yet." },
  { words: ["train a model", "fine-tune", "fine tune", "fine-tuning", "gpu", "gpus", "training data"], status: "partial",
    note: "Cuely doesn't cover model training or GPU hosting; it covers calling hosted model APIs." },
  { words: ["wallet", "neobank", "lending", "hold customer money", "money transfer", "remittance"], status: "partial",
    note: "Apps that move or hold customer money need licensing review first; Cuely doesn't cover ledgers or banking partners." },
  { words: ["phone calls", "voice calls", "ivr", "call center", "call centre"], status: "partial",
    note: "Cuely's SMS and voice picks also handle calls, but they're compared on US text message prices; check each provider's voice rates." },
  { words: ["push notifications", "web push", "browser notifications"], status: "partial", unless: MOBILE,
    note: "Cuely compares push services for phone apps, not browser (web push) notifications." },
];

export function detectCoverage(text: string): Coverage {
  const t = maskText(text);
  const hits = OUTSIDE.filter((o) => any(t, o.words) && (!o.needs || any(t, o.needs)) && (!o.unless || !any(t, o.unless)));
  if (!hits.length) return { status: "covered", notes: [] };
  // When the core is out of scope, only the out-of-scope notes apply (there is no "stack below"),
  // and an engine game that is also a phone game gets one note, not two.
  const outside = hits.filter((h) => h.status === "outside");
  const shown = outside.length
    ? outside.some((h) => h.note === ENGINE_NOTE) ? outside.filter((h) => h.note === ENGINE_NOTE || h.needs !== GAME) : outside
    : hits;
  return {
    status: outside.length ? "outside" : "partial",
    notes: [...new Set(shown.map((h) => h.note))],
  };
}

export interface ProfileResult {
  profile: Profile;
  /** Facts that are unknown and would change the picks. */
  unknown: ("platform" | "money" | "audience")[];
  vague: boolean;
}

/** Phrases about the builder, not the product ("I'm a web dev"). */
const ABOUT_BUILDER = /\b(i'?m|i am|as) an? (web|front[- ]?end|full[- ]?stack|react|mobile|ios|android) (dev|developer|engineer)s?\b|\bweb (dev|developer|developers)\b/gi;

export function detectProfile(text: string, answers: Answers = {}): ProfileResult {
  const cleaned = text.replace(ABOUT_BUILDER, " ");
  const t = maskText(cleaned);
  const raw = cleaned.toLowerCase();
  const matched: Profile["matched"] = {};
  const source: Profile["source"] = { platform: "assumed", money: "assumed", audience: "assumed" };
  const unknown: ProfileResult["unknown"] = [];

  // Platform
  let platform: Platform = "web";
  const both = any(raw, BOTH);
  const mob = any(raw, MOBILE);
  const web = any(t, WEB);
  if (answers.platform) {
    platform = answers.platform;
    source.platform = "answered";
  } else if (both || (mob && web && !/web first|web-first/.test(raw))) {
    platform = "both";
    source.platform = "described";
    matched.platform = both ?? `${mob} + ${web}`;
  } else if (mob) {
    platform = "mobile";
    source.platform = "described";
    matched.platform = mob;
  } else if (web) {
    platform = "web";
    source.platform = "described";
    matched.platform = web;
  }

  // Money
  let money: Money = "none";
  const mk = any(t, MARKETPLACE) ?? (/\bkeep\s+\d+\s?%|\d+\s?%\s+(cut|fee|commission)/.test(raw) ? "a % cut" : null);
  const you =
    any(t, PAY_YOU) ??
    (/\$\s?\d+(\.\d+)?\s*(\/|a |per )\s*(month|mo|year|yr)/.test(raw) ? "a monthly price" : null) ??
    // "patients pay monthly", "members pay a yearly fee": someone pays the product on a schedule.
    (/\bpays?\s+(monthly|yearly|annually|weekly|(a|an)\s+(monthly|yearly|annual|weekly)\b|(a|an)\s+fee\b|per\s+(month|year|week|use))/.test(raw) ? "pays on a schedule" : null);
  const twoSided = any(t, TWO_SIDED);
  const noMoney = any(t, NO_MONEY);
  if (answers.money) {
    money = answers.money;
    source.money = "answered";
  } else if (mk) {
    money = "users_pay_each_other";
    source.money = "described";
    matched.money = mk;
  } else if (you) {
    money = "users_pay_you";
    source.money = "described";
    matched.money = you;
  } else if (noMoney) {
    money = "none";
    source.money = "described";
    matched.money = noMoney;
  } else if (/(^|[^a-z0-9])(saas|b2b)($|[^a-z0-9])/.test(raw)) {
    // Software sold as a service charges its customers, even when the description doesn't say how.
    money = "users_pay_you";
    source.money = "described";
    matched.money = "saas";
  }

  // Audience
  let audience: Audience = "customers";
  const internal = any(t, INTERNAL) ?? (/\b\d+[- ]person\b/.test(raw) ? "a small staff" : null);
  const own = any(raw, OWN_BUSINESS);
  const customer = any(t, CUSTOMER);
  if (answers.audience) {
    audience = answers.audience;
    source.audience = "answered";
  } else if (internal && !customer) {
    audience = "internal";
    source.audience = "described";
    matched.audience = internal;
  } else if (customer || money !== "none") {
    audience = "customers";
    source.audience = "described";
    matched.audience = customer ?? "charges users";
  }

  const ai = !!any(t, AI) || !!any(t, AGENT_AI);
  if (ai) matched.ai = any(t, AI) ?? any(t, AGENT_AI)!;
  const rag = ai && !!any(t, RAG);
  const realtime = !!any(t, ["realtime", "real-time", "real time", "live updates", "chat", "presence", "collaborative",
    "multiplayer", "websocket", "websockets", "retro", "retros", "retrospective", "retrospectives", "whiteboard",
    "live cursors", "co-edit", "co-editing", "live session", "live sessions"]);
  const inPerson = money === "users_pay_each_other" && !!any(t, IN_PERSON);
  const socialLogin = !!any(t, SOCIAL_LOGIN);
  const gameWord = any(t, GAME);
  const game = !!gameWord && audience !== "internal";
  if (game) matched.game = gameWord!;
  const shareable = game && !!any(t, SHARE);
  // Checked on the raw text: masking turns "React Native" into a placeholder, and it must still count as cross-platform.
  const nativeWord = platform !== "web" ? any(raw, NATIVE_IOS) : null;
  const nativeIos = !!nativeWord && !any(raw, CROSS_PLATFORM);
  if (nativeIos) matched.nativeIos = nativeWord!;
  const push = !!any(t, PUSH);
  // "texts members" is a text message; "legal texts" isn't, so the bare word only counts as a verb with a person after it.
  const sms = !!any(t, SMS) || /\btext(s|ing)?\s+(users|members|customers|patients|clients|people|them|parents|students|staff|guests|riders|drivers|tenants)\b/.test(raw);
  // "semantic search" is retrieval over documents (the vector category), so it doesn't count as a search bar.
  const search = !!any(t.replace(/semantic search/g, " "), SEARCH);
  const cms = !!any(t, CMS);
  const agent = ai && !!any(t, AGENT);
  const api = audience === "customers" && !!any(t, API_PRODUCT);

  // Unknown facts that would change the picks.
  const hasApp = !!any(t, APP_WORDS);
  if (source.platform === "assumed" && audience !== "internal" && hasApp && !game) unknown.push("platform");
  if (source.money === "assumed" && twoSided && audience !== "internal") unknown.push("money");
  if (source.audience === "assumed" && own) unknown.push("audience");

  const words = t.split(/[^a-z0-9]+/i).filter((w) => w.length > 2);
  const vague = words.length < 4 && !web && !mob && !ai && !mk && !you && !internal && !game;

  return {
    profile: { platform, money, audience, ai, rag, realtime, inPerson, socialLogin, game, shareable, nativeIos, push, sms, search, cms, agent, api, source, matched },
    unknown,
    vague,
  };
}

export const QUESTIONS: Record<Question["id"], Question> = {
  platform: {
    id: "platform",
    question: "Is this a website, a phone app, or both?",
    why: "A phone app needs app-store builds and in-app purchases instead of web hosting and Stripe checkout.",
    options: [
      { value: "web", label: "Website or web app" },
      { value: "mobile", label: "iPhone or Android app" },
      { value: "both", label: "Both" },
    ],
  },
  money: {
    id: "money",
    question: "Will users pay you, or pay each other through it while you take a cut?",
    why: "Paying out to other users needs Stripe Connect and provider onboarding; charging users yourself is plain Stripe.",
    options: [
      { value: "users_pay_you", label: "Users pay me" },
      { value: "users_pay_each_other", label: "Users pay each other, I take a cut" },
      { value: "none", label: "No payments" },
    ],
  },
  audience: {
    id: "audience",
    question: "Is this for your own staff, or for your customers?",
    why: "A staff tool is often best built with a no-code builder and needs no payments, sign-up or marketing site.",
    options: [
      { value: "internal", label: "My own staff" },
      { value: "customers", label: "My customers" },
    ],
  },
  what: {
    id: "what",
    question: "What does it do, and who uses it, in a sentence?",
    why: "The description is too short to tell what kind of product this is.",
  },
};
