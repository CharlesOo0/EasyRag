/**
 * Region grouping for the corpus browser. The Factbook corpus tags every
 * document `[country, <region>]`; nothing here assumes that - `regionOf`
 * returns null for a corpus that doesn't carry a region tag, and the browser
 * falls back to a flat list instead of forcing grouping that isn't there.
 */

export const REGION_ORDER = [
  "africa",
  "europe",
  "east-n-southeast-asia",
  "central-america-n-caribbean",
  "middle-east",
  "australia-oceania",
  "south-america",
  "central-asia",
  "south-asia",
  "north-america",
] as const;

const REGION_LABEL: Record<string, { fr: string; en: string }> = {
  africa: { fr: "Afrique", en: "Africa" },
  europe: { fr: "Europe", en: "Europe" },
  "east-n-southeast-asia": { fr: "Asie de l'Est & du Sud-Est", en: "East & Southeast Asia" },
  "central-america-n-caribbean": {
    fr: "Amérique centrale & Caraïbes",
    en: "Central America & Caribbean",
  },
  "middle-east": { fr: "Moyen-Orient", en: "Middle East" },
  "australia-oceania": { fr: "Australie & Océanie", en: "Australia & Oceania" },
  "south-america": { fr: "Amérique du Sud", en: "South America" },
  "central-asia": { fr: "Asie centrale", en: "Central Asia" },
  "south-asia": { fr: "Asie du Sud", en: "South Asia" },
  "north-america": { fr: "Amérique du Nord", en: "North America" },
};

/** The tag that isn't "country" - Factbook-specific, but harmless to look for
 * on any corpus. Returns null when there's nothing to group by. */
export function regionOf(metadata: Record<string, unknown>): string | null {
  const tags = metadata.tags;
  if (!Array.isArray(tags)) return null;
  const region = tags.find((t) => typeof t === "string" && t !== "country");
  return typeof region === "string" ? region : null;
}

/** A readable label for a region key, falling back to a humanized version of
 * the key itself for a region this corpus invented (not the Factbook's). */
export function regionLabel(key: string, lang: "fr" | "en"): string {
  return REGION_LABEL[key]?.[lang] ?? humanize(key);
}

function humanize(key: string): string {
  return key.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
