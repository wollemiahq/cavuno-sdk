/**
 * The board-chrome copy CATALOG — every user-visible string the
 * registry blocks (and the starter's public routes) render, as a typed
 * record per board language, beside the salary lexicon it patterns after:
 * plain strings plus functions-per-key where counts/interpolation demand it.
 * No i18n runtime, no provider — pure and RSC-safe.
 *
 * Resolution order (mirrors the hosted `BoardLabels` semantics exactly):
 * catalog floor (this file) ⊕ API-served operator overrides
 * (`board.context().labels`, the stored `jobBoardSettings.config.*Labels`
 * records) ⊕ per-board generated-code overrides. `uiCopy(language, labels)`
 * performs the first two; overrides use the hosted `nestedStr` rule — an
 * absent, non-string, or blank value never wins.
 *
 * Languages: `en` is the SOURCE — byte-identical to what the registry
 * blocks rendered before the catalog existed (en boards do not change), and
 * to the hosted defaults for the route-level groups (nav/footer/breadcrumbs/
 * pagination/blog). `de` is transcribed from startup-insider's stored
 * operator overrides (prod, 2026-07-03) with native fills in the same
 * informal register for the keys the golden tenant left at English defaults;
 * board-brand-specific values (e.g. its "© … GmbH" copyright) stay operator
 * data, not catalog floor. `fr` is a fresh set with no golden board behind
 * it — the abstraction-prover. Unseeded languages fall back to `en`.
 *
 * Override-key alignment: within each group, keys that have a hosted stored
 * counterpart carry the hosted key NAME (e.g. `featuredLabel`,
 * `keywordPlaceholder`), so applying a stored override record is a plain
 * same-key merge — no mapping table to drift. Keys with no hosted
 * counterpart yet are new names in the same style; they become overridable
 * the day hosted stores them.
 */

/**
 * The public-surfaces label groups (stored `jobBoardSettings.config` group
 * names) that ride the v1 board context as the `labels` bag. CANONICAL —
 * the API's server-side allowlist must list the same names.
 */
export const PUBLIC_LABEL_GROUPS = [
  'jobCardLabels',
  'navLabels',
  'breadcrumbsLabels',
  'footerLabels',
  'entityLabels',
  'jobSearchLabels',
  'globalPaginationLabels',
  'blogSharedLabels',
  'salaryLabels',
] as const;

/**
 * The operator-override bag as served by `GET /v1/boards/:identifier`
 * (`labels`): the stored `jobBoardSettings.config` label records, verbatim,
 * keyed by their config group names. Boards without overrides serve `{}`.
 */
export type BoardLabelOverrides = Partial<
  Record<(typeof PUBLIC_LABEL_GROUPS)[number], Record<string, string>>
>;

export interface JobCardCopy {
  featuredLabel: string;
  aiRankedLabel: string;
  sortNewestLabel: string;
  sortSalaryHighLabel: string;
}

export interface JobSearchCopy {
  headingJobs: string;
  keywordLabel: string;
  keywordPlaceholder: string;
  locationLabel: string;
  locationPlaceholder: string;
  workplacePlaceholder: string;
  anyWorkplaceLabel: string;
  typePlaceholder: string;
  anyTypeLabel: string;
  sortPlaceholder: string;
  loadMoreLabel: string;
  noJobsMatchText: string;
}

export interface JobDetailCopy {
  categoriesHeading: string;
  skillsHeading: string;
  additionalDetailsHeading: string;
  customFieldYesLabel: string;
  customFieldNoLabel: string;
  locationsLabel: string;
  workPermitsLabel: string;
  timezonesLabel: string;
  educationLabel: string;
  experienceLabel: string;
  worldwideLabel: string;
  noExperienceRequiredLabel: string;
  /** Fact-row value for a minimum-experience requirement, e.g. `3+ years`. */
  experienceYears(years: number): string;
  /** Header timestamp line, receives the already-formatted relative date. */
  posted(published: string): string;
  noDescriptionText: string;
  viewCompanyProfileLabel: string;
  similarJobsHeading: string;
  breadcrumbAriaLabel: string;
}

export interface ApplyCopy {
  applyButtonText: string;
  applyingLabel: string;
  applyOnEmployerSiteLabel: string;
  signInToApplyLabel: string;
  verifyEmailToApplyLabel: string;
  appliedViewApplicationsLabel: string;
  applicationSubmitError: string;
}

