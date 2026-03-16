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
// O Hotmart envia múltiplos tipos de evento com estruturas ligeiramente diferentes.
// Validamos a estrutura mínima comum e deixamos o normalizador tratar cada event type.

export const HotmartWebhookSchema = z.object({
    event: z.string(),
    data: z.object({
        buyer: z.object({
            email: z.string().email(),
            name: z.string().optional(),
        }),
        purchase: z.object({
            transaction: z.string(),
            full_price: z.object({
                // Reembolsos podem ter value=0; usamos .nonnegative() em vez de .positive()
                value: z.number().nonnegative(),
                currency_value: z.string().optional(),
            }),
            status: z.string().optional(),
            src: z.string().optional(),
            hsrc: z.string().optional(),
        }),
        product: z.object({
            id: z.number().optional(),
            name: z.string().optional(),
        }).optional(),
        hsrc: z.string().optional(),
        src: z.string().optional(),
    }),
});

// ── Shopify ───────────────────────────────────────────────────────────────────
// Shopify envia diferentes payloads por topic. O _topic é injetado pelo webhook handler.

const ShopifyOrderSchema = z.object({
    id: z.number(),
    email: z.string().optional(),
    customer: z.object({ email: z.string().optional() }).optional(),
    total_price: z.string(),
    total_tax: z.string().optional(),
    total_discounts: z.string().optional(),
    financial_status: z.string(),
    note_attributes: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    _topic: z.string().optional(),
});

const ShopifyCustomerSchema = z.object({
    id: z.number(),
    email: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    _topic: z.string().optional(),
});

export const ShopifyWebhookSchema = z.union([ShopifyOrderSchema, ShopifyCustomerSchema]);

// ── Validator genérico ────────────────────────────────────────────────────────

type ValidationResult =
    | { success: true; data: unknown }
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
