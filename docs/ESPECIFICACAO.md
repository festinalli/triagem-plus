# Especificação da Triagem+

Versão 0.6, de 2026-11-07, com o botão Próximo perfil (D-11). A versão 0.5 trouxe o botão Ler esta página no painel (D-10), e a 0.4 trouxe a leitura da página de resultados (D-09). Diz o que a Triagem+ faz, o que não faz e como conferir que faz certo. A versão 0.2 traz a decisão D-08: lista automática depois de analisar, PDF e painel em forma de conversa. As decisões e os motivos estão em [DECISOES.md](DECISOES.md), e a ordem de construção em [PLANO.md](PLANO.md).

Este documento não é parecer jurídico.

## 1. O produto em uma página

A Triagem+ é uma extensão do Google Chrome para quem recruta pessoas desenvolvedoras. Ela abre num painel ao lado da página, em forma de conversa com botões, e guarda tudo no próprio navegador. Não há servidor, conta nem IA.

**O que a pessoa faz com ela:**

1. Cadastra a vaga e diz o que é obrigatório e o que é desejável: stack, anos de experiência, idioma, certificado.
2. Recebe um texto de busca com E, OU e NÃO, para usar no próprio LinkedIn.
3. Na página de resultados, usa o gesto e a extensão lê as pessoas daquela página, com pré-nota. Para a nota completa, abre o perfil e usa o gesto, ou cola o texto no painel.
4. Vê na conversa a nota de match e a explicação: o que bateu, o que faltou e o que não foi encontrado.
5. A lista se monta sozinha: quem foi analisado entra, a ordem se ajusta e a conversa mostra os **10 com maior match** da vaga. Quem não interessar sai com um clique.
6. Filtra por stack e experiência, anota, muda a etapa e, com um clique, gera um **PDF com a classificação e o link de cada dev**.
7. Copia um modelo de mensagem e envia ela mesma, com o aviso de privacidade ao candidato.

**O que ela nunca faz:** percorrer buscas ou perfis sozinha, enviar convite ou mensagem, mandar dados de candidatos para fora do navegador, usar ou tentar deduzir idade, gênero, raça, foto, religião, estado civil, deficiência ou endereço.

**Para quem é:** recrutador de tecnologia autônomo ou consultoria pequena. Quem usa responde pelos dados que guarda.

**Onde roda nesta primeira versão:** no Chrome do computador, instalada a partir da pasta, em modo do desenvolvedor. O código é aberto no GitHub, e cada versão sai como um .zip (D-12). Sem loja.

## 2. Convenções

- **DEVE** e **NÃO DEVE** são obrigatórios. **PODE** é opcional.
- `RF-nn` é requisito de função. `RNF-nn` é requisito de qualidade. `CA-nn` é critério de aceite. `R-nn` é risco. `D-nn` e `DP-nn` são decisões, explicadas em [DECISOES.md](DECISOES.md).
- Nenhum identificador é reaproveitado. Requisito retirado continua na lista, com o motivo.
- Textos da tela em português do Brasil. Nomes dentro do código em inglês.

## 3. Princípios

- **P-1. Tudo no navegador.** Nenhum dado de candidato sai da máquina, a não ser por um arquivo que a pessoa escolha baixar.
- **P-2. Uma página por gesto.** Cada leitura nasce de um gesto da pessoa e lê uma única página, uma única vez. Pode ser um perfil ou a página de resultados de pessoas (D-09).
- **P-3. A pessoa decide.** A nota é apoio. Nada reprova, descarta ou esconde alguém sem a pessoa pedir, e o que foi filtrado continua contado na tela.
- **P-4. Explicável.** Toda nota mostra de onde veio. Não há conta que a pessoa não consiga conferir.
- **P-5. Só conta o que é da vaga.** Somente os requisitos da vaga mudam a nota. Texto fora deles não tem como influenciar.
- **P-6. Guardar o mínimo.** O texto completo do perfil não é salvo. Fica uma ficha curta, com prazo para sumir.
- **P-7. Sem disfarce.** Nada de imitar comportamento humano, driblar limite, plano pago ou verificação do LinkedIn.

## 4. O que a lei e o LinkedIn exigem deste produto

Texto conferido em 2026-11-06. **Revisão por advogado é recomendada antes de qualquer publicação.**

### 4.1 Lei de dados (LGPD)

A pessoa que usa a extensão é a responsável pelos dados ("controlador", art. 5º, VI). A exceção de uso particular (art. 4º, I) não cobre trabalho de recrutamento. Dado público não libera o uso (art. 7º, § 4º: ficam resguardados os direitos do titular e os princípios da lei).

| O que a lei pede | O que a extensão oferece | O que continua com quem usa |
|---|---|---|
| Motivo legal para usar os dados (art. 7º). O caminho mais provável é o legítimo interesse, inciso IX, que pede avaliação e registro | Texto de orientação na tela de Privacidade | Avaliar e registrar o motivo, com orientação jurídica |
| Informação ao candidato (arts. 9º e 10, § 2º) | Modelo de mensagem com aviso, marca "informado em" e selo "não informado" | Enviar o aviso de fato |
| Guardar só pelo necessário e apagar depois (arts. 15 e 16) | Prazo com apagamento automático | Escolher o prazo adequado |
| Direitos do candidato: acesso, correção, eliminação (art. 18) | Achar a pessoa, ver e exportar a ficha, corrigir, apagar | Responder ao pedido |
| Revisão de decisão só automatizada (art. 20) | Nada é decidido sozinho; a explicação é guardada | Revisar de verdade |
| Não discriminar (art. 6º, IX; art. 11 para dados sensíveis; Lei 9.029/95, art. 1º, sobre acesso ao trabalho) | Trava de termos e lista fechada de seções (seção 6.2 e 6.5) | Não discriminar por fora da ferramenta |

