// src/shared/types.ts

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface RequestUser {
  userId: string;
  email: string;
  organizationId: string;
  roleId: string;
  role: string;
  permissions: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user: RequestUser;
  }
}
