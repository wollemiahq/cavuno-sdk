/**
 * The closed, board-language salary LEXICON — the fixed salary words:
 * timeframe labels + range prefixes, seniority labels, and metadata
 * `<title>`/`<description>` sentence FRAMES, keyed by the board language
 * (`board.context().language`), NOT by any visitor locale.
 *
 * Transcribed from the hosted board's `salary-lexicon.ts`  and tested against it : the two
 * copies cannot drift silently. The `de` strings are native-reviewed.
 * Unseeded locales fall back to the English source WORDS while number and
 * currency formatting stays locale-correct.
 */

/** Wire enum for `salaryTimeframe`. */
export type SalaryTimeframeValue =
  | 'per_year'
  | 'per_month'
  | 'per_week'
  | 'per_day'
  | 'per_hour';

export type SeniorityKey =
  | 'entry_level'
  | 'associate'
  | 'mid_level'
  | 'senior'
  | 'lead'
  | 'principal'
  | 'director'
  | 'executive';

/**
 * Board-language builders for the salary-page metadata sentence frames. Each
 * receives already-formatted parts (entity name, board-language `range`/amount
 * strings, counts) and returns one localized sentence. The numbers are
 * formatted upstream (`formatSalaryRange`); the FRAME is the words.
 */
export interface SalaryFrames {
  // Titles
  entitySalariesTitle(a: { entity: string; range: string }): string;
  salariesInPlaceTitle(a: { place: string; range: string }): string;
  salariesInPlaceTitleNoRange(a: { place: string }): string;
  entitySalariesInPlaceTitle(a: {
    entity: string;
    place: string;
    range: string;
  }): string;
  companySalariesTitle(a: { company: string; range: string | null }): string;
  companyCategorySalariesTitle(a: {
    company: string;
    category: string;
    range: string | null;
  }): string;
  // Descriptions
  professionalsEarn(a: {
    entity: string;
    range: string;
    count: number;
  }): string;
  rolesPay(a: { entity: string; range: string; count: number }): string;
  professionalsInLocationEarn(a: {
    entity: string;
    place: string;
    range: string;
    count: number;
  }): string;
  seniorityRange(a: {
    lowLabel: string;
    lowAmount: string;
    highLabel: string;
    highAmount: string;
  }): string;
  seniorityRangeWhile(a: {
    lowLabel: string;
    lowAmount: string;
    highLabel: string;
    highAmount: string;
  }): string;
  compareAcrossTopPaying(a: { count: number }): string;
  compareAcrossTop(a: { count: number }): string;
  boardWideAverage(a: { entity: string; range: string }): string;
  averageSalaryInCity(a: {
    place: string;
    range: string;
    count: number;
  }): string;
  browseLocationsInRegion(a: { count: number; place: string }): string;
  companyPays(a: { company: string; range: string; count: number }): string;
  breakdownAcrossCategories(a: { count: number }): string;
  compareWithSimilar(a: { count: number }): string;
  salaryInfoFor(a: { company: string; board: string }): string;
  categoryRolesAtCompanyPay(a: {
    category: string;
    company: string;
    range: string;
    count: number;
  }): string;
  categorySalaryDataFor(a: {
    category: string;
    company: string;
    board: string;
  }): string;
}

export interface SalaryLexicon {
  /** Per-timeframe display word, e.g. `per_year` → "Yearly" / "pro Jahr". */
  timeframe: Record<SalaryTimeframeValue, string>;
  /** Open-ended range prefixes, e.g. "From" / "ab", "Up to" / "bis zu". */
  rangePrefix: { from: string; upTo: string };
  /** Seniority-level labels, e.g. `senior` → "Senior". */
  seniority: Record<SeniorityKey, string>;
  /** Metadata `<title>`/`<description>` sentence builders. */
  frames: SalaryFrames;
}

