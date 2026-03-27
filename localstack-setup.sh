#!/bin/bash
set -e

echo "Initializing LocalStack resources..."

# Create S3 bucket
awslocal s3 mb s3://ledgerlens-documents \
  --region ap-south-1

# Set bucket CORS for direct browser uploads
awslocal s3api put-bucket-cors \
  --bucket ledgerlens-documents \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }]
  }'

# Create SQS FIFO queue
awslocal sqs create-queue \
  --queue-name ledgerlens-processing.fifo \
  --attributes '{
    "FifoQueue": "true",
    "ContentBasedDeduplication": "false",
    "VisibilityTimeout": "300",
    "MessageRetentionPeriod": "345600",
    "ReceiveMessageWaitTimeSeconds": "20"
  }' \
  --region ap-south-1

# Create Dead Letter Queue
awslocal sqs create-queue \
  --queue-name ledgerlens-processing-dlq.fifo \
  --attributes '{"FifoQueue": "true"}' \
  --region ap-south-1

echo "LocalStack initialization complete."
echo "S3 bucket: ledgerlens-documents"
echo "SQS queue: ledgerlens-processing.fifo"
