import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const region = process.env.AWS_REGION || 'eu-north-1';
const bucket = process.env.AWS_S3_BUCKET;

if (!bucket) {
  console.error('AWS_S3_BUCKET is not set in .env');
  process.exit(1);
}

const s3Client = new S3Client({ region });

async function setupCors() {
  console.log(`Setting up CORS for bucket: ${bucket} in region: ${region}`);
  
  const corsConfig = {
    CORSRules: [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        AllowedOrigins: [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
          'http://localhost:8081',
          'http://localhost:3000',
          'https://ledger-lens-frontend-nu.vercel.app',
        ],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3000
      }
    ]
  };

  try {
    const command = new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: corsConfig
    });
    
    await s3Client.send(command);
    console.log('✅ S3 CORS configuration updated successfully!');
  } catch (err) {
    console.error('❌ Failed to update S3 CORS:', err);
    process.exit(1);
  }
}

setupCors();