// `en` is the English SOURCE — tested to match the hosted board's
// emission exactly, so `en` boards stay byte-identical.
const EN: SalaryLexicon = {
  timeframe: {
    per_year: 'Yearly',
    per_month: 'Monthly',
    per_week: 'Weekly',
    per_day: 'Daily',
    per_hour: 'Hourly',
  },
  rangePrefix: { from: 'From', upTo: 'Up to' },
  seniority: {
    entry_level: 'Entry level',
    associate: 'Associate',
    mid_level: 'Mid-level',
    senior: 'Senior',
    lead: 'Lead',
    principal: 'Principal',
    director: 'Director',
    executive: 'Executive',
  },
  frames: {
    entitySalariesTitle: ({ entity, range }) =>
      `${entity} Salaries (${range}/yr)`,
    salariesInPlaceTitle: ({ place, range }) =>
      `Salaries in ${place} (${range}/yr)`,
    salariesInPlaceTitleNoRange: ({ place }) => `Salaries in ${place}`,
    entitySalariesInPlaceTitle: ({ entity, place, range }) =>
      `${entity} Salaries in ${place} (${range}/yr)`,
    companySalariesTitle: ({ company, range }) =>
      `${company} Salaries${range ? ` (${range}/yr)` : ''}`,
    companyCategorySalariesTitle: ({ company, category, range }) =>
      `${company} ${category} Salaries${range ? ` (${range}/yr)` : ''}`,
    professionalsEarn: ({ entity, range, count }) =>
      `${entity} professionals earn ${range}/yr on average across ${count} job postings.`,
    rolesPay: ({ entity, range, count }) =>
      `${entity} roles pay ${range}/yr on average across ${count} job postings.`,
    professionalsInLocationEarn: ({ entity, place, range, count }) =>
      `${entity} professionals in ${place} earn ${range}/yr on average across ${count} job postings.`,
    seniorityRange: ({ lowLabel, lowAmount, highLabel, highAmount }) =>
      `${lowLabel} roles start at ${lowAmount}, ${highLabel} roles reach ${highAmount}.`,
    seniorityRangeWhile: ({ lowLabel, lowAmount, highLabel, highAmount }) =>
      `${lowLabel} salaries start at ${lowAmount}, while ${highLabel} roles reach ${highAmount}.`,
    compareAcrossTopPaying: ({ count }) =>
      `Compare across ${count} top-paying ${count === 1 ? 'company' : 'companies'}.`,
    compareAcrossTop: ({ count }) =>
      `Compare across ${count} top ${count === 1 ? 'company' : 'companies'}.`,
    boardWideAverage: ({ entity, range }) =>
      `Board-wide ${entity} average: ${range}/yr.`,
    averageSalaryInCity: ({ place, range, count }) =>
      `Average salary in ${place} is ${range}/yr across ${count} jobs. Browse salary data by title and skill.`,
    browseLocationsInRegion: ({ count, place }) =>
      `Browse salary data across ${count} locations in ${place}. Compare salaries by title, skill, and company.`,
    companyPays: ({ company, range, count }) =>
      `${company} pays ${range}/yr on average across ${count} job postings.`,
    breakdownAcrossCategories: ({ count }) =>
      `Breakdown across ${count} job ${count === 1 ? 'category' : 'categories'}.`,
    compareWithSimilar: ({ count }) =>
      `Compare with ${count} similar ${count === 1 ? 'company' : 'companies'}.`,
    salaryInfoFor: ({ company, board }) =>
      `Salary information for ${company} on ${board}.`,
    categoryRolesAtCompanyPay: ({ category, company, range, count }) =>
      `${category} roles at ${company} pay ${range}/yr based on ${count} job postings.`,
    categorySalaryDataFor: ({ category, company, board }) =>
      `${category} salary data for ${company} on ${board}.`,
  },
};

