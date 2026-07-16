export type TopUpStatus = "pending" | "approved" | "declined";

export interface Shop {
  _id: string;
  name: string;
  address: string;
  coordinates: [number, number];
  imageUrl?: string;
  timings?: string[];
  walletNumber?: string;
  capabilities: string[];
  owner: string;
  isDisabled?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface CreateShopInput {
  name: string;
  address: string;
  coordinates: [number, number];
  imageUrl: string;
  timings: string[];
  walletNumber: string;
  capabilities: string[];
  owner: string;
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
    profile: AuthProfile;
    shop: Shop | null;
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
  isAdmin: boolean;
  totalPrints?: number;
  lastActive?: string;
  joinedAt?: string;
}

export interface PatchUserInput {
  name?: string;
  balance?: number;
  isAdmin?: boolean;
}
