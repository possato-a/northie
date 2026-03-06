-- Atomic LTV increment + last_purchase_at GREATEST
-- Resolve 2 bugs:
-- 1. Race condition: read-modify-write em LTV causava perda de incrementos concorrentes
-- 2. Backfill: last_purchase_at recebia new Date() em vez da data real da transação

CREATE OR REPLACE FUNCTION update_customer_ltv(
    p_customer_id UUID,
    p_ltv_increment NUMERIC,
    p_purchase_date TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
    UPDATE customers
    SET
        total_ltv = COALESCE(total_ltv, 0) + p_ltv_increment,
        last_purchase_at = GREATEST(last_purchase_at, p_purchase_date)
    WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
