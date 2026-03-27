// src/modules/ledger/ledger.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { ledgerService } from './ledger.service';
import {
  CreateLedgerInput,
  UpdateLedgerInput,
  CreateJournalEntryInput,
  LedgerFilters,
  JournalEntryFilters
} from './ledger.types';

export class LedgerController {
  async listLedgers(request: FastifyRequest, reply: FastifyReply) {
    const { clientId } = request.params as { clientId: string };
    const filters = request.query as LedgerFilters;
    const result = await ledgerService.listLedgers(clientId, filters);
    return reply.status(200).send({ status: 'success', ...result });
  }

  async createLedger(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;
    const { clientId } = request.params as { clientId: string };
    const data = request.body as CreateLedgerInput;
    const result = await ledgerService.createLedger(clientId, user.organizationId, user.userId, data);
    return reply.status(201).send({ status: 'success', data: result });
  }

  async getLedgerById(request: FastifyRequest, reply: FastifyReply) {
    const { clientId, ledgerId } = request.params as { clientId: string, ledgerId: string };
    const result = await ledgerService.getLedgerById(ledgerId, clientId);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async updateLedger(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;
    const { clientId, ledgerId } = request.params as { clientId: string, ledgerId: string };
    const data = request.body as UpdateLedgerInput;
    const result = await ledgerService.updateLedger(ledgerId, clientId, user.userId, data);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async deleteLedger(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;
    const { clientId, ledgerId } = request.params as { clientId: string, ledgerId: string };
    await ledgerService.deleteLedger(ledgerId, clientId, user.userId);
    return reply.status(204).send();
  }

  async getLedgerBalanceSummary(request: FastifyRequest, reply: FastifyReply) {
    const { clientId } = request.params as { clientId: string };
    const result = await ledgerService.getLedgerBalanceSummary(clientId);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async listJournalEntries(request: FastifyRequest, reply: FastifyReply) {
    const { clientId } = request.params as { clientId: string };
    const filters = request.query as JournalEntryFilters;
    const result = await ledgerService.listJournalEntries(clientId, filters);
    return reply.status(200).send({ status: 'success', ...result });
  }

  async createJournalEntry(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;
    const { clientId } = request.params as { clientId: string };
    const data = request.body as CreateJournalEntryInput;
    const result = await ledgerService.createJournalEntry(clientId, user.organizationId, user.userId, data);
    return reply.status(201).send({ status: 'success', data: result });
  }

  async getJournalEntry(request: FastifyRequest, reply: FastifyReply) {
    const { clientId, journalEntryId } = request.params as { clientId: string, journalEntryId: string };
    const result = await ledgerService.getJournalEntry(journalEntryId, clientId);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async deleteJournalEntry(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;
    const { clientId, journalEntryId } = request.params as { clientId: string, journalEntryId: string };
    await ledgerService.deleteJournalEntry(journalEntryId, clientId, user.userId);
    return reply.status(204).send();
  }

  async getInvoiceJournalEntries(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;
    const { clientId, invoiceId } = request.params as { clientId?: string, invoiceId: string };
    const result = await ledgerService.getInvoiceJournalEntries(invoiceId, user.organizationId, clientId);
    return reply.status(200).send({ status: 'success', data: result });
  }
}

export const ledgerController = new LedgerController();
