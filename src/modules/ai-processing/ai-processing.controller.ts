// src/modules/ai-processing/ai-processing.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { aiProcessingService } from './ai-processing.service';
import { AcceptExtractionInput } from './ai-processing.types';

export class AIProcessingController {
  async getAIStatus(request: FastifyRequest, reply: FastifyReply) {
    const { documentId } = request.params as { documentId: string };
    const { organizationId, userId, role } = request.user;

    const data = await aiProcessingService.getAIStatus(documentId, organizationId, userId, role);
    return reply.status(200).send({ status: 'success', data });
  }

  async reprocessDocument(request: FastifyRequest, reply: FastifyReply) {
    const { documentId } = request.params as { documentId: string };
    const { organizationId, userId, role } = request.user;

    const result = await aiProcessingService.reprocessDocument(documentId, organizationId, userId, role);
    return reply.status(200).send({ status: 'success', message: result.message });
  }

  async getExtractionPreview(request: FastifyRequest, reply: FastifyReply) {
    const { documentId } = request.params as { documentId: string };
    const { organizationId, userId, role } = request.user;

    const data = await aiProcessingService.getExtractionPreview(documentId, organizationId, userId, role);
    return reply.status(200).send({ status: 'success', data });
  }

  async acceptExtraction(request: FastifyRequest, reply: FastifyReply) {
    const { documentId } = request.params as { documentId: string };
    const { organizationId, userId, role } = request.user;
    const body = request.body as AcceptExtractionInput;

    const data = await aiProcessingService.acceptExtraction(documentId, organizationId, userId, role, body);
    return reply.status(200).send({ status: 'success', data });
  }
}

export const aiProcessingController = new AIProcessingController();
