// src/modules/users/users.types.ts

import { RoleType } from '@prisma/client';

export interface InviteUserInput {
  email: string;
  fullName: string;
  roleId: string;
  password: string;
}

export interface UpdateUserRoleInput {
  roleId: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  createdAt: Date;
  role: {
    id: string;
    name: RoleType;
  };
  permissions: string[];
  isActive: boolean;
  assignedClients?: { id: string; name: string }[];
}

export interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  createdAt: Date;
  role: {
    id: string;
    name: RoleType;
  };
  isActive: boolean;
}

export interface UserFilters {
  search?: string;
  roleId?: string;
  page?: number;
  limit?: number;
}
