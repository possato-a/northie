import type { Response } from 'express';
import type Anthropic from '@anthropic-ai/sdk';

/**
 * Escreve um stream de eventos SSE a partir de um stream da Anthropic SDK.
 * Retorna o texto completo acumulado ao final.
 */
export async function streamToSSE(
  stream: AsyncIterable<Anthropic.MessageStreamEvent>,
  res: Response,
): Promise<string> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let fullText = '';

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      const delta = event.delta;
      if (delta.type === 'text_delta') {
        fullText += delta.text;
        res.write(`data: ${JSON.stringify({ type: 'text', text: delta.text })}\n\n`);
      } else if (delta.type === 'thinking_delta') {
        res.write(`data: ${JSON.stringify({ type: 'thinking', text: delta.thinking })}\n\n`);
      }
    } else if (event.type === 'message_stop') {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    }
  }

  res.end();
  return fullText;
}
