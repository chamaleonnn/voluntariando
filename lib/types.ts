export type OpportunityVisibility = "public" | "members";
export type OpportunityStatus = "draft" | "published" | "closed";

export type Opportunity = {
  id: string;
  title: string;
  organization: string;
  organizationId: string;
  description: string;
  tasks: string[];
  requirements: string[];
  date: string;
  dateLabel: string;
  time: string;
  neighborhood: string;
  addressHint: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  capacity: number;
  availableSpots: number;
  category: string;
  province: string;
  modality?: "Presencial" | "Virtual" | "Híbrida";
  availability?: string[];
  requiredSkills?: string[];
  imageUrl: string;
  recommendedBecause?: string;
  compatibility?: number;
  compatibilityBreakdown?: {
    skills: number;
    interests: number;
    availability: number;
    location: number;
    experience: number;
  };
  visibility: OpportunityVisibility;
  status: OpportunityStatus;
  simulated?: boolean;
  moderationReason?: string;
  moderatedAt?: string;
  moderatedBy?: string;
};

export type SessionUser = {
  uid: string;
  email: string;
  displayName: string;
  role: "volunteer" | "organization" | "admin";
  status?: "active" | "suspended";
  isDemo?: boolean;
};

// Vista administrativa de una cuenta registrada en Firebase.
export type PlatformUser = SessionUser & {
  createdAt?: string;
  suspendedUntil?: string;
  suspensionReason?: string;
};

export type Application = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  organizationId: string;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
  completedAt?: string;
  absentAt?: string;
  source?: "application" | "invitation";
  matchId?: string;
};

export type Review = {
  id: string;
  applicationId: string;
  opportunityId: string;
  opportunityTitle: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  authorName: string;
  rating: number;
  comment: string;
  status: "published" | "reported" | "hidden";
  createdAt: string;
  moderationReason?: string;
  moderatedAt?: string;
  moderatedBy?: string;
};

export type ReviewReport = {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: string;
  status: "pending" | "resolved";
  createdAt: string;
};

// La foto se guarda aparte para que una reseña pueda publicarse antes de aprobar su imagen.
export type ReviewPhoto = {
  id: string;
  reviewId: string;
  userId: string;
  imageDataUrl: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  moderationReason?: string;
  moderatedAt?: string;
  moderatedBy?: string;
};

export type AppNotification = {
  id: string;
  recipientId: string;
  actorId: string;
  applicationId?: string;
  invitationId?: string;
  feedbackId?: string;
  absenceReportId?: string;
  type: "application_received" | "application_accepted" | "application_rejected" | "proposal_received" | "proposal_accepted" | "proposal_rejected" | "feedback_warning" | "absence_reported" | "absence_resolved";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type AbsenceReport = {
  id: string;
  matchId: string;
  opportunityId: string;
  opportunityTitle: string;
  organizationId: string;
  organizationName: string;
  volunteerId: string;
  volunteerName: string;
  reportedBy: string;
  reportedByEmail: string;
  reason: string;
  status: "pending_review" | "confirmed" | "dismissed";
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewReason?: string;
};

export type ExperienceFeedback = {
  id: string;
  matchId: string;
  opportunityId: string;
  opportunityTitle: string;
  organizationId: string;
  organizationName: string;
  submittedByEmail: string;
  volunteerId: string;
  volunteerName: string;
  tasks: string[];
  skills: string[];
  assessment: "positive" | "needs_improvement";
  details: string;
  status: "recorded" | "pending_review" | "approved" | "dismissed";
  createdAt: string;
  moderationReason?: string;
  moderatedAt?: string;
  moderatedBy?: string;
};

export type Invitation = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  userName: string;
  message: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  completedAt?: string;
  absentAt?: string;
};

export type Organization = {
  id: string;
  ownerId: string;
  name: string;
  email: string;
  province: string;
  description: string;
  location?: string;
  contact?: string;
  status: "pending" | "verified" | "suspended";
  moderationReason?: string;
  moderatedAt?: string;
  moderatedBy?: string;
};

// Perfil del voluntario utilizado para calcular y explicar recomendaciones.
export type VolunteerProfile = {
  id: string;
  name: string;
  initials: string;
  location: string;
  bio: string;
  completedExperiences: number;
  verifiedHours: number;
  interests: string[];
  declaredSkills?: string[];
  verifiedSkills?: Record<string, number>;
  availability?: string[];
  socialLinks?: {
    instagram?: string;
    linkedin?: string;
    other?: string;
  };
  experiences?: Array<{
    opportunityId: string;
    opportunityTitle: string;
    organization: string;
    tasks: string[];
    skills: string[];
    completedAt: string;
  }>;
  visibleToOrganizations: boolean;
  visibleToVolunteers: boolean;
};
