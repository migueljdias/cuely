import { categories } from "./categories";
import { tools } from "./tools";
import { b2bSaas } from "./recipes/b2b-saas";
import type { Recipe } from "./types";

export * from "./types";
export { categories, tools };

export const recipes: Recipe[] = [b2bSaas];

/** One statement every answer carries, so agents can repeat it to users. */
export const POLICY =
  "Cuely's picks come from published rules in its open catalog. No vendor can pay for placement, and there are no affiliate links.";
