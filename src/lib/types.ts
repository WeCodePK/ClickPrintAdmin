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

export interface OwnerRef {
  _id: string;
  name?: string;
  number?: string;
}

export interface OwnerShopRef {
  _id: string;
  name?: string;
}

export interface Owner {
  _id: string;
  user: OwnerRef | string;
  shop: OwnerShopRef | string;
  appointedBy: OwnerRef | string;
  appointedByAdmin: boolean;
  appointedAt: string;
}

export interface ListOwnersResponse {
  success: boolean;
  message?: string;
  data?: {
    owners?: Owner[];
  };
}

export interface AppointOwnerInput {
  user: string;
}

export interface AppointOwnerResponse {
  success: boolean;
  message?: string;
  data?: {
    owner?: Owner;
  };
}

/** A shop as it arrives populated inside another record. */
export interface ShopRef {
  _id: string;
  name?: string;
}

export interface Printer {
  _id: string;
  name: string;
  shop: ShopRef | string;
  isDisabled?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface ListPrintersResponse {
  success: boolean;
  message?: string;
  data?: {
    printers?: Printer[];
  };
}

export interface PrinterResponse {
  success: boolean;
  message?: string;
  data?: {
    printer?: Printer;
  };
}

export interface CreatePrinterInput {
  name: string;
}

export interface PrinterStatsData {
  printers: number;
  online: number;
  offline: number;
  disabled: number;
}

/** The attribute combination a service prices — its natural key within a shop. */
export interface ServiceKeys {
  pageType: string;
  /** true = colour, false = black & white. */
  color: boolean;
  /** true = double-sided, false = single-sided. */
  sidedness: boolean;
}

export interface ServicePrinterRef {
  _id: string;
  name?: string;
  isOnline?: boolean;
}

export interface ServicePrinter {
  useAuto: boolean;
  printer: ServicePrinterRef | string;
}

export interface Service {
  _id: string;
  /** Derived by the backend from `keys`, e.g. "A4-BW-SS". */
  name?: string;
  rate: number;
  keys: ServiceKeys;
  shop: ShopRef | string;
  printers?: ServicePrinter[];
  isDisabled?: boolean;
}

export interface ListServicesResponse {
  success: boolean;
  message?: string;
  data?: {
    services?: Service[];
  };
}

export interface ServiceResponse {
  success: boolean;
  message?: string;
  data?: {
    service?: Service;
  };
}

/**
 * Service health reflects the printers backing a service, not its enabled flag:
 * `healthy` = every printer online, `dead` = none online, `unhealthy` = in between.
 */
export interface ServiceStatsData {
  services: number;
  healthy: number;
  unhealthy: number;
  dead: number;
}

/** Body for POST/PUT — the backend derives `name`, so it is never sent. */
export interface ServiceInput {
  rate: number;
  keys: ServiceKeys;
  printers: { useAuto: boolean; printer: string }[];
}
