import { receiveMessages } from './src/shared/sqs';
import * as dotenv from 'dotenv';
dotenv.config();

async function testReceive() {
    console.log("Checking queue:", process.env.AWS_SQS_QUEUE_URL);
    try {
        const messages = await receiveMessages(1);
        console.log("Messages found:", messages.length);
        if (messages.length > 0) {
            console.log("First message preview:");
            console.log(messages[0].Body);
        }
    } catch (e) {
        console.error("Error receiving messages:", e);
    }
}
testReceive();