### 4.2 Regras do LinkedIn

Contrato do usuário em vigor desde 2025-11-03, seção 8.2, e a página de ajuda sobre software proibido:

- Proíbem usar ferramentas, com menção a extensões de navegador, para copiar ou raspar perfis. **Não encontramos exceção para leitura feita por clique.** Ler um perfil por clique reduz o risco, mas não o elimina.
- Proíbem copiar e usar informação do serviço sem autorização de quem é dono dela. Numa leitura literal, isso alcança também a pessoa que cola o texto.
- Proíbem automação, sobrepor ou alterar a aparência do site e criar link direto para dentro do serviço fora dos casos permitidos.
- Preveem restringir, suspender ou encerrar a conta.
- Conta gratuita com sinais de uso comercial, como recrutar, tem limite mensal de buscas. A busca gratuita também limita os operadores E/OU/NÃO, sem publicar o número. Sales Navigator aceita até 15 operadores por busca. Recruiter e Recruiter Lite não têm limite de operadores.

Consequências no produto: nada é inserido na página do LinkedIn (RNF-03), a leitura por clique é opcional e tem aviso próprio (RF-32), colar sempre funciona (RF-30), e o aviso aparece antes do primeiro uso (RF-01).

## 5. Fluxo de uso

**FL-1. Primeira abertura.** A pessoa lê os avisos, informa nome e contato de responsável, confere o prazo e aceita.

**FL-2. Vaga.** Cola o texto da vaga. A extensão sugere requisitos, a pessoa corrige e marca obrigatório ou desejável. Termos proibidos são recusados com explicação.

**FL-3. Busca.** Copia o texto de busca, ou abre a busca no LinkedIn. A partir daí, quem navega é a pessoa.

**FL-4. Colar.** No painel, cola o texto do perfil e o link, confere o nome e clica em Analisar.

**FL-5. Clicar.** Com o perfil aberto, usa o botão direito do mouse ("Analisar este perfil com a Triagem+") ou o atalho de teclado. O painel abre com o resultado.

**FL-6. Decidir.** A conversa mostra a nota e a explicação, e a pessoa já entra na lista da vaga. Se a leitura veio incompleta, abre "ver tudo" no próprio site e repete o gesto para somar o texto ao mesmo candidato. Se não interessar, clica em Tirar da lista.

**FL-7. Top 10 e PDF.** A conversa mostra os 10 melhores atualizados. A pessoa filtra, anota, muda a etapa e clica em Gerar PDF.

**FL-8. Contato.** Copia a mensagem com o aviso, envia pelo LinkedIn ou por onde preferir e marca "informado em".

**FL-9. Pedido do candidato.** Procura a pessoa por nome ou link, vê e exporta a ficha, corrige ou apaga.

## 6. Requisitos de função

### 6.1 Avisos e primeira abertura

| Id | Requisito |
|---|---|
| RF-01 | Antes do primeiro uso, a extensão **DEVE** mostrar: que quem usa é responsável pelos dados; o risco para a conta do LinkedIn; que não tem relação com o LinkedIn; que a nota é só apoio; que não é orientação jurídica. O uso só começa com aceite. Guarda a data e a versão do aceite. |
| RF-02 | **DEVE** pedir nome e contato de responsável, usados no aviso ao candidato. Ficam só no navegador e podem ser alterados. |
| RF-03 | **DEVE** mostrar o prazo de guarda padrão (RF-90) e deixar mudar. |

### 6.2 Vaga e requisitos

| Id | Requisito |
|---|---|
| RF-10 | Criar, editar, arquivar e apagar vagas, com título e texto. Título com termo da trava é recusado, com o motivo. |
| RF-11 | Ao receber o texto da vaga, **DEVE** sugerir requisitos com base na lista de termos de tecnologia. Palavras do bloco ("requisitos", "diferenciais") indicam obrigatório ou desejável. A pessoa confere e edita tudo. |
| RF-12 | Tipos de requisito: termo de stack ou ferramenta, com ou sem anos mínimos; anos mínimos de experiência no total; idioma; certificado; palavra de cargo ou senioridade. Cada um é obrigatório ou desejável. Limite de 30 por vaga. Termo fora da lista é aceito como texto livre, mas nunca é procurado em Sobre (DP-25). |
| RF-13 | **Trava de termos:** **DEVE** recusar requisito, termo de busca ou termo excluído que trate de idade ou faixa etária, gênero ou sexo, orientação sexual, raça, cor ou etnia, aparência ou foto, religião, política ou sindicato, estado civil, filhos, deficiência ou saúde, nacionalidade ou origem, endereço, bairro ou distância. A recusa explica o motivo. Compara palavra inteira, sem acento e sem diferença de maiúsculas ("qualidade" não dispara "idade"). **É uma lista de palavras e não pega tudo:** a tela diz isso, e a responsabilidade pelo critério continua de quem usa. |
| RF-14 | **NÃO DEVE** existir teto de experiência. "No máximo N anos" é recusado, porque funciona como filtro de idade. |
| RF-15 | Ao ler o texto da vaga, a frase que caia na trava (RF-13) fica de fora dos requisitos, e a tela avisa o que foi ignorado e por quê. O resto da vaga continua valendo. |
| RF-16 | Vagas afirmativas não usam a nota nem os filtros para esse critério. A tela de ajuda explica que esse tratamento fica fora da ferramenta (DP-07). |

