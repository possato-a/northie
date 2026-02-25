import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function testDirect() {
    console.log('Testing Anthropic Key Direct...');
    console.log('Key length:', process.env.ANTHROPIC_API_KEY?.length);
    console.log('Starts with:', process.env.ANTHROPIC_API_KEY?.substring(0, 7));

    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });

    try {
        const message = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hello' }],
        });
        console.log('Success!', message.content[0]);
    } catch (err: any) {
        console.error('FAILED');
        console.error('Status:', err.status);
        console.error('Error Body:', JSON.stringify(err.error, null, 2));
        console.error('Message:', err.message);
    }
}

testDirect();
