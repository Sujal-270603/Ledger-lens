// src/modules/ledger/ledger.routes.ts
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ledgerController } from './ledger.controller';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/requirePermission';
import { validateBody } from '../../middleware/validateBody';
import { validateParams } from '../../middleware/validateParams';
import { validateQuery } from '../../middleware/validateQuery';
import {
  createLedgerSchema,
  updateLedgerSchema,
  createJournalEntrySchema,
  ledgerFiltersSchema,
  journalEntryFiltersSchema
} from './ledger.schema';

const ledgerRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ── LEDGER ROUTES ─────────────────────────────────────────────────────────

  // ── LEDGER ROUTES ─────────────────────────────────────────────────────────

  fastify.get('/api/v1/clients/:clientId/ledgers', {
    preHandler: [authenticate, validateQuery(ledgerFiltersSchema)]
  }, (req, res) => ledgerController.listLedgers(req, res));

  fastify.post('/api/v1/clients/:clientId/ledgers', {
    preHandler: [authenticate, requirePermission('MANAGE_LEDGER'), validateBody(createLedgerSchema)]
  }, (req, res) => ledgerController.createLedger(req, res));

  // Must be registered before /:ledgerId to prevent capturing
  fastify.get('/api/v1/clients/:clientId/ledgers/balance-summary', {
    preHandler: [authenticate]
  }, (req, res) => ledgerController.getLedgerBalanceSummary(req, res));

  fastify.get('/api/v1/clients/:clientId/ledgers/:ledgerId', {
    preHandler: [authenticate, validateParams]
  }, (req, res) => ledgerController.getLedgerById(req, res));

  fastify.patch('/api/v1/clients/:clientId/ledgers/:ledgerId', {
    preHandler: [authenticate, requirePermission('MANAGE_LEDGER'), validateParams, validateBody(updateLedgerSchema)]
  }, (req, res) => ledgerController.updateLedger(req, res));

  fastify.delete('/api/v1/clients/:clientId/ledgers/:ledgerId', {
    preHandler: [authenticate, requirePermission('MANAGE_LEDGER'), validateParams]
  }, (req, res) => ledgerController.deleteLedger(req, res));

  // ── JOURNAL ENTRY ROUTES ──────────────────────────────────────────────────

  fastify.get('/api/v1/clients/:clientId/journal-entries', {
    preHandler: [authenticate, validateQuery(journalEntryFiltersSchema)]
  }, (req, res) => ledgerController.listJournalEntries(req, res));

  fastify.post('/api/v1/clients/:clientId/journal-entries', {
    preHandler: [authenticate, requirePermission('MANAGE_JOURNAL'), validateBody(createJournalEntrySchema)]
  }, (req, res) => ledgerController.createJournalEntry(req, res));

  fastify.get('/api/v1/clients/:clientId/journal-entries/:journalEntryId', {
    preHandler: [authenticate, validateParams]
  }, (req, res) => ledgerController.getJournalEntry(req, res));

  fastify.delete('/api/v1/clients/:clientId/journal-entries/:journalEntryId', {
    preHandler: [authenticate, requirePermission('MANAGE_JOURNAL'), validateParams]
  }, (req, res) => ledgerController.deleteJournalEntry(req, res));

  // ── INVOICE SPECIFIC ROUTES ───────────────────────────────────────────────

  fastify.get('/api/v1/clients/:clientId/invoices/:invoiceId/journal-entries', {
    preHandler: [authenticate, validateParams]
  }, (req, res) => ledgerController.getInvoiceJournalEntries(req, res));

  fastify.get('/api/v1/invoices/:invoiceId/journal-entries', {
    preHandler: [authenticate, validateParams]
  }, (req, res) => ledgerController.getInvoiceJournalEntries(req, res));
};

export default ledgerRoutes;