### 6.3 Busca

| Id | Requisito |
|---|---|
| RF-20 | **DEVE** montar o texto de busca a partir dos requisitos: obrigatórios ligados por `AND`, termos excluídos por `NOT`, operadores em maiúsculas, expressões entre aspas. `OR` só nas duas formas de gênero de um cargo. Sinônimos valem na nota, não no texto (DP-30). |
| RF-21 | **DEVE** oferecer versão completa (todos os obrigatórios) e versão curta (até 3 obrigatórios), mostrando quantos operadores cada uma usa e o limite conhecido por plano. Quando o LinkedIn não publica o número, a tela diz isso. A tela começa na curta e explica por quê; a escolha da pessoa vale (DP-26). |
| RF-22 | "Copiar" é o botão principal. "Abrir no LinkedIn" abre a busca de pessoas numa aba nova, por clique. |
| RF-23 | A extensão **NÃO DEVE** rodar a busca, rolar, clicar nem trocar de página. Ela só abre um perfil por clique da pessoa no botão Próximo perfil (RF-26), nunca sozinha. A página de resultados só é lida por clique da pessoa, no gesto ou no botão do painel (RF-38, RF-25). |
| RF-24 | A tela **DEVE** explicar em uma frase o limite mensal de buscas da conta gratuita, sem oferecer atalho para escapar dele. |
| RF-25 | **Botão Ler esta página:** com a leitura ligada (RF-32), o painel mostra o botão na tela da busca e na lista dos 10 primeiros. O clique lê a aba aberta da janela do painel, uma vez, se ela for a busca de pessoas ou um perfil do LinkedIn, e segue o mesmo caminho do gesto. Na primeira vez, o Chrome pede a permissão opcional de `https://www.linkedin.com/*` (D-10). Sem a permissão, nada é lido, e o gesto continua funcionando. Com a leitura desligada, a tela da busca mostra ali mesmo o jeito de ligar, com o aviso. Depois de ler uma página de resultados, o relatório já vem marcado com todos os lidos. |
| RF-26 | **Botão Próximo perfil (D-11):** com a leitura ligada e alguém da vaga só com pré-nota, o resultado e a lista mostram **Abrir e ler o próximo perfil**, com quantos faltam. Cada clique abre um perfil, o primeiro da lista que só tem pré-nota, numa aba própria, que é criada na primeira vez e reaproveitada depois. A extensão espera o Chrome terminar de carregar a página (até 30 segundos) e o texto parar de mudar (até 15 segundos), e então lê como RF-25. A leitura soma à mesma pessoa, mesmo se o link mudar. Só abre `https://www.linkedin.com/in/<nome>/`. Se a página aberta não for um perfil, como o login ou uma verificação, nada é lido. Quem abriu e não pôde ser lido fica para o fim, enquanto o painel estiver aberto. |

### 6.4 Entrada do perfil

| Id | Requisito |
|---|---|
| RF-30 | **Colar:** caixa para o texto do perfil, campo do link e campo do nome, pré-preenchido com a primeira linha e sempre editável. Funciona com qualquer configuração. Link precisa ser `https`. Se não for de perfil do LinkedIn, a tela avisa e deixa seguir. |
| RF-31 | **Clicar:** item no menu do botão direito, só em páginas de perfil e de resultados de pessoas do LinkedIn, e atalho de teclado. Cada gesto lê o texto da área principal da aba atual e o endereço dela, uma vez. |
| RF-32 | A leitura por clique vem **desligada**. Ligar exige aceitar um aviso próprio, que repete o risco de RF-01 e diz que a regra do LinkedIn não traz exceção para o clique. Dá para desligar quando quiser, e o item some do menu. Quando o texto do aviso muda de sentido, o aceite antigo deixa de valer. |
| RF-33 | A leitura **NÃO DEVE** navegar, rolar, clicar, expandir "ver tudo", abrir outra página, ler outra aba, repetir sozinha nem fazer pedido de rede. Sem espera nem temporizador. A única exceção é o botão Próximo perfil (RF-26): ele abre um perfil por clique e espera a página carregar, sem rolar nem clicar nela. |
| RF-34 | Repetir o gesto, ou colar mais texto, em outra página do mesmo perfil soma o texto ao mesmo candidato. O perfil é reconhecido pelo trecho `/in/<nome>/` do link. O texto fica só na memória da sessão, até analisar outro perfil ou fechar o navegador. Depois disso, nova análise do mesmo perfil atualiza a ficha, ficando o maior tempo de cada termo. Link de perfil do LinkedIn é guardado na forma curta, https://www.linkedin.com/in/<nome>/. |
| RF-35 | Se a leitura trouxer poucas seções, ou houver sinal de lista cortada ("Exibir todas", "Show all"), **DEVE** dizer o que faltou e como completar: rolar a página, abrir "ver tudo" ou colar. Nunca faz isso sozinha. |
| RF-36 | **A lista se monta sozinha (D-08).** Ao terminar a análise, a pessoa entra na lista da vaga ativa, só com a ficha. A mensagem do resultado traz **Tirar da lista**, que apaga a ficha e o texto em memória. Sem aceite dos avisos ou sem vaga ativa, nada é guardado. |
| RF-37 | Toda análise usa a **vaga ativa**, sempre visível no topo da conversa. Sem vaga ativa, a conversa pede para criar ou escolher uma. |
| RF-38 | **Página de resultados:** o gesto na busca de pessoas do LinkedIn lê as pessoas daquela página, uma vez, com link e nome de cada uma, até 40. Nada é rolado, clicado ou aberto. Da página só saem nome, link, título e trecho; local, conexões em comum e botões ficam de fora, e a empresa escrita depois de um cargo também (D-09, DP-29). |
| RF-39 | **Pré-nota:** quem só foi visto na lista tem número e selo "Pré-nota", sem faixa, com o que não apareceu como "Não visto na lista" (DP-27). Só termos da lista contam, e palavra de cargo só no título. O termo com anos mínimos que aparece conta inteiro, com "tempo a conferir", porque a lista não mostra tempo. Quem não mostrou nada da vaga não é guardado, e a tela conta quantos (DP-28). Ler de novo soma sem duplicar. Quem já tem nota completa não muda. Analisar o perfil depois troca a pré-nota pela nota completa, na mesma pessoa. |

