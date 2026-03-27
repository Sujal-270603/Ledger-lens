// src/shared/s3.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../config/env';

const s3Client = new S3Client({
  region: env.AWS_REGION
});

const getBucketName = () => {
  return env.AWS_S3_BUCKET;
};

export const generatePresignedPutUrl = async (params: {
  key: string;
  mimeType: string;
  maxSizeBytes: number;
}): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: params.key,
    ContentType: params.mimeType,
    // ContentLength can optionally be enforced at bucket policy, but we generate the URL here
  });

  return getSignedUrl(s3Client, command, { expiresIn: 900 });
};

export const generatePresignedGetUrl = async (params: {
  key: string;
  expiresInSeconds?: number;
}): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: params.key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: params.expiresInSeconds || 900 });
};

export const deleteS3Object = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  await s3Client.send(command);
};