export interface AlertsCopy {
  jobAlertTitle: string;
  jobAlertEmailPlaceholder: string;
  jobAlertButtonText: string;
  subscribingLabel: string;
  jobAlertSuccessToast: string;
  jobAlertErrorToast: string;
  sectionAriaLabel: string;
  emailAriaLabel: string;
  submitAriaLabel: string;
}

export interface CopyLinkCopy {
  copyLinkLabel: string;
  copiedLabel: string;
  ariaLabel: string;
}

export interface SalaryCopy {
  /** Headline over the average range — hosted `comparisonHeadlineAverage`. */
  comparisonHeadlineAverage: string;
  perYearSuffix: string;
  comparisonPercentile25Label: string;
  medianLabel: string;
  comparisonPercentile75Label: string;
  basedOnLabel: string;
  seniorityTableHeaderLevel: string;
  seniorityTableHeaderAvg: string;
  boardBaselineLabel: string;
  /** Diff column header of the seniority table — hosted `seniorityTableHeaderDiff`. */
  seniorityTableHeaderDiff: string;
  faqHeading: string;
}

export interface NavCopy {
  home: string;
  companies: string;
  pricing: string;
  talent: string;
  post: string;
  blog: string;
}

export interface FooterCopy {
  forCandidatesHeading: string;
  forCompaniesHeading: string;
  resourcesHeading: string;
  aboutHeading: string;
  websiteLabel: string;
  aboutLabel: string;
  contactLabel: string;
  locationsLabel: string;
  salariesLabel: string;
  sitemapLabel: string;
  termsOfServiceLabel: string;
  privacyPolicyLabel: string;
  cookiePolicyLabel: string;
  impressumLabel: string;
  allRightsReservedText: string;
  /** Template, supports `{{year}}` and `{{board_name}}`. */
  copyrightPrefix: string;
  poweredByText: string;
  /** Template, supports `{{board_name}}`. */
  defaultDescription: string;
}

export interface BreadcrumbsCopy {
  home: string;
  jobs: string;
  locations: string;
  salaries: string;
  companies: string;
  skills: string;
  titles: string;
  blog: string;
  post: string;
  pricing: string;
  about: string;
  impressum: string;
  termsOfService: string;
  privacyPolicy: string;
  cookiePolicy: string;
  talent: string;
}

export interface PaginationCopy {
  ariaLabel: string;
  previousLabel: string;
  nextLabel: string;
}

export interface BlogCopy {
  bylineLabel: string;
  readingTimeLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  clearButtonLabel: string;
  tagFilterLabel: string;
  tagFilterAllLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyResetLabel: string;
}

/**
 * Entity nouns for count lines (`{count} {jobs}`). Lowercase in `en` —
 * the registry blocks' existing inline form — where the hosted defaults
 * capitalize; German capitalizes its nouns either way.
 */
export interface EntityCopy {
  jobSingular: string;
  jobPlural: string;
  companySingular: string;
  companyPlural: string;
}

export interface UiCopy {
  jobCard: JobCardCopy;
  jobSearch: JobSearchCopy;
  jobDetail: JobDetailCopy;
  apply: ApplyCopy;
  alerts: AlertsCopy;
  copyLink: CopyLinkCopy;
  salary: SalaryCopy;
  nav: NavCopy;
  footer: FooterCopy;
  breadcrumbs: BreadcrumbsCopy;
  pagination: PaginationCopy;
  blog: BlogCopy;
  entity: EntityCopy;
}