### 6.5 Leitura do perfil

| Id | Requisito |
|---|---|
| RF-40 | Clique e colagem **DEVEM** passar pelo mesmo leitor de texto. Ele reconhece títulos de seção em português e inglês, inclusive em maiúsculas, com dois-pontos ou com contagem ("Experiência (5)"). |
| RF-41 | **Lista fechada de seções que contam:** Sobre, Experiência, Competências, Licenças e certificados, Idiomas, Projetos. Qualquer outra seção conhecida encerra a leitura do trecho e é ignorada: Formação acadêmica, Trabalho voluntário, Recomendações, Interesses, Causas, Atividade, Publicações, Prêmios, Organizações, Cursos. |
| RF-42 | De cada experiência tira o período e os termos citados. O cargo só entra na ficha se for de uma **lista fechada de palavras de cargo**, escrito pela lista e sem o texto original. Sem correspondência, fica vazio. Local, empresa, tipo de contrato e texto livre **NÃO** entram na ficha (DP-23). |
| RF-43 | Experiência total é a união dos períodos, sem contar duas vezes o tempo sobreposto. Anos por termo são a união dos períodos das experiências que citam aquele termo. Só conta tempo de entrada com sinal de trabalho: palavra de cargo, tipo de contrato ou termo de tecnologia. Pausa na carreira nunca conta (DP-24). |
| RF-44 | **NÃO DEVE** extrair, guardar nem tentar deduzir idade, gênero, raça, foto, religião, estado civil, deficiência ou endereço. Pronomes junto do nome ("Ele/Dele", "She/Her"), selos, grau de conexão, número de seguidores, cidade e selo de disponibilidade são descartados. Ano de formatura nunca é lido. O nome, inclusive quando vem do título da aba, passa pelo mesmo limpador; sem nome válido, a conversa pede. |
| RF-45 | O texto completo nunca vai para o armazenamento permanente. Fica só na memória da sessão, pelo tempo de RF-34, e o que permanece é a ficha (seção 9). |

### 6.6 Comparação e nota

| Id | Requisito |
|---|---|
| RF-50 | Cada requisito recebe um resultado: **bateu**, **em parte** ou **não encontrado no texto**. A tela nunca diz "não tem", porque o perfil pode só não citar. |
| RF-51 | Cada resultado traz a prova: seção, termo como aparece na lista e, em experiência, cargo e tempo. Sem trecho de texto livre. |
| RF-52 | A nota de 0 a 100 segue o Apêndice A. |
| RF-53 | Faixas: **Forte**, **Parcial** e **Fraco** (Apêndice A). |
| RF-54 | Ordem: nota; depois obrigatórios atendidos; depois quem entrou primeiro. **NUNCA** por nome. |
| RF-55 | Se os requisitos mudarem, a nota é recalculada pela ficha. Termo novo que não estava na ficha aparece como "precisa analisar de novo" e não pesa contra a pessoa até isso acontecer. |
| RF-56 | "A nota é apoio, e a decisão é sua" **DEVE** aparecer na mensagem do Top 10, no detalhe e no relatório. |
| RF-57 | **Prova dos gêmeos:** dois perfis com o mesmo conteúdo nas seções que contam **DEVEM** ter nota idêntica, mudando nome, pronomes, idade, cidade, formação, voluntariado, recomendações ou qualquer outra seção. |

### 6.7 Conversa, lista e Top 10

| Id | Requisito |
|---|---|
| RF-60 | Filtros: termo de stack, experiência mínima, faixa, etapa, favorito e "atende a todos os obrigatórios". A tela mostra quantos ficaram de fora. Filtro não apaga. O filtro de stack compara com os termos da ficha, de forma exata. Filtros são limpos ao trocar de vaga. |
| RF-61 | A conversa da vaga abre com a mensagem dos **10 de maior nota** da lista. "Ver todos" abre o resto, com os filtros. |
| RF-62 | O detalhe traz a explicação completa, etapa, favorito, notas, "informado em", link e apagar. |
| RF-63 | Etapas fixas: Novo, Em análise, Contatado, Entrevista, Proposta, Encerrado. |
| RF-64 | Mesmo perfil na mesma vaga atualiza a ficha, com aviso, sem duplicar. O nome corrigido pela pessoa é preservado. Com duas janelas abertas, só o painel da janela do gesto consome a leitura, e leitura com mais de 2 minutos é descartada. |
| RF-65 | Notas são texto livre e nunca entram na nota. Se tiverem termo da trava, a tela alerta sem bloquear. |
| RF-66 | **Forma de conversa, sem IA.** O painel mostra tudo como mensagens em sequência: resultado de cada análise, Top 10, avisos e confirmações. Cada mensagem traz botões para o próximo passo. **Não há caixa de pergunta livre**, e todo texto vem de regras locais. As entradas de dados, como colar perfil e cadastrar vaga, aparecem como formulários dentro da conversa. |
| RF-67 | **Atualização automática.** Depois de cada análise, sem outro gesto, a conversa mostra os 10 primeiros atualizados e diz a posição de quem entrou ("entrou em 3º"), ou que ficou fora dos 10. |
| RF-68 | A mensagem do Top 10 mostra posição, nome, link clicável, nota, faixa, etapa e cargo atual, o total da lista e os botões **Gerar PDF** e **Ver todos**. Com menos de 10 na lista, mostra os que houver. |
| RF-69 | A conversa **não é guardada**. É remontada a partir das vagas e dos candidatos, de modo que apagar alguém, ou o prazo vencer, a tira de tudo. A explicação de cada pessoa continua disponível pelo detalhe. |

