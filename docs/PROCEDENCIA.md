# Procedência do código

Registro de origem (DP-16). Diz de onde veio o que não foi escrito do zero aqui.

## Sala limpa

A Triagem+ foi feita **sem ler, usar ou copiar** qualquer extensão concorrente: nenhum código, análise, texto, servidor ou comportamento de extensão de terceiros foi consultado ou aproveitado. O que não veio da Candidata+ foi escrito neste projeto, a partir da especificação.

## O que veio da Candidata+

A Candidata+ é outro projeto do mesmo dono, em `C:/Users/fabio/Documents/projetos/opentowork`. A licença dela é **Apache-2.0**. O código foi lido pelo marco `onda-4`, com `git show onda-4:<caminho>`, e nada foi alterado lá.

Cada linha abaixo foi conferida: o caminho existe no marco `onda-4` e existe aqui. A coluna "Como foi usado" diz se o arquivo é igual, quase igual ou adaptado, pela comparação dos dois arquivos.

| Caminho na Candidata+ | Caminho aqui | Como foi usado |
|---|---|---|
| `scripts/build.mjs` | `scripts/build.mjs` | Adaptado para o pacote desta extensão. |
| `scripts/verify-dist.mjs` | `scripts/verify-dist.mjs` | Adaptado para as regras desta extensão. |
| `scripts/check-secrets.mjs` | `scripts/check-secrets.mjs` | Adaptado. |
| `scripts/gen-icons.mjs` | `scripts/gen-icons.mjs` | Adaptado. |
| `src/platform/chrome/api.ts` | `src/platform/chrome/api.ts` | Adaptado. |
| `src/platform/chrome/side-panel.ts` | `src/platform/chrome/side-panel.ts` | Adaptado, com pouca mudança. |
| `src/platform/chrome/scripting.ts` | `src/platform/chrome/scripting.ts` | Adaptado. |
| `src/platform/chrome/context-menus.ts` | `src/platform/chrome/context-menus.ts` | Adaptado. |
| `tsconfig.json` | `tsconfig.json` | Quase igual (poucas linhas mudadas). |
| `tsconfig.core.json` | `tsconfig.core.json` | Adaptado (11 linhas diferentes). |
| `.gitignore` | `.gitignore` | Quase igual (poucas linhas mudadas). |
| `.gitattributes` | `.gitattributes` | Quase igual (uma linha mudada). |
| `.editorconfig` | `.editorconfig` | Copiado sem mudança. |
| `tests/e2e/harness.ts` | `tests/e2e/harness.ts` | Só a forma (Chromium com a extensão carregada e prova de rede zero). O código foi reescrito e é bem diferente. |
| `src/core/text/normalize.ts` | `src/core/text/normalize.ts` | Copiado sem mudança. |
| `src/core/text/tokens.ts` | `src/core/text/tokens.ts` | Copiado sem mudança. |
| `src/core/dictionary/blocks.ts` | `src/core/dictionary/blocks.ts` | Quase igual (poucas linhas mudadas). |
| `src/core/dictionary/compile.ts` | `src/core/dictionary/compile.ts` | Adaptado. |
| `src/core/dictionary/find.ts` | `src/core/dictionary/find.ts` | Adaptado. |
| `src/core/dictionary/protect.ts` | `src/core/dictionary/protect.ts` | Adaptado. |
| `src/core/dictionary/types.ts` | `src/core/dictionary/types.ts` | Adaptado. |
| `src/core/dictionary/data/curated.ts` | `src/core/dictionary/data/curated.ts` | Revisado. |
| `src/core/dictionary/data/technology.ts` | `src/core/dictionary/data/technology.ts` | Revisado. |
| `src/core/dictionary/data/tools.ts` | `src/core/dictionary/data/tools.ts` | Revisado. |
| `src/core/dictionary/data/skills.ts` | `src/core/dictionary/data/skills.ts` | Revisado. |
| `src/core/dictionary/data/people.ts` | `src/core/dictionary/data/people.ts` | Revisado. |
| `src/core/time/types.ts` | `src/core/time/types.ts` | Adaptado: sem o tipo de experiência do perfil de lá. |
| `src/core/time/year-month.ts` | `src/core/time/year-month.ts` | Adaptado: só com o que o leitor de perfil usa. |
| `src/core/time/parse-date.ts` | `src/core/time/parse-date.ts` | Adaptado: só português e inglês (DP-17). |
| `src/core/time/union.ts` | `src/core/time/union.ts` | Quase igual, sem mudança de comportamento. |
| `src/panel/ui/h.ts` | `src/panel/ui/h.ts` | Adaptado. |
| `src/panel/ui/render.ts` | `src/panel/ui/render.ts` | Adaptado. |
| `src/panel/ui/tokens.css` | `src/panel/ui/tokens.css` | Adaptado. |
| `src/panel/ui/components.css` | `src/panel/ui/components.css` | Adaptado. |
| `src/panel/ui/components.ts` | `src/panel/ui/components.ts` | Adaptado: ficou só o que as telas usam. |
| `src/panel/ui/download-link.ts` | `src/panel/ui/download-link.ts` | Adaptado. |

### Só como ponto de partida

| Caminho na Candidata+ | Situação |
|---|---|
| `src/core/ai/sensitive-phrases.ts` | Existe no marco `onda-4`. **Não existe aqui**: nenhum arquivo foi copiado. Serviu só como ponto de partida para pensar a trava de termos. A trava desta extensão está em `src/core/guard/` e a origem das palavras **está a conferir** (não foi comparada linha a linha). |

## O que não veio

Lote, Easy Apply, formulários externos, respostas, aprendizado, currículo, IA, i18n, roteador de mensagens, scripts fixos em páginas, verificadores do plano e `plano.json`.

## Dependências de desenvolvimento

Usadas só para construir e testar. **Nenhuma biblioteca entra no pacote final** (RNF-12): o PDF, o leitor de perfil e as telas são código próprio.

| Pacote | Versão | Para que serve |
|---|---|---|
| `@types/chrome` | ^0.3.5 | tipos da API do Chrome |
| `@types/jsdom` | ^30.0.0 | tipos do jsdom |
| `@types/node` | ^26.6.5 | tipos do Node |
| `esbuild` | ^0.28.2 | gera o pacote |
| `jsdom` | ^30.1.3 | testa telas sem navegador |
| `pdfjs-dist` | 6.4.299 | lê de volta o PDF gerado, nos testes |
| `playwright` | 1.64.1 | abre o Chromium com a extensão, nos testes |
| `typescript` | ^7.0.2 | confere os tipos |
