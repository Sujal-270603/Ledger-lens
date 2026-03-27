import '@fastify/jwt';
import { RequestUser } from '../shared/types';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: RequestUser;
  }
}
