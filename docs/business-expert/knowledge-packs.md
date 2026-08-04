# Knowledge Packs

Bundles de conhecimento para o Business Expert + fila para **Knowledge Hub** (sem duplicar o hub).

## Packs

- Business Pack  
- Affiliate Pack  
- Marketing Pack  
- Kiwify Pack  
- Hotmart Pack  
- SaaS Pack  
- Local Business Pack  
- Growth Pack  

## Ingestão

```ts
import { queueKnowledgeIngest } from "@/lib/business-expert";

queueKnowledgeIngest({
  userId: "…",
  title: "Docs oficiais",
  kind: "link", // pdf | docx | article | course | link
  sourceRef: "https://…",
  packId: "kiwify-pack",
});
```

Status `ready_for_hub` indica prontidão para o pipeline existente do Knowledge Hub — sem crawler no Expert.
