import { describe, expect, it } from 'vitest';

import { PUBLIC_LABEL_GROUPS, uiCopy } from './ui-copy';

import type { BoardLabelOverrides } from './ui-copy';

// The chrome-copy CATALOG: a versioned typed record per board
// language, resolved ⊕ the API-served operator override bag. These tests pin
// the three v1 languages, the unknown→en fallback, and the hosted
// `nestedStr` override semantics (empty/absent overrides never win).

describe('uiCopy — catalog resolution', () => {
  it('serves the English catalog with the registry blocks’ exact strings', () => {
    const copy = uiCopy('en');
    // en is the SOURCE: byte-identical to what the registry blocks render
    // today, so an `en` board’s output does not change.
    expect(copy.jobCard.featuredLabel).toBe('Featured');
    expect(copy.jobSearch.loadMoreLabel).toBe('Load more');
    expect(copy.jobSearch.noJobsMatchText).toBe(
      'No jobs match — try clearing a filter.',
    );
    expect(copy.jobSearch.keywordPlaceholder).toBe('Search jobs…');
    expect(copy.jobDetail.similarJobsHeading).toBe('Similar jobs');
    expect(copy.jobDetail.noDescriptionText).toBe('No description provided.');
    expect(copy.apply.applyButtonText).toBe('Apply for this job');
    expect(copy.apply.appliedViewApplicationsLabel).toBe(
      'Applied — view applications',
    );
    expect(copy.alerts.jobAlertSuccessToast).toBe(
      "If this email isn't already subscribed, we've sent a confirmation link — check your inbox.",
    );
    expect(copy.copyLink.copyLinkLabel).toBe('Copy link');
    expect(copy.salary.faqHeading).toBe('Frequently asked questions');
    expect(copy.entity.jobPlural).toBe('jobs');
  });

  it('serves hosted default English for the route-level groups (nav/footer/breadcrumbs/pagination/blog)', () => {
    const copy = uiCopy('en');
    // These groups mirror the hosted defaults exactly (board-settings-mapper
    // `nestedStr` defaults), so hosted-parity renders stay clean.
    expect(copy.nav.home).toBe('Jobs');
    expect(copy.nav.post).toBe('Post a job');
    expect(copy.footer.forCandidatesHeading).toBe('For Candidates');
    expect(copy.footer.copyrightPrefix).toBe('© {{year}} {{board_name}}.');
    expect(copy.breadcrumbs.home).toBe('Home');
    expect(copy.breadcrumbs.privacyPolicy).toBe('Privacy Policy');
    expect(copy.pagination.previousLabel).toBe('Previous');
    expect(copy.blog.readingTimeLabel).toBe('min read');
  });

  it('serves the German catalog (startup-insider transcription + native fills)', () => {
    const copy = uiCopy('de');
    // Transcribed from startup-insider’s stored overrides (prod pull).
    expect(copy.jobCard.featuredLabel).toBe('Hervorgehoben');
    expect(copy.jobCard.sortNewestLabel).toBe('Neueste zuerst');
    expect(copy.jobSearch.keywordPlaceholder).toBe(
      'Jobtitel oder -beschreibungen suchen',
    );
    expect(copy.alerts.jobAlertSuccessToast).toBe(
      'Falls diese E-Mail noch nicht abonniert ist, haben wir einen Bestätigungslink gesendet — prüfe deinen Posteingang.',
    );
    expect(copy.copyLink.copyLinkLabel).toBe('Link kopieren');
    expect(copy.breadcrumbs.home).toBe('Startseite');
    expect(copy.footer.privacyPolicyLabel).toBe('Datenschutzerklärung');
    // Native fills for keys the golden tenant left at English defaults.
    expect(copy.jobDetail.similarJobsHeading).toBe('Ähnliche Jobs');
    expect(copy.apply.applyButtonText).toBe('Jetzt bewerben');
    expect(copy.jobSearch.loadMoreLabel).toBe('Mehr laden');
  });

  it('serves the French catalog (the abstraction-prover)', () => {
    const copy = uiCopy('fr');
    expect(copy.jobCard.featuredLabel).toBe('À la une');
    expect(copy.breadcrumbs.home).toBe('Accueil');
    expect(copy.jobDetail.similarJobsHeading).toBe('Offres similaires');
    expect(copy.entity.jobPlural).toBe('offres');
  });

  it('falls back to English for unseeded languages', () => {
    expect(uiCopy('nl').jobCard.featuredLabel).toBe('Featured');
    expect(uiCopy(undefined).jobCard.featuredLabel).toBe('Featured');
    expect(uiCopy('').breadcrumbs.home).toBe('Home');
  });

  it('localizes the function keys (counts/interpolation)', () => {
    expect(uiCopy('en').jobDetail.experienceYears(3)).toBe('3+ years');
    expect(uiCopy('de').jobDetail.experienceYears(3)).toBe('3+ Jahre');
    expect(uiCopy('en').jobDetail.posted('5d ago')).toBe('Posted 5d ago');
    expect(uiCopy('de').jobDetail.posted('vor 5 Tagen')).toBe(
      'Veröffentlicht vor 5 Tagen',
    );
  });
});