const EN: UiCopy = {
  jobCard: {
    featuredLabel: 'Featured',
    aiRankedLabel: 'AI-ranked',
    sortNewestLabel: 'Most recent',
    sortSalaryHighLabel: 'Salary: high to low',
  },
  jobSearch: {
    headingJobs: 'Jobs',
    keywordLabel: 'Keyword',
    keywordPlaceholder: 'Search jobs…',
    locationLabel: 'Location',
    locationPlaceholder: 'City or region',
    workplacePlaceholder: 'Workplace',
    anyWorkplaceLabel: 'Any workplace',
    typePlaceholder: 'Type',
    anyTypeLabel: 'Any type',
    sortPlaceholder: 'Sort',
    loadMoreLabel: 'Load more',
    noJobsMatchText: 'No jobs match — try clearing a filter.',
  },
  jobDetail: {
    categoriesHeading: 'Categories',
    skillsHeading: 'Skills',
    additionalDetailsHeading: 'Additional details',
    customFieldYesLabel: 'Yes',
    customFieldNoLabel: 'No',
    locationsLabel: 'Locations',
    workPermitsLabel: 'Work permits',
    timezonesLabel: 'Timezones',
    educationLabel: 'Education',
    experienceLabel: 'Experience',
    worldwideLabel: 'Worldwide',
    noExperienceRequiredLabel: 'No experience required',
    experienceYears: (years) => `${years}+ years`,
    posted: (published) => `Posted ${published}`,
    noDescriptionText: 'No description provided.',
    viewCompanyProfileLabel: 'View company profile',
    similarJobsHeading: 'Similar jobs',
    breadcrumbAriaLabel: 'Breadcrumb',
  },
  apply: {
    applyButtonText: 'Apply for this job',
    applyingLabel: 'Applying…',
    applyOnEmployerSiteLabel: 'Apply on employer site',
    signInToApplyLabel: 'Sign in to apply',
    verifyEmailToApplyLabel: 'Verify email to apply',
    appliedViewApplicationsLabel: 'Applied — view applications',
    applicationSubmitError: 'Something went wrong. Please try again.',
  },
  alerts: {
    jobAlertTitle: 'Get job alerts',
    jobAlertEmailPlaceholder: 'you@example.com',
    jobAlertButtonText: 'Get alerts',
    subscribingLabel: 'Subscribing…',
    jobAlertSuccessToast:
      "If this email isn't already subscribed, we've sent a confirmation link — check your inbox.",
    jobAlertErrorToast: 'Something went wrong. Please try again.',
    sectionAriaLabel: 'Job alerts',
    emailAriaLabel: 'email',
    submitAriaLabel: 'get job alerts',
  },
  copyLink: {
    copyLinkLabel: 'Copy link',
    copiedLabel: 'Copied',
    ariaLabel: 'copy link',
  },
  salary: {
    comparisonHeadlineAverage: 'Average salary',
    perYearSuffix: '/ year',
    comparisonPercentile25Label: '25th percentile',
    medianLabel: 'Median',
    comparisonPercentile75Label: '75th percentile',
    basedOnLabel: 'Based on',
    seniorityTableHeaderLevel: 'Level',
    seniorityTableHeaderAvg: 'Average',
    boardBaselineLabel: 'Board baseline',
    seniorityTableHeaderDiff: 'vs. board',
    faqHeading: 'Frequently asked questions',
  },
  nav: {
    home: 'Jobs',
    companies: 'Companies',
    pricing: 'Pricing',
    talent: 'Talent',
    post: 'Post a job',
    blog: 'Blog',
  },
  footer: {
    forCandidatesHeading: 'For Candidates',
    forCompaniesHeading: 'For Companies',
    resourcesHeading: 'Resources',
    aboutHeading: 'About',
    websiteLabel: 'Website',
    aboutLabel: 'About',
    contactLabel: 'Contact us',
    locationsLabel: 'Locations',
    salariesLabel: 'Salaries',
    sitemapLabel: 'Sitemap',
    termsOfServiceLabel: 'Terms of Service',
    privacyPolicyLabel: 'Privacy Policy',
    cookiePolicyLabel: 'Cookie Policy',
    impressumLabel: 'Impressum',
    allRightsReservedText: 'All rights reserved.',
    copyrightPrefix: '© {{year}} {{board_name}}.',
    poweredByText: 'Powered by',
    defaultDescription: 'Discover the latest roles from {{board_name}}.',
  },
  breadcrumbs: {
    home: 'Home',
    jobs: 'Jobs',
    locations: 'Locations',
    salaries: 'Salaries',
    companies: 'Companies',
    skills: 'Skills',
    titles: 'Titles',
    blog: 'Blog',
    post: 'Post a Job',
    pricing: 'Pricing',
    about: 'About',
    impressum: 'Impressum',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    cookiePolicy: 'Cookie Policy',
    talent: 'Talent',
  },
  pagination: {
    ariaLabel: 'Pagination',
    previousLabel: 'Previous',
    nextLabel: 'Next',
  },
  blog: {
    bylineLabel: 'By',
    readingTimeLabel: 'min read',
    searchLabel: 'Search',
    searchPlaceholder: 'Search posts...',
    clearButtonLabel: 'Clear search',
    tagFilterLabel: 'Topics',
    tagFilterAllLabel: 'All',
    emptyTitle: 'No matching posts',
    emptyDescription: 'Try adjusting your search or clearing your filters.',
    emptyResetLabel: 'Clear filters',
  },
  entity: {
    jobSingular: 'job',
    jobPlural: 'jobs',
    companySingular: 'company',
    companyPlural: 'companies',
  },
};

