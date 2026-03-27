import { SQSClient } from '@aws-sdk/client-sqs';

const client = new SQSClient({
  region: 'ap-south-1',
  useQueueUrlAsEndpoint: false
});