describe('uiCopy — operator override bag (⊕ context.labels)', () => {
  const overrides: BoardLabelOverrides = {
    jobCardLabels: {
      featuredLabel: 'Top Job',
      // Empty/whitespace values are UNSET, hosted `nestedStr` semantics.
      copyLinkLabel: '  ',
      // Unknown keys are ignored, never merged.
      totallyUnknownKey: 'nope',
    },
    breadcrumbsLabels: { home: 'Start' },
    entityLabels: { jobPlural: 'Stellen' },
  };

  it('applies stored overrides on top of the catalog', () => {
    const copy = uiCopy('de', overrides);
    expect(copy.jobCard.featuredLabel).toBe('Top Job');
    expect(copy.breadcrumbs.home).toBe('Start');
    expect(copy.entity.jobPlural).toBe('Stellen');
  });

  it('ignores empty-string overrides and unknown keys', () => {
    const copy = uiCopy('de', overrides);
    expect(copy.copyLink.copyLinkLabel).toBe('Link kopieren');
    expect(
      (copy.jobCard as unknown as Record<string, unknown>).totallyUnknownKey,
    ).toBeUndefined();
  });

  it('leaves non-overridden keys and other groups on the catalog floor', () => {
    const copy = uiCopy('de', overrides);
    expect(copy.jobCard.sortNewestLabel).toBe('Neueste zuerst');
    expect(copy.footer.privacyPolicyLabel).toBe('Datenschutzerklärung');
  });

  it('resolves detail/apply/alert overrides from the hosted jobCardLabels grab-bag', () => {
    const copy = uiCopy('en', {
      jobCardLabels: {
        applyButtonText: 'Bewirb dich',
        jobAlertTitle: 'Job-Alarm',
        categoriesHeading: 'Bereiche',
      },
    });
    expect(copy.apply.applyButtonText).toBe('Bewirb dich');
    expect(copy.alerts.jobAlertTitle).toBe('Job-Alarm');
    expect(copy.jobDetail.categoriesHeading).toBe('Bereiche');
  });

  it('an empty bag is a no-op', () => {
    expect(uiCopy('de', {})).toEqual(uiCopy('de'));
    expect(uiCopy('de', undefined)).toEqual(uiCopy('de'));
  });

  it('salary keys carry the hosted override key names for their slots', () => {
    const copy = uiCopy('en', {
      salaryLabels: {
        comparisonHeadlineAverage: 'Ø-Gehaltsspanne',
        seniorityTableHeaderDiff: 'ggü. Board',
      },
    });
    expect(copy.salary.comparisonHeadlineAverage).toBe('Ø-Gehaltsspanne');
    expect(copy.salary.seniorityTableHeaderDiff).toBe('ggü. Board');
  });

  it('exports the canonical public-surfaces group list (the v1 bag allowlist)', () => {
    expect(PUBLIC_LABEL_GROUPS).toEqual([
      'jobCardLabels',
      'navLabels',
      'breadcrumbsLabels',
      'footerLabels',
      'entityLabels',
      'jobSearchLabels',
      'globalPaginationLabels',
      'blogSharedLabels',
      'salaryLabels',
    ]);
  });
});