// German — startup-insider transcription (informal register), native fills
// for the keys the golden tenant left at English defaults.
const DE: UiCopy = {
  jobCard: {
    featuredLabel: 'Hervorgehoben',
    aiRankedLabel: 'KI-sortiert',
    sortNewestLabel: 'Neueste zuerst',
    sortSalaryHighLabel: 'Gehalt: absteigend',
  },
  jobSearch: {
    headingJobs: 'Jobs',
    keywordLabel: 'Stichwort',
    keywordPlaceholder: 'Jobtitel oder -beschreibungen suchen',
    locationLabel: 'Standort',
    locationPlaceholder: 'Stadt, Land oder Region',
    workplacePlaceholder: 'Arbeitsmodell',
    anyWorkplaceLabel: 'Alle Arbeitsmodelle',
    typePlaceholder: 'Anstellungsart',
    anyTypeLabel: 'Alle Anstellungsarten',
    sortPlaceholder: 'Sortieren',
    loadMoreLabel: 'Mehr laden',
    noJobsMatchText: 'Keine passenden Jobs — setze einen Filter zurück.',
  },
  jobDetail: {
    categoriesHeading: 'Kategorien',
    skillsHeading: 'Fähigkeiten',
    additionalDetailsHeading: 'Weitere Details',
    customFieldYesLabel: 'Ja',
    customFieldNoLabel: 'Nein',
    locationsLabel: 'Standorte',
    workPermitsLabel: 'Arbeitserlaubnis',
    timezonesLabel: 'Zeitzonen',
    educationLabel: 'Ausbildung',
    experienceLabel: 'Berufserfahrung',
    worldwideLabel: 'Weltweit',
    noExperienceRequiredLabel: 'Keine Berufserfahrung erforderlich',
    experienceYears: (years) => `${years}+ Jahre`,
    posted: (published) => `Veröffentlicht ${published}`,
    noDescriptionText: 'Keine Beschreibung vorhanden.',
    viewCompanyProfileLabel: 'Unternehmensprofil ansehen',
    similarJobsHeading: 'Ähnliche Jobs',
    breadcrumbAriaLabel: 'Seitenpfad',
  },
  apply: {
    applyButtonText: 'Jetzt bewerben',
    applyingLabel: 'Wird gesendet …',
    applyOnEmployerSiteLabel: 'Beim Unternehmen bewerben',
    signInToApplyLabel: 'Zum Bewerben anmelden',
    verifyEmailToApplyLabel: 'E-Mail bestätigen, um dich zu bewerben',
    appliedViewApplicationsLabel: 'Beworben — Bewerbungen ansehen',
    applicationSubmitError:
      'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
  },
  alerts: {
    jobAlertTitle: 'Job-Benachrichtigungen erhalten',
    jobAlertEmailPlaceholder: 'name@beispiel.de',
    jobAlertButtonText: 'Abonnieren',
    subscribingLabel: 'Wird abonniert …',
    jobAlertSuccessToast:
      'Falls diese E-Mail noch nicht abonniert ist, haben wir einen Bestätigungslink gesendet — prüfe deinen Posteingang.',
    jobAlertErrorToast: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    sectionAriaLabel: 'Job-Benachrichtigungen',
    emailAriaLabel: 'E-Mail',
    submitAriaLabel: 'Job-Benachrichtigungen erhalten',
  },
  copyLink: {
    copyLinkLabel: 'Link kopieren',
    copiedLabel: 'Kopiert',
    ariaLabel: 'Link kopieren',
  },
  salary: {
    comparisonHeadlineAverage: 'Durchschnittsgehalt',
    perYearSuffix: '/ Jahr',
    comparisonPercentile25Label: '25. Perzentil',
    medianLabel: 'Median',
    comparisonPercentile75Label: '75. Perzentil',
    basedOnLabel: 'Basierend auf',
    seniorityTableHeaderLevel: 'Erfahrungslevel',
    seniorityTableHeaderAvg: 'Durchschnitt',
    boardBaselineLabel: 'Board-Durchschnitt',
    seniorityTableHeaderDiff: 'vs. Board',
    faqHeading: 'Häufig gestellte Fragen',
  },
  nav: {
    home: 'Jobs',
    companies: 'Unternehmen',
    pricing: 'Preise',
    talent: 'Talente',
    post: 'Job veröffentlichen',
    blog: 'Blog',
  },
  footer: {
    forCandidatesHeading: 'Für Kandidaten',
    forCompaniesHeading: 'Für Unternehmen',
    resourcesHeading: 'Ressourcen',
    aboutHeading: 'Über uns',
    websiteLabel: 'Website',
    aboutLabel: 'Über uns',
    contactLabel: 'Kontakt',
    locationsLabel: 'Standorte',
    salariesLabel: 'Gehälter',
    sitemapLabel: 'Sitemap',
    termsOfServiceLabel: 'Nutzungsbedingungen',
    privacyPolicyLabel: 'Datenschutzerklärung',
    cookiePolicyLabel: 'Cookie-Richtlinie',
    impressumLabel: 'Impressum',
    allRightsReservedText: 'Alle Rechte vorbehalten.',
    copyrightPrefix: '© {{year}} {{board_name}}.',
    poweredByText: 'Bereitgestellt von',
    defaultDescription: 'Entdecke die neuesten Stellen von {{board_name}}.',
  },
  breadcrumbs: {
    home: 'Startseite',
    jobs: 'Jobs',
    locations: 'Standorte',
    salaries: 'Gehälter',
    companies: 'Unternehmen',
    skills: 'Fähigkeiten',
    titles: 'Berufsbezeichnungen',
    blog: 'Blog',
    post: 'Job veröffentlichen',
    pricing: 'Preise',
    about: 'Über uns',
    impressum: 'Impressum',
    termsOfService: 'Nutzungsbedingungen',
    privacyPolicy: 'Datenschutzerklärung',
    cookiePolicy: 'Cookie-Richtlinie',
    talent: 'Talente',
  },
  pagination: {
    ariaLabel: 'Seitennummerierung',
    previousLabel: 'Zurück',
    nextLabel: 'Weiter',
  },
  blog: {
    bylineLabel: 'Von',
    readingTimeLabel: 'Minuten Lesezeit',
    searchLabel: 'Suche',
    searchPlaceholder: 'Artikel suchen...',
    clearButtonLabel: 'Suche leeren',
    tagFilterLabel: 'Themen',
    tagFilterAllLabel: 'Alle',
    emptyTitle: 'Keine passenden Artikel gefunden',
    emptyDescription:
      'Versuche, deine Suche anzupassen oder die Filter zurückzusetzen.',
    emptyResetLabel: 'Filter zurücksetzen',
  },
  entity: {
    jobSingular: 'Job',
    jobPlural: 'Jobs',
    companySingular: 'Unternehmen',
    companyPlural: 'Unternehmen',
  },
};

