import {
  BoardClient,
  type BoardRequest,
  type FetchOptions,
  type Logger,
} from './client';
import { DEFAULT_CAVUNO_API_URL } from './constants';
import { authNamespace } from './namespaces/auth';
import { blogNamespace } from './namespaces/blog';
import { companiesNamespace } from './namespaces/companies';
import { embedNamespace } from './namespaces/embed';
import { jobAlertsNamespace } from './namespaces/job-alerts';
import { jobPostingNamespace } from './namespaces/job-posting';
import { jobsNamespace } from './namespaces/jobs';
import { meNamespace } from './namespaces/me';
import { passwordNamespace } from './namespaces/password';
import { paywallNamespace } from './namespaces/paywall';
import { plansNamespace } from './namespaces/plans';
import { redirectsNamespace } from './namespaces/redirects';
import { salariesNamespace } from './namespaces/salaries';
import { searchNamespace } from './namespaces/search';
import { sitemapNamespace } from './namespaces/sitemap';
import { talentNamespace } from './namespaces/talent';
import { taxonomyNamespace } from './namespaces/taxonomy';
import { type Awaitable, type StorageMode, resolveStorage } from './storage';

import type { PublicBoard } from './types/board';
import type { BoardSeo } from './types/seo';

export interface CreateBoardClientOptions {
  /** Cavuno API origin. Defaults to the production service. */
  baseUrl?: string;
  /** Board identifier: `pk_…` key (provisioned default) | `boards_…` ID | slug. */
  board: string;
  auth?: {
    /** Default: `'memory'` in the browser, `'nostore'` on the server. */
    storage?: StorageMode;
  };
  globalHeaders?: Record<string, string>;
  onRequest?: (req: BoardRequest) => Awaitable<BoardRequest>;
  onResponse?: (res: Response, req: BoardRequest) => Awaitable<void>;
  logger?: Logger;
}

/**
 * Create a Board API client.
 *
 * Isomorphic (browser, Workers, Node ≥ 20), zero dependencies. One
 * module-scoped instance is safe under SSR as long as per-user state
 * stays per-call (`options.headers`) rather than in `auth.storage`.
 *
 * @example
 * import { createBoardClient } from '@cavuno/board';
 *
 * const board = createBoardClient({
 *   board: 'pk_a8f3…',
 * });
 * const { data } = await board.jobs.list({ limit: 20 });
 */
export function createBoardClient(options: CreateBoardClientOptions) {
  const client = new BoardClient({
    baseUrl: options.baseUrl ?? DEFAULT_CAVUNO_API_URL,
    board: options.board,
    storage: resolveStorage(options.auth?.storage, options.board),
    globalHeaders: options.globalHeaders,
    onRequest: options.onRequest,
    onResponse: options.onResponse,
    logger: options.logger,
  });

  return {
    /**
     * Escape hatch: raw typed request through the full pipeline (board
     * base path, default headers, bearer token, hooks). Custom
     * endpoints work without an SDK release.
     */
    client,

    /**
     * Board context — identity, brand (`logoUrl` + favicon `icons`), language,
     * features, analytics, and AdSense (`ads.enabled` + `ads.clientId`).
     * Per-placement slot ids are not on this resource.
     *
     * @example
     * const { name, language, logoUrl, icons, ads } = await board.context();
     */
    context(options?: FetchOptions) {
      return client.fetch<PublicBoard>('', options);
    },

    /**
     * Board SEO infra tokens — `ads.txt`, IndexNow key, Google site-verification,
     * canonical base URL, and `manifest.name`. Favicon / app-icon URLs are
     * brand identity on `board.context()` (`logoUrl` + `icons`).
     *
     * @example
     * const { adsTxt, canonicalBase } = await board.seo();
     */
    seo(options?: FetchOptions) {
      return client.fetch<BoardSeo>('/seo', options);
    },

    jobs: jobsNamespace(client),
    embed: embedNamespace(client),
    companies: companiesNamespace(client),
    blog: blogNamespace(client),
    auth: authNamespace(client),
    me: meNamespace(client),
    password: passwordNamespace(client),
    taxonomy: taxonomyNamespace(client),
    search: searchNamespace(client),
    redirects: redirectsNamespace(client),
    jobAlerts: jobAlertsNamespace(client),
    jobPosting: jobPostingNamespace(client),
    salaries: salariesNamespace(client),
    talent: talentNamespace(client),
    plans: plansNamespace(client),
    paywall: paywallNamespace(client),
    sitemap: sitemapNamespace(client),
  };
}

export type BoardSdk = ReturnType<typeof createBoardClient>;

