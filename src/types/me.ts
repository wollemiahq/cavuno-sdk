// Generated from the v1 OpenAPI spec (`components.schemas`) — see
// scripts/gen-types.ts. `SavedJob` embeds the generated `PublicJobCard`.
// The query type stays hand-written.
import type { Schemas } from './_spec';

export type SavedJob = Schemas['SavedJob'];

export type SavedJobsListQuery = {
  cursor?: string;
  /** 1–100. */
  limit?: number;
};

/** Personalized recommendation wrapper — embeds the slim job card. */
export type RecommendedJob = Schemas['RecommendedJob'];

export type RecommendedJobsListQuery = {
  /** Opaque position cursor from a previous page's `nextCursor`. */
  cursor?: string;
  /** 1–100. */
  limit?: number;
};

/**
 * Employer→candidate recommendation wrapper — embeds the same
 * `talent_directory_entry` card the public directory emits.
 *
 * The wrapper exists so typed `reasons` and a coarse `strength` band can land
 * later as MINOR additions rather than breaks. It will never carry a rank,
 * score, band, or ranker identity: order is the ranking. This is a sourcing
 * surface, not a screening one.
 */
export type RecommendedTalent = Schemas['RecommendedTalent'];

export type RecommendedTalentListQuery = {
  /** Required. The job to source candidates for; it must belong to `:slug`. */
  job: string;
  /** Opaque position cursor from a previous page's `nextCursor`. */
  cursor?: string;
  /** 1–100. */
  limit?: number;
};

export type SaveJobBody = Schemas['SaveJobBody'];

/** The authenticated user's lean candidate profile singleton. */
export type CandidateProfile = Schemas['CandidateProfile'];

/** Optional-field merge-patch body for `board.me.profile.update`. */
export type UpdateCandidateProfileBody = Schemas['UpdateCandidateProfileBody'];

/** The result of `board.me.profile.handleAvailable(handle)`. */
export type HandleAvailability = Schemas['HandleAvailability'];

// ── Profile collections ──────────────────────────────────────────────
export type CandidateExperience = Schemas['CandidateExperience'];
export type CreateExperienceBody = Schemas['CreateExperienceBody'];
export type UpdateExperienceBody = Schemas['UpdateExperienceBody'];
export type CandidateEducation = Schemas['CandidateEducation'];
export type CreateEducationBody = Schemas['CreateEducationBody'];
export type UpdateEducationBody = Schemas['UpdateEducationBody'];
export type CandidateSkill = Schemas['CandidateSkill'];
export type UpdateSkillsBody = Schemas['UpdateSkillsBody'];
export type CandidateLanguage = Schemas['CandidateLanguage'];
export type UpdateLanguagesBody = Schemas['UpdateLanguagesBody'];

/** The result of `board.me.profile.uploadAvatar(file)`. */
export type CandidateAvatar = Schemas['CandidateAvatar'];

// ── Notification preferences ─────────────────────────────────────────
export type NotificationPreference = Schemas['NotificationPreference'];
export type UpdateNotificationPreferenceBody =
  Schemas['UpdateNotificationPreferenceBody'];
export type UnsubscribeBody = Schemas['UnsubscribeBody'];

// ── Messaging ────────────────────────────────────
/** One inbox row — the counterparty identity is live-resolved. */
export type Conversation = Schemas['Conversation'];
/** A conversation header — adds the viewer's role + last-read pointer. */
export type ConversationDetail = Schemas['ConversationDetail'];
/** One message in a thread. `body` is `''` when unsent (tombstoned). */
export type Message = Schemas['Message'];
/** The distinct-unread-thread count for the inbox badge. */
export type UnreadCount = Schemas['UnreadCount'];

/** Query for `board.me.conversations.list`. */
export type ConversationsListQuery = {
  /** `true` for the archived view; omit/false for the main inbox. */
  archived?: boolean;
  cursor?: string;
  /** 1–100. */
  limit?: number;
};

