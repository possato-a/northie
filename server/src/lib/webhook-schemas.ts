/**
 * @file lib/webhook-schemas.ts
 * Schemas Zod para validação dos payloads de webhook de cada plataforma.
 * Garante que campos obrigatórios existem antes de entrar no pipeline de normalização.
 */

import { z } from 'zod';

// ── Stripe ────────────────────────────────────────────────────────────────────

export const StripeWebhookSchema = z.object({
    type: z.string(),
    data: z.object({
        object: z.record(z.string(), z.unknown()),
    }),
});

export const StripeCheckoutSessionSchema = z.object({
    type: z.literal('checkout.session.completed'),
    data: z.object({
        object: z.object({
            id: z.string(),
            amount_total: z.number().positive(),
            customer_details: z.object({
                email: z.string().email(),
            }),
            metadata: z.record(z.string(), z.string()).optional(),
        }),
    }),
});

// ── Hotmart ───────────────────────────────────────────────────────────────────

export const HotmartWebhookSchema = z.object({
    event: z.string(),
    data: z.object({
        buyer: z.object({
            email: z.string().email(),
        }),
        purchase: z.object({
            transaction: z.string(),
            full_price: z.object({
                value: z.number().positive(),
            }),
            src: z.string().optional(),
            hsrc: z.string().optional(),
        }),
        hsrc: z.string().optional(),
        src: z.string().optional(),
    }),
});

// ── Kiwify ────────────────────────────────────────────────────────────────────

export const KiwifyWebhookSchema = z.object({
    order_status: z.string(),
    order_id: z.string(),
    order_ref_amount: z.number().positive(),
    Customer: z.object({
        email: z.string().email(),
    }),
});

// ── Shopify ───────────────────────────────────────────────────────────────────

export const ShopifyWebhookSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    total_price: z.string(), // Shopify envia como string "123.45"
    financial_status: z.string(),
    note_attributes: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .optional(),
});

// ── Validator genérico ────────────────────────────────────────────────────────

type ValidationResult =
    | { success: true; data: any }
    | { success: false; errors: string[] };

export function validateWebhookPayload(platform: string, payload: unknown): ValidationResult {
    let schema: z.ZodTypeAny | null = null;

    switch (platform) {
        case 'stripe':
            schema = StripeWebhookSchema;
            break;
        case 'hotmart':
            schema = HotmartWebhookSchema;
            break;
        case 'kiwify':
            schema = KiwifyWebhookSchema;
            break;
        case 'shopify':
            schema = ShopifyWebhookSchema;
            break;
        default:
            // Plataformas sem schema definido: passam sem validação
            return { success: true, data: payload };
    }

    const result = schema.safeParse(payload);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors = result.error.issues.map(e => `${e.path.map(String).join('.')}: ${e.message}`);
    return { success: false, errors };
}
