import { cleanEnv, str, num, url } from 'envalid';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: num({ default: 3000 }),
  HOST: str({ default: '0.0.0.0' }),
  
  // Database
  DATABASE_URL: url({ default: 'postgresql://postgres:newpassword123@localhost:5432/ledgerlens' }),
  
  // Redis
  REDIS_HOST: str({ default: 'localhost' }),
  REDIS_PORT: num({ default: 6379 }),
  
  // Auth
  JWT_SECRET: str({ default: 'someweirdsecretSTRING' }),
  JWT_REFRESH_SECRET: str({ default: 'someweirdrefreshsecretSTRING' }),
  API_KEY_SALT: str({ default: 'someweirdsaltSTRING' }),
  
  // AWS
  AWS_REGION: str({ default: 'ap-south-1' }),
  AWS_ACCESS_KEY_ID: str(),
  AWS_SECRET_ACCESS_KEY: str(),
  AWS_S3_BUCKET: str({ default: 'ledger-lens-s3' }),
  AWS_SQS_QUEUE_URL: str({ default: 'https://sqs.eu-north-1.amazonaws.com/555212088412/Ledgerlens' }),
  
  // OpenAI & Gemini
  // OPENAI_API_KEY: str(),
  GEMINI_API_KEY: str(),
  
  // Razorpay
  RAZORPAY_KEY_ID: str(),
  RAZORPAY_KEY_SECRET: str(),
  RAZORPAY_WEBHOOK_SECRET: str(),
});
