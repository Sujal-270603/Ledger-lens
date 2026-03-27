// src/shared/textract.ts
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { ServiceUnavailableError } from '../errors';
import { logger } from '../common/logger/logger';

// Textract is NOT available in all regions (e.g. eu-north-1 is unsupported).
// Use AWS_TEXTRACT_REGION to override with a supported region like eu-west-1.
// The S3 client uses the main AWS_REGION so it reads from the correct bucket region.
// We fetch the file bytes locally and pass them directly to Textract to avoid the
// cross-region S3 access restriction that Textract imposes.
const textractClient = new TextractClient({
  region: process.env.AWS_TEXTRACT_REGION || 'eu-west-1',
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
});

export interface TextractBlock {
  blockType: string;
  text: string | null;
  confidence: number | null;
  geometry?: {
    boundingBox: {
      width: number;
      height: number;
      left: number;
      top: number;
    };
  };
}

export interface TextractResult {
  rawText: string;
  blocks: TextractBlock[];
  confidence: number;
}

const streamToBuffer = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};

export const extractTextFromDocument = async (params: {
  s3Key: string;
  s3Bucket: string;
}): Promise<TextractResult> => {
  try {
    // Step 1: Download the document bytes from S3 (eu-north-1)
    logger.info({ s3Key: params.s3Key }, 'Fetching document bytes from S3');
    const s3Response = await s3Client.send(
      new GetObjectCommand({ Bucket: params.s3Bucket, Key: params.s3Key }),
    );

    if (!s3Response.Body) {
      throw new Error('Empty response body from S3');
    }

    const documentBytes = await streamToBuffer(s3Response.Body as NodeJS.ReadableStream);

    // Step 2: Send raw bytes to Textract (eu-west-1) — avoids cross-region S3 restriction
    logger.info({ s3Key: params.s3Key, bytes: documentBytes.length }, 'Sending bytes to Textract');
    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: documentBytes,
      },
    });

    const response = await textractClient.send(command);
    const blocks = response.Blocks || [];

    const extractedBlocks: TextractBlock[] = [];
    const lineTexts: string[] = [];
    let totalConfidence = 0;
    let lineCount = 0;

    for (const block of blocks) {
      if (block.BlockType === 'WORD' || block.BlockType === 'LINE') {
        const textractBlock: TextractBlock = {
          blockType: block.BlockType,
          text: block.Text || null,
          confidence: block.Confidence !== undefined ? block.Confidence / 100 : null,
        };

        if (block.Geometry?.BoundingBox) {
          textractBlock.geometry = {
            boundingBox: {
              width: block.Geometry.BoundingBox.Width || 0,
              height: block.Geometry.BoundingBox.Height || 0,
              left: block.Geometry.BoundingBox.Left || 0,
              top: block.Geometry.BoundingBox.Top || 0,
            },
          };
        }

        extractedBlocks.push(textractBlock);

        if (block.BlockType === 'LINE') {
          if (block.Text) lineTexts.push(block.Text);
          if (textractBlock.confidence !== null) {
            totalConfidence += textractBlock.confidence;
            lineCount++;
          }
        }
      }
    }

    const rawText = lineTexts.join('\n');
    const averageConfidence = lineCount > 0 ? totalConfidence / lineCount : 0;

    logger.info({ confidence: averageConfidence, s3Key: params.s3Key }, 'Textract extraction complete');

    return {
      rawText,
      blocks: extractedBlocks,
      confidence: averageConfidence,
    };
  } catch (error) {
    logger.error({ err: error, s3Key: params.s3Key }, 'AWS Textract error');
    throw new ServiceUnavailableError('Textract');
  }
};