// German — native-reviewed. Seniority keeps the common English
// tech-ladder terms; `executive` → "Führungskraft".
const DE: SalaryLexicon = {
  timeframe: {
    per_year: 'pro Jahr',
    per_month: 'pro Monat',
    per_week: 'pro Woche',
    per_day: 'pro Tag',
    per_hour: 'pro Stunde',
  },
  rangePrefix: { from: 'ab', upTo: 'bis zu' },
  seniority: {
    entry_level: 'Entry-Level',
    associate: 'Associate',
    mid_level: 'Mid-Level',
    senior: 'Senior',
    lead: 'Lead',
    principal: 'Principal',
    director: 'Director',
    executive: 'Führungskraft',
  },
  frames: {
    entitySalariesTitle: ({ entity, range }) =>
      `${entity} Gehälter (${range}/Jahr)`,
    salariesInPlaceTitle: ({ place, range }) =>
      `Gehälter in ${place} (${range}/Jahr)`,
    salariesInPlaceTitleNoRange: ({ place }) => `Gehälter in ${place}`,
    entitySalariesInPlaceTitle: ({ entity, place, range }) =>
      `${entity} Gehälter in ${place} (${range}/Jahr)`,
    companySalariesTitle: ({ company, range }) =>
      `${company} Gehälter${range ? ` (${range}/Jahr)` : ''}`,
    companyCategorySalariesTitle: ({ company, category, range }) =>
      `${company} ${category} Gehälter${range ? ` (${range}/Jahr)` : ''}`,
    professionalsEarn: ({ entity, range, count }) =>
      `${entity}-Fachkräfte verdienen durchschnittlich ${range}/Jahr, basierend auf ${count} Stellenanzeigen.`,
    rolesPay: ({ entity, range, count }) =>
      `${entity}-Positionen werden mit durchschnittlich ${range}/Jahr vergütet, basierend auf ${count} Stellenanzeigen.`,
    professionalsInLocationEarn: ({ entity, place, range, count }) =>
      `${entity}-Fachkräfte in ${place} verdienen durchschnittlich ${range}/Jahr, basierend auf ${count} Stellenanzeigen.`,
    seniorityRange: ({ lowLabel, lowAmount, highLabel, highAmount }) =>
      `${lowLabel}-Positionen beginnen bei ${lowAmount}, ${highLabel}-Positionen erreichen ${highAmount}.`,
    seniorityRangeWhile: ({ lowLabel, lowAmount, highLabel, highAmount }) =>
      `${lowLabel}-Gehälter beginnen bei ${lowAmount}, während ${highLabel}-Positionen ${highAmount} erreichen.`,
    compareAcrossTopPaying: ({ count }) =>
      `Vergleichen Sie ${count} ${count === 1 ? 'bestzahlendes' : 'bestzahlende'} Unternehmen.`,
    compareAcrossTop: ({ count }) =>
      `Vergleichen Sie ${count} Top-Unternehmen.`,
    boardWideAverage: ({ entity, range }) =>
      `Gesamtdurchschnitt ${entity}: ${range}/Jahr.`,
    averageSalaryInCity: ({ place, range, count }) =>
      `Das Durchschnittsgehalt in ${place} beträgt ${range}/Jahr, basierend auf ${count} Stellen. Gehaltsdaten nach Titel und Fähigkeiten durchsuchen.`,
    browseLocationsInRegion: ({ count, place }) =>
      `Gehaltsdaten für ${count} Standorte in ${place} durchsuchen. Gehälter nach Titel, Fähigkeiten und Unternehmen vergleichen.`,
    companyPays: ({ company, range, count }) =>
      `${company} zahlt durchschnittlich ${range}/Jahr, basierend auf ${count} Stellenanzeigen.`,
    breakdownAcrossCategories: ({ count }) =>
      `Aufschlüsselung über ${count} Job-${count === 1 ? 'Kategorie' : 'Kategorien'}.`,
    compareWithSimilar: ({ count }) =>
      `Vergleichen Sie mit ${count} ähnlichen Unternehmen.`,
    salaryInfoFor: ({ company, board }) =>
      `Gehaltsinformationen für ${company} auf ${board}.`,
    categoryRolesAtCompanyPay: ({ category, company, range, count }) =>
      `${category}-Positionen bei ${company} werden mit ${range}/Jahr vergütet, basierend auf ${count} Stellenanzeigen.`,
    categorySalaryDataFor: ({ category, company, board }) =>
      `${category}-Gehaltsdaten für ${company} auf ${board}.`,
  },
};

const LEXICONS: Record<string, SalaryLexicon> = { en: EN, de: DE };

/**
 * Resolve the salary lexicon for a board language; unseeded locales fall back
 * to the English source.
 */
export function getSalaryLexicon(locale: string | undefined): SalaryLexicon {
  return (locale && LEXICONS[locale]) || EN;
}
