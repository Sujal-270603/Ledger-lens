import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { ServiceUnavailableError } from '../errors';
import { logger } from '../common/logger/logger';

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy-access-key',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy-secret-key',
  },
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5000,
    requestTimeout: 27000, // Slightly higher than WaitTimeSeconds (20s) to prevent false-positive socket drops
  })
});

export const sendDocumentProcessingMessage = async (payload: {
  documentId: string;
  organizationId: string;
  s3Key: string;
  mimeType: string;
}): Promise<void> => {
  const queueUrl = process.env.AWS_SQS_QUEUE_URL;
  logger.info(`Queue URL: ${queueUrl}`);
  if (!queueUrl) throw new Error('AWS_SQS_QUEUE_URL environment variable is not set');
  
  logger.info(`Sending SQS message for document ${payload.documentId}`);
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(payload),
    ...(queueUrl.endsWith('.fifo') ? {
      MessageGroupId: payload.organizationId,
      MessageDeduplicationId: payload.documentId,
    } : {})
  });

  try {
    const response = await sqsClient.send(command);
    logger.info(`Successfully sent SQS message for document ${payload.documentId}. MessageId: ${response.MessageId}`);
  } catch (error) {
    logger.error({ err: error }, 'Failed to send message to SQS processing queue');
    if (process.env.NODE_ENV !== 'development') {
      throw new ServiceUnavailableError('Processing queue');
    } else {
      logger.warn('Ignoring SQS error in development mode.');
    }
  }
};

export const receiveMessages = async (maxMessages?: number): Promise<any[]> => {
  const queueUrl = process.env.AWS_SQS_QUEUE_URL;
  if (!queueUrl) throw new Error('AWS_SQS_QUEUE_URL environment variable is not set');

  const { ReceiveMessageCommand } = await import('@aws-sdk/client-sqs');
  logger.info({ queueUrl }, 'Receiving messages from SQS processing queue');
  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: maxMessages || 10,
    WaitTimeSeconds: 20,
    AttributeNames: ['All'],
    MessageAttributeNames: ['All'],
  });
  logger.info(`Receiving messages from SQS processing queue`);
  try {
    const response = await sqsClient.send(command);
    return response.Messages || [];
  } catch (error: any) {
    logger.error({ 
      err: error,
      queueUrl,
      requestId: error.$metadata?.requestId
    }, 'Failed to receive messages from SQS processing queue');
    throw new ServiceUnavailableError('Processing queue');
  }
};

export const deleteMessage = async (receiptHandle: string): Promise<void> => {
  const queueUrl = process.env.AWS_SQS_QUEUE_URL;
  if (!queueUrl) throw new Error('AWS_SQS_QUEUE_URL environment variable is not set');

  const { DeleteMessageCommand } = await import('@aws-sdk/client-sqs');

  const command = new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle,
  });

  try {
    await sqsClient.send(command);
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete message from SQS processing queue');
    throw new ServiceUnavailableError('Processing queue');
  }
};
