-- Expande o CHECK constraint de status em growth_recommendations
-- para incluir 'rejected' (rejeição definitiva) e 'cancelled' (execução cancelada).

ALTER TABLE growth_recommendations DROP CONSTRAINT IF EXISTS growth_recommendations_status_check;

ALTER TABLE growth_recommendations ADD CONSTRAINT growth_recommendations_status_check
    CHECK (status IN (
        'pending',
        'approved',
        'executing',
        'completed',
        'failed',
        'dismissed',
        'rejected',
        'cancelled'
    ));
