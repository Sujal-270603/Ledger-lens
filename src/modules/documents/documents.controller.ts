// src/modules/documents/documents.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { documentsService } from './documents.service';
import {
  GenerateUploadUrlInput,
  ConfirmUploadInput,
  DocumentFilters
} from './documents.types';

export class DocumentsController {
  async generateUploadUrl(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const data = request.body as GenerateUploadUrlInput;
    const result = await documentsService.generateUploadUrl(user.organizationId, user.userId, user.role, data);
    return reply.status(201).send({ status: 'success', data: result });
  }

  async confirmUpload(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { documentId } = request.params as { documentId: string };
    const ipAddress = request.ip || 'unknown';
    const result = await documentsService.confirmUpload(documentId, user.organizationId, user.userId, user.role, ipAddress);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async listDocuments(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const filters = request.query as DocumentFilters;
    const result = await documentsService.listDocuments(user.organizationId, user.userId, user.role, filters);
    return reply.status(200).send(result);
  }

  async getDocumentById(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { documentId } = request.params as { documentId: string };
    const result = await documentsService.getDocumentById(documentId, user.organizationId, user.userId, user.role);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async generateDownloadUrl(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { documentId } = request.params as { documentId: string };
    const result = await documentsService.generateDownloadUrl(documentId, user.organizationId, user.userId, user.role);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async deleteDocument(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { documentId } = request.params as { documentId: string };
    await documentsService.deleteDocument(documentId, user.organizationId, user.userId, user.role);
    return reply.status(204).send();
  }
}

export const documentsController = new DocumentsController();