export { BoardClient } from './client';
export type { BoardRequest, FetchOptions, Logger } from './client';
export {
  BOARD_API_ERROR_CODES,
  BoardApiError,
  isBoardApiError,
  isBoardPasswordRequired,
  isConflict,
  isFreeEmailWebsiteError,
  isForbidden,
  isNotFound,
  isRateLimited,
  isUnauthorized,
  isValidationError,
} from './errors';
export type { BoardApiErrorCode } from './errors';
export {
  ACCESS_TOKEN_KEY,
  BOARD_ACCESS_GRANT_KEY,
  REFRESH_TOKEN_KEY,
} from './storage';
export type { Awaitable, CustomStorage, StorageMode } from './storage';
export { paginate } from './pagination';
export type { Paginator } from './pagination';
export { SDK_VERSION } from './version';
// Message-thread derivations — pure exports on the
// core entry, next to the `me.conversations` surface they derive from.
export { isColdRule, isOwnMessage, lastOwnMessageId } from './messaging-derive';
// Apply-flow derivations — pure
// exports on the core entry, next to the `jobs` surface they derive from.
export {
  isSafeApplicationUrl,
  resolveApplyAction,
  resolveApplyDecision,
} from './apply-derive';
export type { ApplyAction, ApplyDecisionState } from './apply-derive';

