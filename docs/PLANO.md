# Plano de construção da Triagem+

Plano em 12 fatias e 4 marcos, a partir de [ESPECIFICACAO.md](ESPECIFICACAO.md) e [DECISOES.md](DECISOES.md). A Candidata+ tem 90 fatias porque o produto é muito maior. Aqui não há portões por onda nem verificadores do plano: cada fatia é pequena e testada.

## 1. Marcos

| Marco | O que passa a existir | O que o dono faz |
|---|---|---|
| **A. Base e regras** (F01 a F05) | Pacote que carrega no Chrome, e as regras prontas e testadas: termos, trava, leitor, nota, busca | 2 minutos: prova do menu do botão direito numa página qualquer |
| **B. Dá para usar colando** (F06 a F08 e F10a) | Vagas, busca, colar perfil, nota, conversa, Top 10 e PDF | 15 minutos: instalar pela pasta, testar colando o texto do próprio perfil e abrir o PDF |
| **C. Completo** (F09 e F10b) | Clique, modelos de mensagem, privacidade | Nada obrigatório |
| **D. Fechamento** (F11) | Jornadas completas, documentação e roteiro | 30 minutos: roteiro na conta real |

Cada marco termina com todos os testes passando e um resumo em linguagem simples. Commit só quando o dono pedir (RD-3).

## 2. Fatias

**Dificuldade:** *simples* é trabalho mecânico ou adaptação; *média* tem regra a acertar; *delicada* tem erro caro, que pede revisão independente.

| Fatia | O que entrega | Requisitos | Depende de | Dificuldade | Tamanho aproximado |
|---|---|---|---|---|---|
| F01 | Esqueleto e prova do clique | RNF-01, 02, 06, 12; CA-17, 18 | nenhuma | simples | 500 linhas |
| F02 | Termos de tecnologia | RF-12; CA-04 | F01 | simples | 300 novas, 1.100 reaproveitadas |
| F03 | Trava de termos e requisitos da vaga | RF-11 a 16; CA-02 | F02 | delicada | 500 linhas |
| F04 | Leitor de perfil | RF-40 a 45, RF-35; CA-05, 06 | F01 | delicada | 700 linhas |
| F05 | Nota e busca | RF-20, 21, RF-50 a 55, RF-57; CA-03, 07, 08 | F02, F03, F04 | delicada | 600 linhas |
| F06 | Armazenamento e prazo | RF-90 a 93, seção 9; CA-15 | F01 | média | 500 linhas |
| F07 | Painel: avisos, vagas e busca | RF-01 a 03, RF-10, RF-22 a 24; CA-01 | F03, F05, F06 | média | 800 linhas |
| F08 | Painel: conversa, colar, analisar, lista e Top 10 | RF-30, 36, 37, RF-56, RF-60 a 69, RF-73; CA-09 a 12, 25, 26 | F07, F10a | média | 1.000 linhas |
| F09 | Leitura por clique | RF-31 a 34; CA-19 | F08 | delicada | 400 linhas |
| F10a | Relatório em PDF e CSV | RF-70 a 72, 74, 75; CA-13, 14, 27 | F05 | média | 600 linhas |
| F10b | Modelos de mensagem e privacidade | RF-80 a 82, RF-91, 94, RNF-05; CA-16 | F07 | média | 600 linhas |
| F11 | Fechamento | RNF-03, 04, 07 a 11; CA-20 a 24, 28 no roteiro | todas | média | 600 linhas |

**Ordem:** F01 primeiro. Depois F02, F04 e F06 em paralelo. Depois F03. Depois F05. Depois F07 e F10a em paralelo. Depois F08 e F10b em paralelo, com posse separada de arquivos. Depois F09. Por fim F11.

## 3. O que cada fatia precisa provar

### F01. Esqueleto e prova do clique

Cria `package.json`, build, verificação do pacote, checagem de segredos, ícones próprios, manifesto com a lista exata de permissões, painel mínimo e uma função de leitura mínima.

- **Pronta quando:** o pacote carrega no Chromium, o teste prova zero pedidos de rede e a lista de permissões bate com RNF-02.
- **Prova do dono (2 min):** num pacote de teste com o menu liberado em uma página qualquer, clicar com o botão direito abre o painel com o texto lido. Se falhar, para e volta ao dono (DP-13). Sem usar LinkedIn nessa etapa.

