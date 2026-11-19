import { UserRole } from '../../generated/prisma/client.js';

export interface AuthenticatedUser {
  userId: number;
  accountId: number;
  role: UserRole;
  clerkId: string;
  sessionId?: string;
}