### 6.8 Relatório

| Id | Requisito |
|---|---|
| RF-70 | Por vaga, com um clique, gera um **PDF** de verdade, baixado direto, sem passar pela tela de imprimir. O padrão são os 10 melhores, com opção de todos os que estão filtrados. **Planilha CSV** é a segunda opção, com o mesmo conteúdo. Relatório filtrado diz "N de M candidatos" e quais filtros valem. |
| RF-71 | Conteúdo: título da vaga, data, requisitos (com os anos mínimos de cada termo, como "C# · 5 anos") e, por dev: posição, nome, link clicável, nota, faixa, o que bateu, o que faltou, experiência total, cargo atual e etapa. Notas só entram se a pessoa marcar. O CSV traz os mesmos dados de cabeçalho (título, data, requisitos, frase e aviso) antes da tabela. PDF e CSV explicam que "Faltou" significa não encontrado no texto. |
| RF-72 | O relatório **NÃO DEVE** ter foto, código executável nem recurso externo. **DEVE** trazer a frase de RF-56 e a data de geração. O link de cada dev é clicável no PDF, só `https`. |
| RF-73 | **DEVE** avisar: o arquivo tem dados pessoais, sai do controle da extensão e quem o recebe também passa a responder por eles. Na primeira vez, pede aceite. Depois, o aviso fica visível junto do botão, sem clique a mais. |
| RF-74 | Toda célula do CSV que comece com `=`, `+`, `-`, `@`, tabulação ou retorno **DEVE** ser neutralizada, para a planilha não executar fórmula vinda do texto de terceiros. |
| RF-75 | O PDF **DEVE** escrever certo todos os acentos do português. Letra fora do alfabeto suportado, como nomes em japonês ou árabe, sai como `?`, e a tela avisa para conferir pelo link (DP-21). |

### 6.9 Modelos de mensagem

| Id | Requisito |
|---|---|
| RF-80 | Três modelos editáveis: primeiro contato com aviso de privacidade, retorno e encerramento. Marcadores: `{nome}`, `{vaga}`, `{responsavel}`, `{contato}`. Os textos padrão não prometem o que o produto não garante: dizem que os dados podem constar em relatório gerado por quem recruta e que o prazo é renovável enquanto o processo durar. |
| RF-81 | O único gesto é **Copiar**. A extensão **NÃO DEVE** enviar, preencher caixa de mensagem nem abrir conversa. |
| RF-82 | Depois de copiar, a tela oferece marcar "informado em". Quem foi salvo e não foi informado mostra um selo na lista. |

### 6.10 Privacidade e apagamento

| Id | Requisito |
|---|---|
| RF-90 | Prazo de guarda padrão de 180 dias desde a última atualização, ajustável de 30 a 365. Nos 7 dias finais, a tela avisa e deixa renovar pessoa por pessoa. Vencido o prazo, o candidato é apagado ao abrir o navegador ou o painel. Reduzir o prazo mostra quantas pessoas serão apagadas e pede confirmação. |
| RF-91 | Achar pessoa por nome ou link em todas as vagas, ver tudo o que está guardado, corrigir, exportar a ficha dela e apagar. A correção de nome e link vale para todos os registros da mesma pessoa. A ficha exportada leva só o título da vaga. |
| RF-92 | Exportar tudo em JSON, com aviso igual ao de RF-73. |
| RF-93 | Apagar tudo exige digitar `APAGAR`. A tela explica que desinstalar a extensão também apaga os dados guardados nela, mas não os arquivos já baixados. Painéis abertos em outra janela recarregam, e salvar registro já apagado não o traz de volta. |
| RF-94 | Tela de Privacidade em linguagem simples: o que fica guardado, onde, por quanto tempo, o que não é protegido (RNF-05) e a lista do que cabe a quem usa (seção 4.1). |

### 6.11 Fora de escopo

| Item | Motivo |
|---|---|
| Percorrer páginas de busca ou perfis sozinha | Decisão do dono (D-06). É o caso mais direto de proibição do LinkedIn e o que mais pesa na LGPD |
| Convite ou mensagem automáticos | D-07. Proibido pelo LinkedIn e de risco direto à conta |
| Enviar dados de candidatos a servidor, sincronizar | D-07 e P-1 |
| Base compartilhada entre recrutadores | D-07. Exige servidor e muda quem responde pelos dados |
| IA de qualquer tipo | D-05 |
| Usar formação acadêmica na nota | DP-05 |
| Usar localização na nota ou na busca | DP-06 |
| Importar dados de volta | DP-12 |
| Outros idiomas de tela | DP-17 |
| Caixa de perguntas livres na conversa | D-05 e D-08 |
| Publicar na loja do Chrome | D-04 e D-12 |

## 7. Requisitos de qualidade

