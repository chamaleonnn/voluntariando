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
