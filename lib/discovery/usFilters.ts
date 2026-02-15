type LocationInput = {
  title?: string | null;
  location?: string | null;
  description?: string | null;
};

const US_STATE_NAMES = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
  "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky",
  "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri",
  "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "new york",
  "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island",
  "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington",
  "west virginia", "wisconsin", "wyoming", "district of columbia"
];

const US_STATE_ABBR = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA",
  "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasWord(text: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function hasUSLocationHint(value: string) {
  const text = normalize(value);
  if (!text) return false;

  if (
    text.includes("united states") ||
    text.includes("united states of america") ||
    hasWord(text, "usa") ||
    hasWord(text, "us-only") ||
    hasWord(text, "us based") ||
    hasWord(text, "u.s.")
  ) {
    return true;
  }

  for (const state of US_STATE_NAMES) {
    if (text.includes(state)) return true;
  }

  for (const abbr of US_STATE_ABBR) {
    const re = new RegExp(`,\\s*${abbr}(?:\\b|\\s|$)`, "i");
    if (re.test(value)) return true;
  }

  return false;
}

export function isRemoteLocation(input: LocationInput) {
  const combined = normalize(`${input.title ?? ""} ${input.location ?? ""} ${input.description ?? ""}`);
  return (
    combined.includes("remote") ||
    combined.includes("work from home") ||
    combined.includes("wfh")
  );
}

export function isUnitedStatesJob(input: LocationInput) {
  const locationText = input.location ?? "";
  const descriptionText = input.description ?? "";
  const titleText = input.title ?? "";

  const remote = isRemoteLocation(input);

  if (remote) {
    return hasUSLocationHint(locationText) || hasUSLocationHint(descriptionText) || hasUSLocationHint(titleText);
  }

  return hasUSLocationHint(locationText) || hasUSLocationHint(descriptionText);
}

const GERMAN_MARKERS = [
  "w/m/d",
  "für",
  "münchen",
  "berlin",
  "hamburg",
  "köln",
  "entwickler",
  "deutschland",
  "germany",
  "arbeitsort",
  "vollzeit",
  "teilzeit"
];

export function isLikelyEnglishJob(input: LocationInput) {
  const combined = normalize(`${input.title ?? ""} ${input.location ?? ""} ${input.description ?? ""}`);
  if (!combined) return false;

  if (/[äöüß]/i.test(combined)) return false;
  for (const marker of GERMAN_MARKERS) {
    if (combined.includes(marker)) return false;
  }

  return true;
}