// French — fresh set (formal register), no golden tenant behind it: the
// abstraction-prover.
const FR: UiCopy = {
  jobCard: {
    featuredLabel: 'À la une',
    aiRankedLabel: 'Classement IA',
    sortNewestLabel: 'Plus récentes',
    sortSalaryHighLabel: 'Salaire : décroissant',
  },
  jobSearch: {
    headingJobs: "Offres d'emploi",
    keywordLabel: 'Mot-clé',
    keywordPlaceholder: 'Rechercher une offre…',
    locationLabel: 'Lieu',
    locationPlaceholder: 'Ville ou région',
    workplacePlaceholder: 'Mode de travail',
    anyWorkplaceLabel: 'Tous les modes de travail',
    typePlaceholder: 'Type de contrat',
    anyTypeLabel: 'Tous les types',
    sortPlaceholder: 'Trier',
    loadMoreLabel: 'Voir plus',
    noJobsMatchText:
      'Aucune offre ne correspond — essayez de retirer un filtre.',
  },
  jobDetail: {
    categoriesHeading: 'Catégories',
    skillsHeading: 'Compétences',
    additionalDetailsHeading: 'Informations complémentaires',
    customFieldYesLabel: 'Oui',
    customFieldNoLabel: 'Non',
    locationsLabel: 'Lieux',
    workPermitsLabel: 'Permis de travail',
    timezonesLabel: 'Fuseaux horaires',
    educationLabel: 'Formation',
    experienceLabel: 'Expérience',
    worldwideLabel: 'Monde entier',
    noExperienceRequiredLabel: 'Aucune expérience requise',
    experienceYears: (years) => `${years}+ ans`,
    posted: (published) => `Publiée ${published}`,
    noDescriptionText: 'Aucune description fournie.',
    viewCompanyProfileLabel: "Voir le profil de l'entreprise",
    similarJobsHeading: 'Offres similaires',
    breadcrumbAriaLabel: "Fil d'Ariane",
  },
  apply: {
    applyButtonText: 'Postuler à cette offre',
    applyingLabel: 'Envoi en cours…',
    applyOnEmployerSiteLabel: "Postuler sur le site de l'employeur",
    signInToApplyLabel: 'Connectez-vous pour postuler',
    verifyEmailToApplyLabel: 'Vérifiez votre e-mail pour postuler',
    appliedViewApplicationsLabel: 'Candidature envoyée — voir mes candidatures',
    applicationSubmitError: 'Une erreur est survenue. Veuillez réessayer.',
  },
  alerts: {
    jobAlertTitle: 'Recevoir des alertes emploi',
    jobAlertEmailPlaceholder: 'vous@exemple.fr',
    jobAlertButtonText: 'Activer les alertes',
    subscribingLabel: 'Abonnement en cours…',
    jobAlertSuccessToast:
      "Si cet e-mail n'est pas déjà abonné, nous avons envoyé un lien de confirmation — vérifiez votre boîte de réception.",
    jobAlertErrorToast: 'Une erreur est survenue. Veuillez réessayer.',
    sectionAriaLabel: 'Alertes emploi',
    emailAriaLabel: 'e-mail',
    submitAriaLabel: 'recevoir des alertes emploi',
  },
  copyLink: {
    copyLinkLabel: 'Copier le lien',
    copiedLabel: 'Copié',
    ariaLabel: 'copier le lien',
  },
  salary: {
    comparisonHeadlineAverage: 'Salaire moyen',
    perYearSuffix: '/ an',
    comparisonPercentile25Label: '25e percentile',
    medianLabel: 'Médiane',
    comparisonPercentile75Label: '75e percentile',
    basedOnLabel: 'Basé sur',
    seniorityTableHeaderLevel: 'Niveau',
    seniorityTableHeaderAvg: 'Moyenne',
    boardBaselineLabel: 'Référence du site',
    seniorityTableHeaderDiff: 'vs site',
    faqHeading: 'Questions fréquentes',
  },
  nav: {
    home: 'Offres',
    companies: 'Entreprises',
    pricing: 'Tarifs',
    talent: 'Talents',
    post: 'Publier une offre',
    blog: 'Blog',
  },
  footer: {
    forCandidatesHeading: 'Pour les candidats',
    forCompaniesHeading: 'Pour les entreprises',
    resourcesHeading: 'Ressources',
    aboutHeading: 'À propos',
    websiteLabel: 'Site web',
    aboutLabel: 'À propos',
    contactLabel: 'Nous contacter',
    locationsLabel: 'Lieux',
    salariesLabel: 'Salaires',
    sitemapLabel: 'Plan du site',
    termsOfServiceLabel: "Conditions d'utilisation",
    privacyPolicyLabel: 'Politique de confidentialité',
    cookiePolicyLabel: 'Politique de cookies',
    impressumLabel: 'Mentions légales',
    allRightsReservedText: 'Tous droits réservés.',
    copyrightPrefix: '© {{year}} {{board_name}}.',
    poweredByText: 'Propulsé par',
    defaultDescription: 'Découvrez les dernières offres de {{board_name}}.',
  },
  breadcrumbs: {
    home: 'Accueil',
    jobs: 'Offres',
    locations: 'Lieux',
    salaries: 'Salaires',
    companies: 'Entreprises',
    skills: 'Compétences',
    titles: 'Intitulés de poste',
    blog: 'Blog',
    post: 'Publier une offre',
    pricing: 'Tarifs',
    about: 'À propos',
    impressum: 'Mentions légales',
    termsOfService: "Conditions d'utilisation",
    privacyPolicy: 'Politique de confidentialité',
    cookiePolicy: 'Politique de cookies',
    talent: 'Talents',
  },
  pagination: {
    ariaLabel: 'Pagination',
    previousLabel: 'Précédent',
    nextLabel: 'Suivant',
  },
  blog: {
    bylineLabel: 'Par',
    readingTimeLabel: 'min de lecture',
    searchLabel: 'Recherche',
    searchPlaceholder: 'Rechercher un article...',
    clearButtonLabel: 'Effacer la recherche',
    tagFilterLabel: 'Thèmes',
    tagFilterAllLabel: 'Tous',
    emptyTitle: 'Aucun article correspondant',
    emptyDescription:
      'Essayez de modifier votre recherche ou de réinitialiser les filtres.',
    emptyResetLabel: 'Réinitialiser les filtres',
  },
  entity: {
    jobSingular: 'offre',
    jobPlural: 'offres',
    companySingular: 'entreprise',
    companyPlural: 'entreprises',
  },
};

