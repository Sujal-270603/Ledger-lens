# GST AI Invoice Processor - Backend

Production-grade backend for processing GST Invoices using AWS Textract, OpenAI, and Node.js/Fastify.

## Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify (TypeScript)
- **Database**: PostgreSQL 15 (Prisma ORM)
- **Queue**: BullMQ (Redis)
- **Services**: AWS S3, AWS Textract, OpenAI, Razorpay

## Architecture

Modular Monolith with Service-Repository pattern.

- `src/modules/`: Feature-based modules (Auth, Invoices, Billing, Exports)
- `src/workers/`: Background workers for heavy processing
- `src/services/`: External service wrappers (AWS, OpenAI)

## Setup

1. **Navigate to Directory**

   ```bash
   cd Backend
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Environment**
   Copy `.env.example` to `.env` and fill in credentials.

4. **Database**

   ```bash
   docker-compose up -d postgres redis
   npx prisma migrate dev
   ```

5. **Run**

   ```bash
   # Development
   npm run dev

   # Production
   npm run build
   npm start
   ```

## Workers

The app relies on background workers for invoice processing.
Run workers separately or via PM2:

```bash
npx ts-node src/workers/invoice.worker.ts
```
