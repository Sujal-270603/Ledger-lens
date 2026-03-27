import { PrismaClient } from '@prisma/client';
import { prisma } from '../database/db';

export const runInTransaction = async <T>(
  callback: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>
): Promise<T> => {
  return prisma.$transaction(async (tx) => {
    return await callback(tx);
  });
};
