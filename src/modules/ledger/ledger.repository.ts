import { prisma } from '../../database/db';
import { Prisma, Ledger } from '../../types/prisma';
import { LedgerFilters, JournalEntryFilters, UpdateLedgerInput } from './ledger.types';

export type LedgerWithCount = Prisma.LedgerGetPayload<{
  include: {
    _count: {
      select: { journalLines: true }
    }
  }
}>;

export type LedgerWithLines = Prisma.LedgerGetPayload<{
  include: {
    journalLines: {
      include: {
        journal: {
          select: { id: true, invoiceId: true, entryDate: true }
        }
      }
    };
    _count: {
      select: { journalLines: true }
    }
  }
}>;

export type JournalEntryWithAll = Prisma.JournalEntryGetPayload<{
  include: {
    invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true, syncStatus: true } },
    lines: { include: { ledger: { select: { id: true, name: true } } } }
  }
}>;

export class LedgerRepository {
  async findLedgersByClient(
    clientId: string,
    filters: LedgerFilters
  ): Promise<{ ledgers: LedgerWithCount[]; total: number }> {
    const where: Prisma.LedgerWhereInput = { clientId };

    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [ledgers, total] = await prisma.$transaction([
      prisma.ledger.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { journalLines: true }
          }
        }
      }),
      prisma.ledger.count({ where }),
    ]);

    return { ledgers, total };
  }

  async findLedgerByIdAndClient(
    ledgerId: string,
    clientId: string
  ): Promise<LedgerWithLines | null> {
    return prisma.ledger.findFirst({
      where: { id: ledgerId, clientId },
      include: {
        journalLines: {
          include: {
            journal: {
              select: { id: true, invoiceId: true, entryDate: true }
            }
          },
          orderBy: { journal: { entryDate: 'desc' } },
          take: 50
        },
        _count: {
          select: { journalLines: true }
        }
      }
    });
  }

  async findLedgerByNameAndClient(
    name: string,
    clientId: string
  ): Promise<Ledger | null> {
    return prisma.ledger.findFirst({
      where: {
        clientId,
        name
      }
    });
  }

  async findLedgersByNames(
    names: string[],
    clientId: string
  ): Promise<Ledger[]> {
    return prisma.ledger.findMany({
      where: {
        clientId,
        name: { in: names }
      }
    });
  }

  async createLedger(data: {
    name: string;
    clientId: string;
    organizationId: string;
  }): Promise<Ledger> {
    return prisma.ledger.create({
      data: {
        name: data.name,
        clientId: data.clientId,
        organizationId: data.organizationId
      }
    });
  }

  async createDefaultLedgers(
    clientId: string,
    organizationId: string,
    names: readonly string[]
  ): Promise<void> {
    await prisma.ledger.createMany({
      data: names.map(name => ({
        name,
        clientId,
        organizationId
      })),
      skipDuplicates: true
    });
  }

  async updateLedger(
    ledgerId: string,
    clientId: string,
    data: UpdateLedgerInput
  ): Promise<Ledger> {
    return prisma.ledger.update({
      where: {
        id: ledgerId,
        clientId
      },
      data
    });
  }

  async deleteLedger(
    ledgerId: string,
    clientId: string
  ): Promise<void> {
    await prisma.ledger.deleteMany({
      where: {
        id: ledgerId,
        clientId
      }
    });
  }

  async hasJournalLines(
    ledgerId: string
  ): Promise<boolean> {
    const count = await prisma.journalLine.count({
      where: { ledgerId }
    });
    return count > 0;
  }

  async findJournalEntriesByClient(
    clientId: string,
    filters: JournalEntryFilters
  ): Promise<{ entries: JournalEntryWithAll[]; total: number }> {
    const where: Prisma.JournalEntryWhereInput = {
      invoice: {
        clientId
      }
    };

    if (filters.invoiceId) {
      where.invoiceId = filters.invoiceId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.entryDate = {};
      if (filters.dateFrom) where.entryDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.entryDate.lte = new Date(filters.dateTo);
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [entries, total] = await prisma.$transaction([
      prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { entryDate: 'desc' },
        include: {
          invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true, syncStatus: true } },
          lines: { include: { ledger: { select: { id: true, name: true } } } }
        }
      }),
      prisma.journalEntry.count({ where })
    ]);

    return { entries, total } as { entries: JournalEntryWithAll[]; total: number };
  }

  async findJournalEntryById(
    journalEntryId: string,
    clientId: string
  ): Promise<JournalEntryWithAll | null> {
    return prisma.journalEntry.findFirst({
      where: {
        id: journalEntryId,
        invoice: {
          clientId
        }
      },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true, syncStatus: true } },
        lines: { include: { ledger: { select: { id: true, name: true } } } }
      }
    }) as Promise<JournalEntryWithAll | null>;
  }

  async findJournalEntriesByInvoice(
    invoiceId: string,
    clientId: string
  ): Promise<JournalEntryWithAll[]> {
    return prisma.journalEntry.findMany({
      where: {
        invoiceId,
        invoice: {
          clientId
        }
      },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true, syncStatus: true } },
        lines: { include: { ledger: { select: { id: true, name: true } } } }
      },
      orderBy: { createdAt: 'asc' }
    }) as Promise<JournalEntryWithAll[]>;
  }

  async createJournalEntry(data: {
    invoiceId: string;
    entryDate: Date;
    description?: string;
    isAutoGenerated: boolean;
    lines: {
      ledgerId: string;
      debit?: number;
      credit?: number;
    }[];
  }): Promise<JournalEntryWithAll> {
    const { lines, ...entryData } = data;

    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: entryData
      });

      await tx.journalLine.createMany({
        data: lines.map(line => ({
          ...line,
          journalId: entry.id
        }))
      });

      return tx.journalEntry.findUniqueOrThrow({
        where: { id: entry.id },
        include: {
          invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true, syncStatus: true } },
          lines: { include: { ledger: { select: { id: true, name: true } } } }
        }
      }) as Promise<JournalEntryWithAll>;
    });
  }

  async deleteJournalEntry(
    journalEntryId: string,
    clientId: string
  ): Promise<void> {
    await prisma.journalEntry.deleteMany({
      where: {
        id: journalEntryId,
        invoice: {
          clientId
        }
      }
    });
  }

  async getLedgerBalanceSummary(
    clientId: string
  ): Promise<any[]> {
    const summary = await prisma.$queryRaw`
      SELECT
        l.id::text as "ledgerId",
        l.name as "ledgerName",
        COALESCE(SUM(jl.debit), 0)::text as "totalDebit",
        COALESCE(SUM(jl.credit), 0)::text as "totalCredit"
      FROM "Ledger" l
      LEFT JOIN "JournalLine" jl ON l.id::text = jl."ledgerId"::text
      WHERE l."clientId"::text = ${clientId}::text
      GROUP BY l.id, l.name
      ORDER BY l.name ASC
    `;

    return summary as any[];
  }

  async createAuditLog(data: {
    userId?: string;
    action: string;
    resource: string;
    details?: object;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        details: data.details ? (data.details as any) : undefined
      }
    });
  }
  async findFirstJournalEntryByInvoice(
    invoiceId: string,
    organizationId: string
  ): Promise<JournalEntryWithAll | null> {
    const entries = await prisma.journalEntry.findMany({
      where: { 
        invoiceId,
        invoice: { organizationId }
      },
      orderBy: { createdAt: 'asc' },
      take: 1,
      include: {
        lines: { include: { ledger: { select: { id: true, name: true } } } }
      }
    });

    return (entries[0] as JournalEntryWithAll) || null;
  }

  async appendLinesToJournalEntry(
    journalId: string,
    lines: { ledgerId: string; debit?: number; credit?: number }[]
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.journalLine.createMany({
        data: lines.map(line => ({
          journalId,
          ledgerId: line.ledgerId,
          debit: line.debit || 0,
          credit: line.credit || 0
        }))
      });
    });
  }

  async replaceJournalEntryLines(
    journalEntryId: string,
    lines: { ledgerId: string; debit?: number; credit?: number }[]
  ): Promise<JournalEntryWithAll> {
    return prisma.$transaction(async (tx) => {
      // Remove all existing lines for this entry
      await tx.journalLine.deleteMany({ where: { journalId: journalEntryId } });

      // Insert the fresh set of lines
      await tx.journalLine.createMany({
        data: lines.map(line => ({
          journalId: journalEntryId,
          ledgerId: line.ledgerId,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0
        }))
      });

      return tx.journalEntry.findUniqueOrThrow({
        where: { id: journalEntryId },
        include: {
          invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true, syncStatus: true } },
          lines: { include: { ledger: { select: { id: true, name: true } } } }
        }
      }) as Promise<JournalEntryWithAll>;
    });
  }
}

export const ledgerRepository = new LedgerRepository();
