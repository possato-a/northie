export const GLOBAL_SKILLS = [
    {
        name: 'Análise de CAC',
        description: 'Benchmarks e regras de interpretação de CAC para negócios digitais BR',
        content: `Ao analisar CAC, sempre:
- Separe por canal de aquisição (Meta Ads, Google Ads, orgânico, afiliado)
- Compare com o LTV médio do mesmo canal e período
- Benchmarks BR por modelo:
  * Infoproduto: R$ 80–200 (saudável), acima de R$ 300 é alerta
  * SaaS: R$ 300–800 (saudável), acima de R$ 1.000 requer análise de churn
  * E-commerce: R$ 50–150 (saudável)
- Se CAC > LTV/3, sinalize como crítico e sugira revisão de funil ou canal
- Considere sazonalidade: CAC em período de lançamento é 2–4x maior que no perpétuo`,
    },
    {
        name: 'Diagnóstico de Churn',
        description: 'Metodologia para identificar e agir em churn',
        content: `Ao diagnosticar churn:
- SaaS: churn mensal aceitável até 2%. 2–5% requer atenção. Acima de 5% é crítico
- Infoproduto: medir por cohort de entrada — comparar LTV do cohort vs CAC pago
- E-commerce: usar intervalo médio de recompra do cohort. Acima de 1.5x = churn provável
- Sempre identifique o canal de aquisição dos clientes com maior churn
- Sugira segmento de reativação para Champions sem compra no último intervalo esperado`,
    },
    {
        name: 'Interpretação de LTV/CAC',
        description: 'Regras de ouro para LTV/CAC em negócios digitais',
        content: `Regras de interpretação LTV/CAC:
- LTV/CAC < 1: negócio queima caixa em aquisição — alerta vermelho
- LTV/CAC 1–3: margem apertada, escalar é arriscado sem melhorar retenção
- LTV/CAC 3–5: saudável para escalar com cautela
- LTV/CAC > 5: excelente — pode aumentar agressividade no canal
- Para infoproduto, considere apenas o LTV do primeiro produto
- Sempre mencione o payback period: quanto tempo para recuperar o CAC`,
    },
];
//# sourceMappingURL=global-seeds.js.map