// ── Job alerts ────────────────────────────────────────────
/** One of the authenticated board user's job-alert preferences. */
export type Alert = Schemas['Alert'];
/** Create/replace body for `board.me.alerts.create` / `board.me.alerts.update`. */
export type AlertBody = Schemas['AlertBody'];

// ── Applications ──────────────────────────────────────────
/** The candidate's own view of an application they submitted. */
export type Application = Schemas['Application'];
/** Body for `board.jobs.apply` (name/email omitted when signed in). */
export type ApplyBody = Schemas['ApplyBody'];
/** Merge-patch body for `board.me.applications.updateFacts`. */
export type UpdateApplicationFactsBody = Schemas['UpdateApplicationFactsBody'];

/** Query for `board.me.applications.list`. */
export type ApplicationsListQuery = {
  cursor?: string;
  /** 1–100. */
  limit?: number;
};

/** Query for `board.me.conversations.listMessages`. */
export type ThreadMessagesQuery = {
  cursor?: string;
  /** 1–200. */
  limit?: number;
};

/** Body for `board.me.conversations.start` (cold-initiate a candidate). */
export type StartConversationBody = Schemas['StartConversationBody'];
/** Body for `board.me.conversations.startAboutApplication` (message an applicant). */
export type StartAboutApplicationBody = Schemas['StartAboutApplicationBody'];
/** Body for `board.me.conversations.reply`. */
export type ReplyBody = Schemas['ReplyBody'];
/** The result of `board.me.conversations.markRead`. */
export type ReadReceipt = Schemas['ReadReceipt'];
/** The result of `board.me.conversations.{archive,unarchive}`. */
export type ConversationArchive = Schemas['ConversationArchive'];

/** Body for `board.me.messages.edit`. */
export type EditMessageBody = Schemas['EditMessageBody'];
/** Body for `board.me.messages.report`. */
export type ReportBody = Schemas['ReportBody'];
/** The result of `board.me.messages.report` (with the auto-block outcome). */
export type ModerationReport = Schemas['ModerationReport'];

/** One blocked user from `board.me.blocks.list`. */
export type BlockedUser = Schemas['BlockedUser'];
/** Body for `board.me.blocks.create`. */
export type BlockUserBody = Schemas['BlockUserBody'];
/** The result of `board.me.blocks.create`. */
export type Block = Schemas['Block'];
/** The result of `board.me.blocks.status`. */
export type BlockStatus = Schemas['BlockStatus'];
/** The result of `board.me.conversations.findExisting`. */
export type ConversationRef = Schemas['ConversationRef'];

/** Query for `board.me.conversations.findExisting`. */
export type FindExistingConversationQuery = {
  candidateBoardUserId: string;
};

// ── Resume ────────────────────────────────────
/** The candidate's resume state (async parse status + stored file). */
export type Resume = Schemas['Resume'];
/** Options for `board.me.resume.upload`. */
export type ResumeUploadOptions = {
  keepResumeOnFile?: boolean;
  importMode?: 'append_only' | 'replace_all';
  confirmReplaceAll?: boolean;
};

// ── Employer companies & claims ──────────────────
/** The caller's tie to a company, with a computed claim `status`. */
export type CompanyMembership = Schemas['CompanyMembership'];
/** The full editable company (`board.me.companies.update` echoes this). */
export type EmployerCompany = Schemas['EmployerCompany'];
/** A search hit from `board.me.companies.search`. */
export type ClaimableCompany = Schemas['ClaimableCompany'];
export type CreateCompanyBody = Schemas['CreateCompanyBody'];
export type UpdateEmployerCompanyBody = Schemas['UpdateEmployerCompanyBody'];
export type SendWorkEmailBody = Schemas['SendWorkEmailBody'];
export type ConfirmWorkEmailBody = Schemas['ConfirmWorkEmailBody'];

