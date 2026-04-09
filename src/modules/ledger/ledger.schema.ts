// src/modules/ledger/ledger.schema.ts
import { z } from 'zod';

export const createLedgerSchema = z.object({
  name: z.string()
    .min(2, 'Ledger name must be between 2 and 100 characters')
    .max(100, 'Ledger name must be between 2 and 100 characters')
    .trim(),
});

export const updateLedgerSchema = z.object({
  name: z.string()
    .min(2, 'Ledger name must be between 2 and 100 characters')
    .max(100, 'Ledger name must be between 2 and 100 characters')
    .trim(),
});

export const createJournalLineSchema = z.object({
  ledgerId: z.string().uuid(),
  debit: z.number().nonnegative().optional().default(0),
  credit: z.number().nonnegative().optional().default(0),
}).refine(data => {
  // At least one must be greater than zero
  return (data.debit || 0) > 0 || (data.credit || 0) > 0;
}, {
  message: 'Each journal line must have either a debit or credit amount greater than zero',
}).refine(data => {
  // Cannot have both greater than zero
  return !((data.debit || 0) > 0 && (data.credit || 0) > 0);
}, {
  message: 'A journal line cannot have both debit and credit amounts',
});

export const createJournalEntrySchema = z.object({
  invoiceId: z.string().uuid(),
  entryDate: z.preprocess((val) => {
    if (typeof val === 'string' && val.length > 0) {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d.toISOString();
    }
    return val;
  }, z.string().datetime({ offset: true }).or(z.string().datetime())), // ISO date string
  description: z.string().max(500).optional(),
  lines: z.array(createJournalLineSchema).min(2, 'Journal entry must have at least 2 lines'),
}).refine(data => {
  const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  return Math.abs(totalDebit - totalCredit) <= 0.01;
}, {
  message: 'Journal entry is not balanced. Total debits must equal total credits.',
});

export const ledgerFiltersSchema = z.object({
  search: z.string().max(100).optional(),
  page: z.preprocess((val) => (val ? Number(val) : 1), z.number().int().positive().default(1)),
  limit: z.preprocess((val) => (val ? Number(val) : 20), z.number().int().positive().max(100).default(20)),
});

export const journalEntryFiltersSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  dateFrom: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
  dateTo: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
  page: z.preprocess((val) => (val ? Number(val) : 1), z.number().int().positive().default(1)),
  limit: z.preprocess((val) => (val ? Number(val) : 20), z.number().int().positive().max(100).default(20)),
});
