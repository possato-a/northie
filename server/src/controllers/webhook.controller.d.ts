import type { Request, Response } from 'express';
/**
 * Handles incoming webhooks by persisting raw data and triggering normalization
 */
export declare function handleWebhook(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=webhook.controller.d.ts.map