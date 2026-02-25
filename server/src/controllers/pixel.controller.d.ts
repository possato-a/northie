import type { Request, Response } from 'express';
/**
 * Handles incoming tracking events from the Northie Pixel (UTMs, Click IDs, etc.)
 */
export declare function handlePixelEvent(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=pixel.controller.d.ts.map