| Id | Requisito |
|---|---|
| RNF-01 | **Nenhuma rede.** A extensão não faz pedido de rede. A regra de segurança das páginas dela bloqueia qualquer conexão, e um teste prova zero pedidos. Abas abertas pela pessoa são do navegador, não da extensão. |
| RNF-02 | **Permissões mínimas:** `storage`, `sidePanel`, `activeTab`, `scripting` e `contextMenus`. A única permissão de site é opcional, `https://www.linkedin.com/*`, pedida pelo Chrome no primeiro clique em Ler esta página (D-10). **Sem** acesso fixo a sites, sem script fixo em páginas e sem `tabs`, `cookies`, `history`, `downloads`, `alarms` ou `webRequest`. O teste compara a lista exata. |
| RNF-03 | **Nada na página do LinkedIn:** a extensão não insere botão, selo nem estilo, e não muda a aparência do site. Só lê o texto quando recebe o gesto. Também não usa cookies nem endereços internos do site. |
| RNF-04 | **Texto de terceiros é só texto.** Nunca é tratado como código nem HTML, no painel e no relatório. Link só `https`. |
| RNF-05 | Os dados ficam no armazenamento local do Chrome, **sem criptografia**. Quem tem acesso ao perfil do Chrome na máquina consegue lê-los. A tela de Privacidade diz isso. |
| RNF-06 | Nenhuma chave, senha ou segredo no repositório e no pacote. Verificação automática. |
| RNF-07 | Análise de um perfil em menos de 200 ms em máquina comum. Pacote com menos de 1 MB. Aviso ao chegar perto do limite do armazenamento (10 MB). |
| RNF-08 | Painel usável só com teclado, com contraste adequado e seguindo o tema claro ou escuro do Chrome. |
| RNF-09 | Tela em linguagem simples. Erro diz o que aconteceu e o que fazer. |
| RNF-10 | Sem logo do LinkedIn, sem o selo "Open to Work" e sem nome que imite marca. "LinkedIn" só aparece para descrever compatibilidade. O selo de disponibilidade de um perfil nunca é sinal de nota. |
| RNF-11 | Nenhum registro de console ou de erro com nome, link ou texto de candidato. |
| RNF-12 | Nenhuma biblioteca dentro do pacote final. Ferramentas só de construção e teste. |

## 8. Como é feita (para quem constrói)

- **Partes:** `src/core` (regras puras, sem nada do Chrome: texto, termos, tempo, vaga, leitor, nota, busca, relatório, prazo, trava), `src/platform` (o que fala com o Chrome), `src/background` (menu, atalho, leitura), `src/panel` (telas). TypeScript, esbuild, testes com `node:test`, jsdom e Playwright, como na Candidata+.
- **Por que texto, e não a estrutura da página:** o leitor recebe texto puro, então clique e colagem usam o mesmo caminho, a mudança de HTML do LinkedIn afeta pouco e tudo é testável sem navegador.
- **Caminho do clique:** gesto no menu ou atalho → permissão temporária só daquela aba (`activeTab`) → uma função curta lê o texto de `main`, o endereço e o título → o resultado vai para a memória de sessão (`storage.session`) → o painel abre, lê e limpa. A permissão termina quando a pessoa navega.
- **Caminho do botão (D-10):** clique em Ler esta página → pedido da permissão opcional do LinkedIn, feito no próprio clique → a aba aberta da janela do painel → a mesma função curta de leitura → a análise, sem passar pela memória de sessão. Sem a permissão, nada é lido.
- **Caminho do Próximo perfil (D-11):** clique → pedido da permissão opcional, feito no próprio clique → o próximo com pré-nota → a aba dos perfis abre o link limpo → espera carregar → confere que é um perfil → espera o texto parar de mudar → a mesma função curta de leitura → a análise da mesma pessoa. Um perfil por clique.
- **Por que não um botão dentro do painel:** a documentação do Chrome lista os gestos que dão essa permissão (ícone, menu do botão direito, atalho, barra de endereços), e clique dentro do painel não está na lista (DP-13).
- **Apagamento pelo prazo** roda ao abrir o navegador e ao abrir o painel, sem precisar da permissão `alarms`.
- **PDF:** um gerador pequeno e próprio em `src/core/report`, com as fontes padrão do formato, quebra de linha, paginação e links clicáveis. Nenhuma biblioteca entra no pacote (RNF-12, DP-21).
- **Conversa:** função pura que recebe vagas, candidatos e a última análise e devolve a lista de mensagens. Nada é gravado (RF-69, DP-22).

## 9. Dados guardados

Tudo em `chrome.storage.local`, com número de versão. Nada mais é guardado. A única exceção é o texto da última análise, só na memória da sessão, que some ao fechar o navegador (RF-34).

| Registro | Campos |
|---|---|
| Ajustes | nome e contato de responsável, prazo, leitura por clique ligada, data e versão de cada aceite, modelos de mensagem, vaga ativa |
| Vaga | id, título, texto, requisitos, datas, arquivada |
| Candidato (um por vaga) | id, vaga, nome, link, ficha, resultado por requisito, nota, faixa, etapa, favorito, notas da pessoa, informado em, origem (colado ou clique), datas de entrada e de atualização |
| Ficha | meses de experiência total; cargo atual; lista de termos reconhecidos, inclusive idiomas e certificados, com seção, meses e até 3 cargos; termos livres procurados; seções lidas; sinal de leitura cortada |

**Nunca guardado:** texto completo do perfil, foto, título profissional livre ("headline"), texto de "Sobre", local, empresa, formação, contato do candidato, pronomes, idade.

## 10. O que sai do navegador