const CATALOGS: Record<string, UiCopy> = { en: EN, de: DE, fr: FR };

/**
 * Apply a stored override record onto one catalog group: same-key merge,
 * hosted `nestedStr` semantics — only a non-blank string override over a
 * string catalog key wins. Function keys and unknown override keys are
 * never merged.
 */
function mergeGroup<G extends object>(
  group: G,
  overrides: Record<string, string> | undefined,
): G {
  if (!overrides) return group;
  const out = { ...group } as Record<string, unknown>;
  for (const [key, value] of Object.entries(group)) {
    if (typeof value !== 'string') continue;
    const override = overrides[key];
    if (typeof override === 'string' && override.trim() !== '') {
      out[key] = override;
    }
  }
  return out as G;
}

/**
 * Catalog group → the stored config group its overrides live in. The four
 * detail/apply/alerts/copy-link groups all read the hosted `jobCardLabels`
 * grab-bag — that is a fact of the hosted data model, encoded here as data.
 */
const GROUP_OVERRIDE_SOURCE: Record<
  keyof UiCopy,
  (typeof PUBLIC_LABEL_GROUPS)[number]
> = {
  jobCard: 'jobCardLabels',
  jobSearch: 'jobSearchLabels',
  jobDetail: 'jobCardLabels',
  apply: 'jobCardLabels',
  alerts: 'jobCardLabels',
  copyLink: 'jobCardLabels',
  salary: 'salaryLabels',
  nav: 'navLabels',
  footer: 'footerLabels',
  breadcrumbs: 'breadcrumbsLabels',
  pagination: 'globalPaginationLabels',
  blog: 'blogSharedLabels',
  entity: 'entityLabels',
};

/**
 * Resolve the chrome copy for a board language ⊕ its operator overrides
 * (`board.context().labels`). Unseeded languages fall back to the English
 * source. Pure and RSC-safe — call it wherever the `language` prop already
 * flows.
 *
 * @example
 * uiCopy('de').jobCard.featuredLabel;                      // "Hervorgehoben"
 * uiCopy('de', board.labels).jobCard.featuredLabel;        // "Top Job" (override)
 * uiCopy('xx').jobCard.featuredLabel;                      // "Featured" (fallback)
 */
export function uiCopy(
  language: string | undefined,
  labels?: BoardLabelOverrides,
): UiCopy {
  const catalog = (language && CATALOGS[language]) || EN;
  if (!labels) return catalog;
  const resolved = {} as Record<keyof UiCopy, object>;
  for (const [group, source] of Object.entries(GROUP_OVERRIDE_SOURCE) as Array<
    [keyof UiCopy, (typeof PUBLIC_LABEL_GROUPS)[number]]
  >) {
    resolved[group] = mergeGroup(catalog[group], labels[source]);
  }
  return resolved as UiCopy;
}
