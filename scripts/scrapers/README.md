# Scrapers

Os crawlers do proxy local ficam separados por agente fiduciario em `agents/`.

Agentes registrados hoje:

- `ecoagro`
- `vortx`
- `oliveira-trust`
- `pentagono`
- `opea`
- `generic` como fallback

Para adicionar um novo agente:

1. Crie `agents/<agente>.mjs`.
2. Exporte um objeto com `name`, `canHandle(url)` e `scrape(url, logs)`.
3. Registre o scraper em `index.mjs`, antes do `generic`.

O diretorio `shared/` deve concentrar parsers e normalizadores reutilizaveis
entre agentes, como extracao de tabelas HTML, estrategias comuns de fetch e
mapeamento de JSON.
