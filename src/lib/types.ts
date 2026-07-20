export type TopUpStatus = "pending" | "approved" | "declined";

export interface Shop {
  _id: string;
  name: string;
  address: string;
  coordinates: [number, number];
  imageUrl?: string;
  imageFile?: string;
  /** Fixed length 7, Monday first. Each entry is "HH:MM-HH:MM" or "Closed". */
  timings?: string[];
  contactNumber?: string;
  googleMapsLink?: string;
  isDisabled?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface CreateShopInput {
  name: string;
  address: string;
  coordinates: [number, number];
  /** Id of a file previously uploaded via POST /api/files. */
  imageFile: string;
  /** Fixed length 7, Monday first. Each entry is "HH:MM-HH:MM" or "Closed". */
  timings: string[];
  contactNumber: string;
  googleMapsLink?: string;
}

export interface UploadFileResponse {
  success: boolean;
  message: string;
  data: {
    file: {
      _id: string;
      originalName: string;
      numberOfPages: number;
      raw: boolean;
      createdAt: string;
    };
  };
}

export interface CreateShopResponse {
  success: boolean;
  message: string;
  data: {
    shop: Shop;
  };
}

export interface ListShopsResponse {
  success: boolean;
  message: string;
  data: {
    shops: Shop[];
  };
}

export interface AuthProfile {
  _id: string;
  number: string;
  balance?: number;
  name?: string;
  pushTokens?: string[];
  isAdmin?: boolean;
  isDisabled?: boolean;
}

export interface AuthUser extends AuthProfile {
  phone?: string;
}

export interface AuthSession {
  token: string;
  profile: AuthProfile;
  shop: Shop | null;
  isAdmin: boolean;
}

export interface OtpVerifyResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: AuthProfile;
    shops: Shop[];
  };
}

export interface TopUpFile {
  _id: string;
  originalName: string;
}

export interface TopUpUser {
  _id: string;
  number: string;
  name: string;
}

export interface TopUp {
  _id: string;
  status: TopUpStatus | string;
  amount: number;
  ppfid?: TopUpFile | string | null;
  createdAt: string;
  createdBy?: TopUpUser | string | null;
}

export interface ListTopUpsResponse {
  success: boolean;
  message?: string;
  data?: {
    topups?: TopUp[];
  };
}

export interface PatchTopUpInput {
  status: "approved" | "declined";
}

export interface AdminUser {
  _id: string;
  name: string;
  number: string;
  balance: number;
  isAdmin?: boolean;
  isDisabled?: boolean;
  totalPrints?: number;
  lastActive?: string;
  joinedAt?: string;
  pushTokens?: string[];
}

export interface PatchUserInput {
  name?: string;
  number?: string;
  balance?: number;
  isAdmin?: boolean;
  isDisabled?: boolean;
}

export type DraftStatus = "drafts" | "ready" | "complete" | "incomplete";

export interface DraftUser {
  _id: string;
  number: string;
  name: string;
}

export interface Draft {
  _id: string;
  status: DraftStatus | string;
  createdAt: string;
  createdBy?: DraftUser | string | null;
}

export interface ListDraftsResponse {
  success: boolean;
  message?: string;
  data?: {
    drafts?: Draft[];
  };
}

export interface DraftStatsData {
  drafts: number;
  ready: number;
  complete: number;
  incomplete: number;
}

export type JobStatus = "submitted" | "queued" | "printing" | "cancelled" | "completed" | "failed";

export interface JobFile {
  file: string;
  settings?: Record<string, unknown>;
}

export interface Job {
  _id: string;
  status: JobStatus | string;
  createdBy: string | { _id: string; number: string; name: string };
  shop: string | Shop;
  files?: JobFile[];
  cost?: number;
  createdAt: string;
}

export interface ListJobsResponse {
  success: boolean;
  message?: string;
  data?: {
    jobs?: Job[];
  };
}

export interface JobStatsData {
  stats: {
    jobs: number;
    printing: number;
    queued: number;
    submitted: number;
  };
}

export type HistoryStatus = "cancelled" | "failed" | "completed";

export interface HistoryEntry {
  _id: string;
  status: HistoryStatus | string;
  createdBy: string | { _id: string; number: string; name: string };
  shop: string | Shop;
  files?: JobFile[];
  cost?: number;
  createdAt: string;
}

export interface ListHistoryResponse {
  success: boolean;
  message?: string;
  data?: {
    history?: HistoryEntry[];
  };
}

export interface HistoryStatsData {
  stats: {
    jobs: number;
    cancelled: number;
    failed: number;
    completed: number;
  };
}

export interface Admin {
  _id: AdminUser | string;
  appointedBy: AdminUser | string;
  appointedAt: string;
}

export interface ListAdminsResponse {
  success: boolean;
  message?: string;
  data?: {
    admins?: Admin[];
  };
}

export interface AppointAdminInput {
  user: string;
}

export interface AppointAdminResponse {
  success: boolean;
  message?: string;
  data?: {
    admin?: Admin;
  };
}
