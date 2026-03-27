// src/shared/llm.ts
import { gemini } from './gemini';
import { InternalError, ServiceUnavailableError } from '../errors';
import { logger } from '../common/logger/logger';

export interface LLMExtractionResult {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  vendorName: string | null;
  vendorGstin: string | null;
  totalAmount: number | null;
  gstAmount: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  items: {
    description: string;
    hsnCode: string | null;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate: number;
  }[];
  confidenceScore: number;
  extractionNotes: string | null;
}

export const structureInvoiceData = async (params: {
  rawText: string;
  organizationId: string;
  documentId: string;
}): Promise<LLMExtractionResult> => {
  const systemPrompt = `You are an expert GST invoice data extraction assistant for Indian CA firms.
Extract structured invoice data from the provided OCR text.
Always respond with valid JSON only. No explanation. No markdown.
If a field cannot be determined, use null.
Dates must be in YYYY-MM-DD format.
All amounts must be numbers (not strings).
GST numbers must follow Indian GSTIN format.
Assess your own confidence from 0 to 1 based on text clarity.`;

  const userPrompt = `Extract all invoice fields from this OCR text and return as JSON matching the schema exactly:
{
  "invoiceNumber": "string",
  "invoiceDate": "YYYY-MM-DD",
  "vendorName": "string",
  "vendorGstin": "string",
  "totalAmount": 0,
  "gstAmount": 0,
  "cgstAmount": 0,
  "sgstAmount": 0,
  "igstAmount": 0,
  "items": [{ "description": "string", "hsnCode": "string", "quantity": 0, "unitPrice": 0, "amount": 0, "taxRate": 0 }],
  "confidenceScore": 0.0,
  "extractionNotes": "string"
}

OCR Text:
---
${params.rawText}
---`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const textPayload = response.text;
    if (!textPayload) {
      throw new InternalError('LLM did not return text content');
    }

    const jsonText = textPayload.replace(/^[^{]*|[^}]*$/g, '');
    let result: LLMExtractionResult;
    try {
      result = JSON.parse(jsonText);
    } catch (parseError) {
      logger.error({ err: parseError, jsonText, documentId: params.documentId }, 'Invalid JSON from LLM');
      throw new InternalError('LLM returned invalid JSON');
    }

    logger.info({
      documentId: params.documentId,
      llmConfidence: result.confidenceScore,
      extractionNotes: result.extractionNotes
    }, 'LLM structuring complete');

    return result;
  } catch (error) {
    if (error instanceof InternalError) {
      throw error;
    }
    logger.error({ err: error, documentId: params.documentId }, 'Gemini API error');
    throw new ServiceUnavailableError('LLM service');
  }
};