| O quê | Para onde | Quando |
|---|---|---|
| Relatório em PDF ou CSV, exportação JSON | Pasta de downloads da pessoa | Só por clique, com o aviso |
| Texto de mensagem e de busca | Área de transferência | Só por clique em Copiar |
| Texto de busca | Endereço da aba do LinkedIn | Só por clique em "Abrir no LinkedIn" |

Nada mais sai.

## 11. Critérios de aceite

Tipo de prova: **A** é teste automático de regra, **P** é teste do painel no Chromium com página simulada, **M** é o roteiro manual do dono na conta real.

| Id | Critério | Prova |
|---|---|---|
| CA-01 | Sem aceite, nenhuma tela de trabalho abre | P |
| CA-02 | "Até 35 anos", "boa aparência", "mulheres", "solteiro", "PCD", "mora perto", "no máximo 5 anos" são recusados; "Qualidade de software", "Java", "core banking", "C++" passam | A |
| CA-03 | Texto de busca correto para uma lista de requisitos conhecida, nas versões completa e curta | A |
| CA-04 | Termos ambíguos: "Go", "R", "C", "C++", "C#", ".NET", "Node.js" só contam nos casos certos ("go to market" não conta como Go) | A |
| CA-05 | O leitor separa as seções em perfis fictícios em português e inglês, nos formatos com um cargo e com vários cargos na mesma empresa | A |
| CA-06 | Tempo sobreposto não é contado duas vezes | A |
| CA-07 | A prova dos gêmeos (RF-57) passa com todas as variações listadas | A |
| CA-08 | O exemplo do Apêndice A dá nota 80 e faixa Parcial | A |
| CA-09 | Depois de Tirar da lista, nada da pessoa fica guardado. Depois de analisar outro perfil, o texto anterior não existe em lugar nenhum | P |
| CA-10 | A ficha salva não tem o texto completo nem nenhum campo da lista "nunca guardado" | P |
| CA-11 | Top 10 em ordem na conversa, empate pelas regras de RF-54, contagem do total certa | P |
| CA-12 | Filtro mostra quantos ficaram de fora e não apaga ninguém | P |
| CA-13 | O PDF, lido de volta, traz nomes, notas e links `https` clicáveis, não tem código executável nem recurso externo, e texto malicioso no nome sai como texto | A |
| CA-14 | Célula de CSV iniciada com `=`, `+`, `-` ou `@` sai neutralizada | A |
| CA-15 | Candidato vencido some; aviso aparece nos 7 dias finais; renovar funciona | A e P |
| CA-16 | "Apagar tudo" deixa o armazenamento vazio, e apagar uma pessoa a remove de todas as vagas | P |
| CA-17 | Zero pedidos de rede em toda a jornada simulada | P |
| CA-18 | Lista de permissões do pacote é exatamente a de RNF-02, sem script fixo em páginas | A |
| CA-19 | Com a leitura por clique desligada, o item do menu não existe | P |
| CA-20 | O gesto real abre o painel com o resultado do perfil real | **M** |
| CA-21 | Nenhuma mudança visual na página do LinkedIn e nenhuma navegação sozinha | **M** |
| CA-22 | O leitor funciona com o texto real do perfil em português e inglês, com lista cortada e com "ver tudo" | **M** |
| CA-23 | O texto de busca é aceito na busca real, e "Abrir no LinkedIn" chega à busca de pessoas | **M** |
| CA-24 | Nenhum aviso de conta aparece durante o roteiro; se aparecer, o teste para e o fato é registrado | **M** |
| CA-25 | Depois de uma análise, sem outro clique, a pessoa está na lista, o Top 10 está atualizado e a posição dela aparece | P |
| CA-26 | A conversa não grava nada: ao fechar e reabrir, só aparece o que está na lista, e apagar alguém o tira de todas as mensagens | P |
| CA-27 | Acentos do português saem certos no PDF, e nome em outro alfabeto gera `?` com aviso na tela | A |
| CA-28 | O PDF baixado abre em leitor real, os links funcionam e a página fica legível na tela e impressa | **M** |
| CA-29 | Numa página simulada, a leitura traz uma entrada por pessoa, sem barra, lateral, anúncio ou conexão em comum, e o painel enche a lista com pré-nota, sem guardar texto da página. A prova dos gêmeos vale: nome, cidade e conexões não mudam a ficha | A |
| CA-30 | Na página real de resultados, o gesto ou o botão Ler esta página acha as pessoas que estão na tela, com o link certo, e passar de página soma à lista sem repetir | **M** |
| CA-31 | No LinkedIn real, cada clique em Abrir e ler o próximo perfil abre um perfil só, e a pessoa passa de pré-nota a nota completa, com o tempo de experiência, sem duplicar | **M** |

**Teste em página simulada não prova a página real.** Os testes A e P mostram que as regras e as telas funcionam com perfis fictícios escritos por nós. Só os critérios M, na conta real, mostram que funciona de verdade no LinkedIn. Eles ficam no roteiro entregue na fatia F11.

## 12. Riscos