### F02. Termos de tecnologia

Reaproveita a lista e o localizador da Candidata+ e tira o que não é de dev.

- **Pronta quando:** CA-04 passa, com casos de C, C++, C#, Go, R, Rust, Swift, .NET e Node.js, e os sinônimos JS, TS, K8s e afins.

### F03. Trava de termos e requisitos da vaga

Lista própria de assuntos proibidos, adaptada de `core/ai/sensitive-phrases.ts`. Extração de requisitos do texto da vaga.

- **Pronta quando:** CA-02 passa, inclusive com variações de acento, maiúsculas e plural, e nenhum termo legítimo de tecnologia é recusado (teste contra toda a lista de termos).
- **Revisão independente:** alguém que não escreveu a lista tenta passar termos discriminatórios por ela.

### F04. Leitor de perfil

Separa seções, experiências, períodos e nome, com perfis fictícios próprios em português e inglês.

- **Pronta quando:** CA-05 e CA-06 passam, pronomes e selos são descartados, e seções fora da lista não chegam à ficha.
- **Limite conhecido:** os modelos fictícios imitam o formato que imaginamos. CA-22 só se resolve na conta real. Este é o maior ponto de incerteza do plano.

### F05. Nota e busca

- **Pronta quando:** CA-03, CA-07 e CA-08 passam. A prova dos gêmeos varia nome, pronomes, idade escrita em "Sobre", cidade, formação, voluntariado e recomendações.
- **Revisão independente:** alguém tenta achar um caminho em que um dado pessoal mude a nota.

### F06. Armazenamento e prazo

- **Pronta quando:** salvar, atualizar e apagar funcionam; CA-15 passa, com relógio simulado; os registros têm número de versão; o aviso de limite aparece.

### F07. Painel: avisos, vagas e busca

Reaproveita o kit de tela da Candidata+.

- **Pronta quando:** CA-01 passa, a vaga é criada do início ao fim, e termo proibido aparece recusado na tela.

### F08. Painel: conversa, colar, analisar, lista e Top 10

Liga também o botão Gerar PDF, com o gerador de F10a.

- **Pronta quando:** CA-09 a CA-12, CA-25 e CA-26 passam, com Top 10 sobre 15 candidatos fictícios, e o PDF é baixado a partir da conversa.
- **Marco B:** o dono testa com o texto do próprio perfil e abre o PDF.

### F09. Leitura por clique

Aviso próprio, item de menu, atalho, função de leitura e soma de texto no mesmo candidato.

- **Pronta quando:** CA-19 passa e, numa página simulada no Chromium, a leitura traz só texto de `main`. Um teste verifica que a função não contém navegação, clique, rolagem nem temporizador.
- **Não provado aqui:** o gesto real no LinkedIn (CA-20).

### F10a. Relatório em PDF e CSV

Gerador próprio de PDF em `src/core/report` (DP-21) e CSV protegido.

- **Pronta quando:** CA-13, CA-14 e CA-27 passam. O PDF é lido de volta nos testes com `pdfjs-dist`, só como ferramenta de teste, e uma imagem da página é conferida a olho.
- **Não provado aqui:** leitor de PDF real e impressão (CA-28).

### F10b. Modelos de mensagem e privacidade

- **Pronta quando:** CA-16 passa, e os modelos só copiam, sem enviar nada.

### F11. Fechamento

- Jornadas completas no Chromium, com CA-17 em todo o caminho.
- `README.md`, `docs/PRIVACIDADE.md` (rascunho para o advogado), `docs/PROCEDENCIA.md` e `docs/ROTEIRO-DE-TESTE.md`.
- Revisão independente de segurança e de privacidade do pacote.

## 4. O que reaproveitar da Candidata+

Lido pelo marco `onda-4`, com `git -C C:/Users/fabio/Documents/projetos/opentowork show onda-4:<caminho>`. Nada é editado lá.