export type {
  BoardAuthSession,
  BoardUser,
  ForgotPasswordBody,
  LoginBody,
  LogoutBody,
  ConsumeMagicLinkBody,
  OAuthAuthorizationQuery,
  OAuthAuthorizationUrl,
  OAuthExchangeBody,
  OAuthProvider,
  RefreshBody,
  RegisterBody,
  RequestMagicLinkBody,
  ResetPasswordBody,
  VerifyEmailBody,
} from './types/auth';
export type {
  CustomFieldDefinition,
  CustomFieldOption,
  CustomFieldType,
  PublicBoard,
  PublicBoardAds,
  PublicBoardAnalytics,
  PublicBoardFeatures,
  PublicBoardJobForm,
} from './types/board';
export type { BoardSeo } from './types/seo';
export type { EmbedJobsQuery } from './types/embed';
export type { BoardAccessGrant } from './types/password';
export type { MarketingConsent } from './types/marketing-consent';
export type { RedirectResolution } from './types/redirects';
export type { ApplyIntent, CreateApplyIntentBody } from './types/apply-intents';
export type {
  ApplyApprovalPlan,
  ApplyApprovalReceipt,
  CreateApplyApprovalBody,
} from './types/apply-approvals';
export type {
  BlogAuthorEmbed,
  BlogPostsListQuery,
  BlogSearchBody,
  BlogSimilarQuery,
  BlogTagEmbed,
  PublicBlogAdjacentPosts,
  PublicBlogAuthor,
  PublicBlogPost,
  PublicBlogPostSummary,
  PublicBlogTag,
} from './types/blog';
export type {
  JobCatalogPagination,
  ListEnvelope,
  OffsetPagination,
  SearchEnvelope,
  StorefrontPagination,
} from './types/common';
export type {
  CompaniesListQuery,
  CompaniesSearchBody,
  CompanyCategorySalary,
  CompanyJobsListQuery,
  CompanyListEnvelope,
  CompanyMarket,
  CompanyMarketRef,
  CompanyMarketsListQuery,
  CompanySalary,
  CompanySalarySummary,
  CompanySimilarQuery,
  PublicCompany,
  PublicCompanyDetail,
  PublicCompanyMembership,
} from './types/companies';
export type {
  TalentDirectoryEntry,
  TalentDirectoryListEnvelope,
  TalentDirectoryQuery,
  TalentProfile,
} from './types/talent';
export type {
  Plan,
  PlanListEnvelope,
  PlansListQuery,
  SalesLedPlan,
  SalesLedPlanListEnvelope,
} from './types/plans';
// Candidate job-access paywall — `board.paywall.*` (public)
// + `board.me.access.*` (authed).
export type {
  AccessCheckoutBody,
  AccessCheckoutSession,
  AccessCheckoutSessionState,
  AccessGrant,
  AccessPortalBody,
  AccessPortalSession,
  PaywallOffer,
  PaywallOfferListEnvelope,
} from './types/paywall';
export type {
  EducationRequirement,
  EmploymentType,
  JobCompany,
  JobsListQuery,
  JobsSearchBody,
  JobsSimilarQuery,
  JobCardListEnvelope,
  JobCardSearchEnvelope,
  CustomFieldValue,
  CustomFieldValues,
  JobSort,
  OfficeLocation,
  PublicJob,
  PublicJobCard,
  RelatedSearch,
  RemoteOption,
  RemotePermit,
  RemoteTimezone,
  Seniority,
} from './types/jobs';
export type {
  Alert,
  AlertBody,
  Application,
  ApplicationsListQuery,
  ApplyBody,
  Block,
  BlockStatus,
  BlockUserBody,
  BlockedUser,
  CandidateAvatar,
  CandidateEducation,
  CandidateExperience,
  CandidateLanguage,
  CandidateProfile,
  CandidateSkill,
  Conversation,
  ConversationArchive,
  ConversationDetail,
  ConversationRef,
  ConversationsListQuery,
  CreateEducationBody,
  CreateExperienceBody,
  EditMessageBody,
  FindExistingConversationQuery,
  HandleAvailability,
  Message,
  ModerationReport,
  NotificationPreference,
  ReadReceipt,
  ReplyBody,
  ReportBody,
  Resume,
  ResumeUploadOptions,
  RecommendedJob,
  RecommendedJobsListQuery,
  SaveJobBody,
  SavedJob,
  SavedJobsListQuery,
  StartAboutApplicationBody,
  StartConversationBody,
  ThreadMessagesQuery,
  UnreadCount,
  UnsubscribeBody,
  UpdateApplicationFactsBody,
  UpdateCandidateProfileBody,
  UpdateEducationBody,
  UpdateExperienceBody,
  UpdateLanguagesBody,
  UpdateNotificationPreferenceBody,
  UpdatePasswordBody,
  UpdateSkillsBody,
  RequestEmailChangeBody,
  ConfirmEmailChangeBody,
} from './types/me';
// Employer self-service surface — `board.me.companies.*`.
export type {
  AddApplicantNoteBody,
  BulkMoveApplicantsBody,
  BulkRejectApplicantsBody,
  AcceptCompanyMemberInviteBody,
  ClaimableCompany,
  CompanyBillingPortalBody,
  CompanyBillingPortalSession,
  CompanyMember,
  CompanyMemberInvite,
  CompanyMemberInviteAcceptance,
  CompanyMembership,
  ConfirmWorkEmailBody,
  CreateCompanyBody,
  CreateCompanyMemberInviteBody,
  CreateEmployerJobBody,
  CreatePipelineStageBody,
  EmployerApplicant,
  EmployerBillingOption,
  EmployerCheckout,
  EmployerCheckoutBody,
  EmployerCompany,
  EmployerCompanySearchQuery,
  EmployerJob,
  EmployerJobStat,
  EmployerJobStatsPoint,
  EmployerJobStatsTimeseriesQuery,
  EmployerProfileStats,
  EmployerProfileViewsPoint,
  EmployerProfileViewsTimeseriesQuery,
  EmployerJobsListQuery,
  EmployerJobSummary,
  EmployerPipeline,
  EmployerPipelineQuery,
  EmployerPipelineStage,
  MoveApplicantStageBody,
  RecommendedTalent,
  RecommendedTalentListQuery,
  AddSourcedCandidateBody,
  ConvertSourcedCandidateBody,
  CreateTalentListBody,
  SourcedCandidate,
  TalentList,
  TalentListFilters,
  UpdateTalentListBody,
  ReorderPipelineStagesBody,
  SendWorkEmailBody,
  TalentAccess,
  TalentAccessCheckoutBody,
  TalentAccessCheckoutSession,
  TalentAccessCheckoutSessionState,
  TalentAccessUpgrade,
  TalentAccessUpgradeBody,
  TalentCandidateAccess,
  TalentUnlock,
  TalentUnlockBody,
  UpdateCompanyMemberRoleBody,
  UpdateEmployerCompanyBody,
  UpdateEmployerJobBody,
  UpdatePipelineStageBody,
} from './types/me';
export type {
  JobAlertConfirmation,
  JobAlertDeletePreferenceInput,
  JobAlertFiltersInput,
  JobAlertFrequency,
  JobAlertManageQuery,
  JobAlertManageResult,
  JobAlertManageState,
  JobAlertManageTokenInput,
  JobAlertPreference,
  JobAlertRemoteOption,
  JobAlertResendResult,
  JobAlertStoredFilters,
  JobAlertSubscribeInput,
  JobAlertSubscription,
  JobAlertUpdatePreferenceInput,
} from './types/job-alerts';
export type {
  CreateJobPostingInput,
  JobPostingBillingOptions,
  JobPostingBillingVerification,
  JobPostingLogoResult,
  JobPostingPlan,
  JobPostingResult,
} from './types/job-posting';
export type {
  PlacesListQuery,
  PublicPlace,
  RemotePermitTaxonomyEntry,
  PublicTaxonomyTerm,
  TaxonomyGeo,
  TaxonomyListQuery,
  TaxonomyResolution,
} from './types/taxonomy';
export type {
  CompanySuggestion,
  MarketSuggestion,
  SearchSuggestQuery,
  SearchSuggestType,
  SuggestResult,
  SuggestionItem,
  TermSuggestion,
} from './types/search';
export type {
  BoardSitemapBucketSummary,
  BoardSitemapIndex,
  SitemapEntriesEnvelope,
  SitemapEntriesQuery,
  SitemapEntry,
} from './types/sitemap';
export type {
  LocationSalaryDetail,
  LocationSkillsIndex,
  LocationTitlesIndex,
  SalaryCompany,
  SalaryDetailQuery,
  SalaryLocation,
  SalarySkill,
  SalaryTitle,
  SkillLocationSalary,
  SkillLocationsIndex,
  SkillSalaryDetail,
  TitleLocationSalary,
  TitleLocationsIndex,
  TitleSalaryDetail,
} from './types/salaries';