/** Body for `board.me.updatePassword`. */
export type UpdatePasswordBody = Schemas['UpdatePasswordBody'];
/** Body for `board.me.requestEmailChange`. */
export type RequestEmailChangeBody = Schemas['RequestEmailChangeBody'];
/** Body for `board.me.confirmEmailChange`. */
export type ConfirmEmailChangeBody = Schemas['ConfirmEmailChangeBody'];
/** One approved company member from `board.me.companies.listMembers`. */
export type CompanyMember = Schemas['CompanyMember'];
/** Body for `board.me.companies.updateMemberRole`. */
export type UpdateCompanyMemberRoleBody =
  Schemas['UpdateCompanyMemberRoleBody'];
/** One pending company member invite from `board.me.companies.listInvites`. */
export type CompanyMemberInvite = Schemas['CompanyMemberInvite'];
/** Body for `board.me.companies.createInvite`. */
export type CreateCompanyMemberInviteBody =
  Schemas['CreateCompanyMemberInviteBody'];
/** Result of `board.me.acceptInvite`. */
export type CompanyMemberInviteAcceptance =
  Schemas['CompanyMemberInviteAcceptance'];
/** Body for `board.me.acceptInvite`. */
export type AcceptCompanyMemberInviteBody =
  Schemas['AcceptCompanyMemberInviteBody'];

/**
 * The viewer's per-employer talent entitlement from
 * `board.me.talentAccess.retrieve` — the talent-CTA signal (sourced from the
 * same subscription/credit-pack truth the talent paywall enforces), plus
 * charging model and remaining unlock/message credits.
 */
export type TalentAccess = Schemas['TalentAccess'];

/** Per-candidate unlock/credit gate from `board.me.talentAccess.retrieveCandidate`. */
export type TalentCandidateAccess = Schemas['TalentCandidateAccess'];

/** Body for `board.me.talentAccess.checkout`. */
export type TalentAccessCheckoutBody = Schemas['TalentAccessCheckoutBody'];

/**
 * Connected-account mount kit from `board.me.talentAccess.checkout` — same
 * generated schema as candidate-access checkout (`origin: talent_access`).
 */
export type TalentAccessCheckoutSession = Schemas['AccessCheckoutSession'];

/** Polled state of a talent-access checkout session (`board.me.talentAccess.retrieveCheckout`). */
export type TalentAccessCheckoutSessionState =
  Schemas['AccessCheckoutSessionState'];

/** Result of `board.me.talentAccess.unlock`. */
export type TalentUnlock = Schemas['TalentUnlock'];

/** Body for `board.me.talentAccess.unlock`. */
export type TalentUnlockBody = Schemas['TalentUnlockBody'];

/** Body for `board.me.talentAccess.upgrade`. */
export type TalentAccessUpgradeBody = Schemas['TalentAccessUpgradeBody'];

/**
 * Acknowledgement from `board.me.talentAccess.upgrade` — entitlement (new
 * credit counters) lands via webhook; re-read `me.talentAccess.retrieve`.
 */
export type TalentAccessUpgrade = Schemas['TalentUpgrade'];

/** Query for `board.me.companies.search`. */
export type EmployerCompanySearchQuery = {
  q: string;
  /** 1–50. */
  limit?: number;
};

// ── Employer jobs ────────────────────────────────
/** Flat list-item shape from `board.me.companies.jobs.list`. */
export type EmployerJobSummary = Schemas['EmployerJobSummary'];
/** The full job from `board.me.companies.jobs.retrieve` + every mutation echo. */
export type EmployerJob = Schemas['EmployerJob'];
export type CreateEmployerJobBody = Schemas['EmployerCreateJobBody'];
export type UpdateEmployerJobBody = Schemas['EmployerUpdateJobBody'];

/** Query for `board.me.companies.jobs.list`. */
export type EmployerJobsListQuery = {
  /** 1–200 (default 200). */
  limit?: number;
};