| Vem de lá | Linhas | Como |
|---|---:|---|
| `src/core/text/*` | 150 | Como está |
| `src/core/dictionary/` (`compile`, `find`, `protect`, `blocks`, `types`, `data/technology`, `data/tools`, `data/skills`, `data/people`, `data/curated`) | 1.100 | Como está, tirando o que não é de dev |
| `src/core/time/*` | 370 | Como está, conferindo o formato de datas do perfil |
| `src/panel/ui/` (`h`, `render`, `scope`, `theme`, `tokens.css`, `download-link`, parte de `components`) | 900 | Só o que as telas usarem |
| `src/platform/chrome/` (`api`, `runtime`, `tabs`, `scripting`, `side-panel`, `context-menus`) e `storage/chrome-area` | 250 | Como está |
| `scripts/build.mjs`, `verify-dist.mjs`, `check-secrets.mjs`, `gen-icons.mjs` | 900 | Adaptados e mais simples |
| `src/core/ai/sensitive-phrases.ts` | parte | Só como ponto de partida da trava |
| Forma dos testes (`node:test`, jsdom, Playwright com prova de rede zero) | parte | Mesma forma |

**Não entra:** lote, Easy Apply, formulários externos, respostas, aprendizado, currículo, IA, i18n, roteador de mensagens, scripts fixos em páginas, verificadores do plano e `plano.json`.

Esses arquivos dependem de contratos em `src/shared/contracts`. Só os tipos necessários vêm junto.

## 5. Regras de execução

- Cada fatia termina com `npm run check` passando: tipos, segredos, testes, build e verificação do pacote.
- Regra pura em `src/core`, sem nada do Chrome.
- Nenhum teste acessa o linkedin.com. Página simulada só em ambiente local e com dados fictícios.
- Perfis de teste são inventados e nunca copiados de pessoa real.
- Quando uma decisão precisar mudar, a fatia registra em [DECISOES.md](DECISOES.md) e atualiza a especificação junto. Se mudar escopo ou risco, volta ao dono.
- Regras RD-1 a RD-8 valem em todas as fatias, inclusive para quem receber só uma parte do trabalho.

## 6. Roteiro de teste na conta real (entregue em F11)

A versão atual está em [ROTEIRO-DE-TESTE.md](ROTEIRO-DE-TESTE.md). Abaixo fica o esboço original. Teste em página simulada não prova a página real: só o roteiro prova.

**Antes de começar**
- Instalar o pacote pela pasta, em `chrome://extensions`, modo do desenvolvedor.
- Saber o risco: as regras do LinkedIn não trazem exceção para leitura por clique. A decisão de testar na conta é do dono.

**Regra de parada:** apareceu verificação de segurança, CAPTCHA ou aviso de conta, parar na hora, não insistir, anotar o que apareceu e desligar a extensão.

**Passos**
1. Criar uma vaga de exemplo e copiar o texto de busca para a busca do LinkedIn (CA-23).
2. Usar "Abrir no LinkedIn" (CA-23).
3. Ligar a leitura por clique. Abrir o **próprio** perfil e analisar (CA-20, CA-21).
4. Comparar o que a extensão leu com o que está na tela: seções, cargos, tempo, nome (CA-22).
5. Conferir o aviso de lista cortada, abrir "ver todas as competências" e repetir o gesto (CA-22).
6. Trocar o idioma do LinkedIn para inglês e repetir (CA-22).
7. Colar o texto do próprio perfil e comparar com o resultado do clique.
8. Conferir que nenhuma mudança visual apareceu na página do LinkedIn (CA-21).
9. Gerar o PDF, abrir no leitor, clicar nos links e imprimir (CA-28).
10. Apagar tudo.

**Registro:** para cada passo, passou ou falhou, e o que apareceu (CA-24). Nada de colar texto de perfil de terceiros no chat ou em arquivo do projeto.

## 7. Riscos do plano

| Risco | Efeito | O que fazemos |
|---|---|---|
| O formato real do texto do perfil é diferente do imaginado | Parte do leitor precisa de ajuste depois do Marco B | O teste colando já no Marco B antecipa isso, com o perfil do próprio dono |
| `activeTab` ou abertura do painel pelo menu não funcionam como documentado | Muda a forma do clique | Prova logo em F01 |
| Reaproveitamento traz mais dependências do que o esperado | Mais tempo em F02 e F07 | Copiar só o usado. Se não compensar, reescrever a parte pequena |
| PDF gerado à mão ter problema em algum leitor | Ajuste em F10a | Testes com leitura de volta e conferência no Marco B |
