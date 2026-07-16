import { AdminUser } from "./types";

export const DEMO_USERS: AdminUser[] = [
  {
    _id: "demo-user-1",
    name: "Alex Smith",
    number: "03001234567",
    balance: 1500,
    isAdmin: false,
    totalPrints: 142,
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    joinedAt: "2023-10-15T08:00:00Z"
  },
  {
    _id: "demo-user-2",
    name: "Sarah Johnson",
    number: "03211234567",
    balance: 50,
    isAdmin: true,
    totalPrints: 3,
    lastActive: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    joinedAt: "2023-01-10T10:30:00Z"
  },
  {
    _id: "demo-user-3",
    name: "Ahmed Khan",
    number: "03331234567",
    balance: 320,
    isAdmin: false,
    totalPrints: 45,
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    joinedAt: "2024-02-20T14:15:00Z"
  },
  {
    _id: "demo-user-4",
    name: "Fatima Ali",
    number: "03451234567",
    balance: 890,
    isAdmin: false,
    totalPrints: 89,
    lastActive: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    joinedAt: "2023-11-05T09:45:00Z"
  },
  {
    _id: "demo-user-5",
    name: "Zain Raza",
    number: "03111234567",
    balance: 0,
    isAdmin: false,
    totalPrints: 0,
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days ago
    joinedAt: "2024-05-12T16:20:00Z"
  }
];

export const DEMO_METRICS = {
  totalUsers: 1420,
  totalPrints: 45200,
  avgPrintsPerUser: 32,
  mostActiveShopName: "Central University Copiers",
  shopsAddedLast30Days: 14
};
