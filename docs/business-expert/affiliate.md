# Affiliate Assistant

Fluxo guiado quando o usuário quer **vender como afiliado**.

## Perguntas

- Tempo disponível  
- Capital  
- Tráfego pago?  
- Orgânico?  
- Experiência  
- Objetivo financeiro  

## Saídas

- Plataformas recomendadas (registry)  
- Diferenças de alto nível  
- Plano completo (checklist, marcos, KPIs)  
- Outline de projeto para o core Planner  

## API

```ts
import { runAffiliateAssistant } from "@/lib/business-expert";

runAffiliateAssistant({
  timeAvailable: "part-time",
  capital: "bootstrap",
  paidTraffic: false,
  organic: true,
  experience: "beginner",
  financialGoal: "Primeira comissão em 60 dias",
});
```