// ── Employer job stats ──────────────────────────────────────
/**
 * One job's reporting funnel from `board.me.companies.jobStats.retrieve`.
 * `views` / `applyClicks` degrade to `0` when reporting data is temporarily
 * unavailable, so a `0` is "no activity" OR "analytics briefly unavailable".
 * `applications` is `null` for an external-apply job.
 */
export type EmployerJobStat = Schemas['EmployerJobStat'];
/**
 * One daily bucket from `board.me.companies.jobStats.timeseries`, aggregated
 * across the company's jobs. Zero-filled over the window, ascending by date.
 */
export type EmployerJobStatsPoint = Schemas['EmployerJobStatsPoint'];

/** Query for `board.me.companies.jobStats.timeseries`. */
export type EmployerJobStatsTimeseriesQuery = {
  /** Inclusive window start (ISO 8601). Defaults to 30 days before `until`. */
  since?: string;
  /** Exclusive window end (ISO 8601). Defaults to now. */
  until?: string;
};

// ── Employer company-profile views ──────────────────────────
/**
 * The company-level profile-views summary from
 * `board.me.companies.profileStats.retrieve` — views of the company profile
 * page itself (`/companies/{slug}`, tabs and bots excluded). `profileViews`
 * degrades to `0` on an analytics outage.
 */
export type EmployerProfileStats = Schemas['EmployerProfileStats'];
/**
 * One daily bucket from `board.me.companies.profileStats.timeseries`.
 * Zero-filled over the window, ascending by date.
 */
export type EmployerProfileViewsPoint = Schemas['EmployerProfileViewsPoint'];

/** Query for `board.me.companies.profileStats.timeseries`. */
export type EmployerProfileViewsTimeseriesQuery = {
  /** Inclusive window start (ISO 8601). Defaults to 30 days before `until`. */
  since?: string;
  /** Exclusive window end (ISO 8601). Defaults to now. */
  until?: string;
};

// ── Employer ATS / job pipeline ──────────────────
/** A job's full applicant pipeline (job header + stage rail + applicants). */
export type EmployerPipeline = Schemas['EmployerPipeline'];
/** One applicant on a job's pipeline, with its activity timeline. */
export type EmployerApplicant = Schemas['EmployerApplicant'];
/** One row of a job's stage rail. */
export type EmployerPipelineStage = Schemas['EmployerPipelineStage'];
export type MoveApplicantStageBody = Schemas['MoveApplicantStageBody'];
export type BulkMoveApplicantsBody = Schemas['BulkMoveApplicantsBody'];
export type BulkRejectApplicantsBody = Schemas['BulkRejectApplicantsBody'];
export type AddApplicantNoteBody = Schemas['AddApplicantNoteBody'];
export type CreatePipelineStageBody = Schemas['CreatePipelineStageBody'];
export type UpdatePipelineStageBody = Schemas['UpdatePipelineStageBody'];
export type ReorderPipelineStagesBody = Schemas['ReorderPipelineStagesBody'];

/** Query for `board.me.companies.applicants.list`. */
export type EmployerPipelineQuery = {
  /** The job id whose pipeline to read. */
  job: string;
  /** Filter to a single stage (systemStage key, custom stage id, or `applied`). */
  stage?: string;
};

// ── Employer checkout / billing ───────
/** A reusable billing option (active subscription / pre-purchased bundle slot). */
export type EmployerBillingOption = Schemas['EmployerBillingOption'];
/** The result of `board.me.companies.jobs.checkout`. */
export type EmployerCheckout = Schemas['EmployerCheckout'];
export type EmployerCheckoutBody = Schemas['EmployerCheckoutBody'];

/** Optional body for `board.me.companies.billingPortal.create`. */
export type CompanyBillingPortalBody = Schemas['CompanyBillingPortalBody'];
/** A minted company Stripe Customer Portal session (job posting + talent access). */
export type CompanyBillingPortalSession =
  Schemas['CompanyBillingPortalSession'];