| Id | Risco | O que reduz | O que sobra |
|---|---|---|---|
| R-01 | Conta do recrutador sofrer limitação | Sem automação, uma página por gesto, nada inserido na página, clique desligado por padrão, colar como alternativa | **Continua existindo**, e as regras não trazem exceção para o clique. Ler a página de resultados é mais perto de cópia em lote do que ler um perfil por vez (D-09) |
| R-02 | Responsabilidade pela LGPD | Ficha mínima, prazo, avisos, ferramentas de atendimento | É de quem usa. Falta revisão jurídica antes de publicar |
| R-03 | Discriminação indireta | Lista fechada, trava, sem teto de experiência, prova dos gêmeos, termo livre fora de Sobre | A trava é lista de palavras e deixa passar frases que não previu: num teste às cegas, 8 de 60 frases discriminatórias passaram e 4 de 60 frases legítimas foram barradas, antes dos últimos ajustes. A pessoa ainda pode criar critério ruim com termo técnico. Quem escreve menos no perfil tira nota menor, e a tela diz "não encontrado no texto" para deixar isso visível |
| R-04 | Texto real diferente do que imaginamos, ou página carregada pela metade | Leitor por texto, aviso de leitura incompleta, colar como alternativa | Só a conta real prova. Os modelos de teste são fictícios |
| R-05 | Dados no computador sem criptografia | Aviso, prazo, apagar tudo | Máquina compartilhada expõe os dados |
| R-06 | Relatório encaminhado a terceiros | Aviso antes de baixar, notas fora por padrão | Fora do controle da extensão |
| R-07 | Erro de termo ou sinônimo faltando | Lista de sinônimos com testes, contexto para termos ambíguos, explicação visível | Pode faltar tecnologia nova; a pessoa inclui como texto livre |
| R-08 | Nome em conflito com marca existente | Busca simples sem resultado igual | Falta consulta ao INPI antes de publicar |
| R-09 | Regras da loja do Chrome, se um dia publicar | Propósito único, nenhuma coleta externa | Exige política de privacidade e declaração de dados antes de publicar |
| R-10 | Limite de buscas da conta gratuita | Aviso e versão curta da busca | A extensão não contorna o limite |
| R-11 | Fica guardado mais gente do que com o Salvar separado, inclusive quem teve nota baixa | Tirar da lista com um clique, prazo, ficha mínima | Vale levar à revisão jurídica (DP-19) |
| R-12 | Nomes em alfabeto não suportado no PDF | Aviso na tela e link ao lado | Nome aparece com `?` no arquivo |

## 13. Glossário

- **Match:** o quanto o perfil atende aos requisitos da vaga, de 0 a 100.
- **Conversa:** a forma como o painel mostra as coisas, em mensagens com botões. Não é chat com IA.
- **Ficha:** o resumo curto que fica guardado no lugar do perfil.
- **Gesto:** um clique ou atalho feito pela pessoa.
- **Busca booleana:** texto de busca com E (AND), OU (OR) e NÃO (NOT).
- **Trava de termos:** a lista de assuntos que a extensão recusa como critério.

## Apêndice A: a conta da nota

**Peso:** obrigatório vale 3, desejável vale 1.

**Crédito de cada requisito:**

| Situação | Crédito |
|---|---|
| Termo em Experiência, Competências, Certificados ou Idiomas | 1 |
| Termo só em Sobre ou Projetos ("citado, sem prova de uso") | 0,5 |
| Termo não encontrado | 0 |
| Termo com anos mínimos N, e A anos medidos | A ÷ N, no máximo 1 |
| Termo com anos mínimos, encontrado, mas sem tempo medível | 0,5, com o aviso "não deu para medir o tempo" |
| Experiência total mínima N, e A anos medidos | A ÷ N, no máximo 1 |
| Experiência total sem datas legíveis | 0, com o aviso "confira no perfil" |

**Nota** = 100 × (soma de peso × crédito) ÷ (soma dos pesos), arredondada.

**Requisito pendente** ("precisa analisar de novo", RF-55) não entra na conta. Com requisito obrigatório pendente, a faixa não pode ser Forte. Sem nenhum requisito avaliado, não há nota, e a tela diz isso.

**Requisito atendido** é o que tem crédito 1.

**Faixas:**
- **Forte:** nota 75 ou mais e todos os obrigatórios atendidos.
- **Fraco:** nota abaixo de 50.
- **Parcial:** o resto. Inclui nota alta com algum obrigatório pendente.

**Exemplo (CA-08).** Vaga: Java com 5 anos (obrigatório), Spring (obrigatório), AWS (desejável), Inglês (desejável). Perfil: Java em experiências que somam 4 anos, Spring em Competências, nada de AWS, Inglês em Idiomas.

| Requisito | Peso | Crédito | Pontos |
|---|---|---|---|
| Java, 5 anos | 3 | 0,8 | 2,4 |
| Spring | 3 | 1 | 3 |
| AWS | 1 | 0 | 0 |
| Inglês | 1 | 1 | 1 |
| **Total** | **8** | | **6,4** |

Nota 100 × 6,4 ÷ 8 = **80**. Faixa **Parcial**, porque Java não foi atendido por inteiro.

## Apêndice B: fontes

- [Contrato do usuário do LinkedIn](https://www.linkedin.com/legal/user-agreement), em vigor desde 2025-11-03, seções 3.4, 8.2 e 9
- [LinkedIn: software e extensões proibidos](https://www.linkedin.com/help/linkedin/answer/a1341387)
- [LinkedIn: limite de uso comercial](https://www.linkedin.com/help/linkedin/answer/a564226)
- [LinkedIn: limites de operadores booleanos](https://www.linkedin.com/help/linkedin/answer/a524411/boolean-query-limitations?lang=en)
- [LGPD, Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [ANPD: guia sobre legítimo interesse](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_hipoteses_legais_tratamento_de_dados_pessoais_legitimo_interesse)
- [Lei 9.029/1995](https://www.planalto.gov.br/ccivil_03/leis/l9029.htm)
- [Chrome: permissão temporária de aba](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chrome Web Store: atualização de regras de 2026](https://developer.chrome.com/blog/cws-policy-updates-2026)
