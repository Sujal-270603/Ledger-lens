# Deployment Checklist

## Infrastructure

- [ ] **Database**: Managed PostgreSQL (AWS RDS or equivalent) with generic backups.
- [ ] **Redis**: Managed Redis (AWS ElastiCache).
- [ ] **S3 Bucket**: Create bucket with CORS enabled for direct uploads if needed (or proxied).
- [ ] **IAM User**: Create IAM user with `AmazonTextractFullAccess` and `AmazonS3FullAccess`.

## Environment Variables

Ensure all variables in `.env.example` are set in the production environment (e.g., AWS Parameter Store, Secrets Manager).

## CI/CD Pipeline

1. **Build**: `npm ci && npm run build`
2. **Migrations**: `npx prisma migrate deploy`
3. **Deploy**:
   - Dockerize using `Dockerfile`.
   - Push to ECR/Docker Hub.
   - Deploy to ECS/EC2.

## PM2 (If using EC2 directly)

Use the `ecosystem.config.js` (create if missing):

```javascript
module.exports = {
  apps: [
    {
      name: "gst-api",
      script: "./dist/server.js",
      instances: "max",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "gst-worker",
      script: "./dist/workers/invoice.worker.js",
      instances: 1,
    },
  ],
};
```

## Rate Limiting & Security

- Rate limits are configured in `app.ts` (Redis backed).
- Helmet is enabled.
- Ensure API Gateway / Nginx sits in front for SSL termination.
