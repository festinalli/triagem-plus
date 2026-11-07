# Registro de decisões da Triagem+

Cada decisão tem contexto, decisão e consequência, e um identificador citado em [ESPECIFICACAO.md](ESPECIFICACAO.md). Todas de 2026-11-06.

- **Decidida pelo dono:** só o dono muda.
- **Adotada, revisável:** escolha de projeto que segue a recomendação registrada. Pode mudar sem refazer o resto.

Para rever uma decisão, acrescente a linha "Revista em AAAA-MM-DD", com o motivo, e atualize a especificação junto.

## Parte 1: regras do dono

Valem desde o início e não dependem de escopo.

| Id | Regra |
|---|---|
| RD-1 | **Sala limpa.** Nenhuma extensão concorrente, nem código, análise ou servidor dela, é lida ou usada. As funções saem desta especificação. |
| RD-2 | O repositório da Candidata+ é só leitura, pelo marco `onda-4`. Nada é editado lá. Reaproveitar código é permitido, sem copiar o que não faz falta. |
| RD-3 | Nada vai para GitHub, Chrome Web Store ou LinkedIn sem aprovação explícita do dono. Commit só quando ele pedir. |
| RD-4 | Commits, PRs, README, código e configuração levam só a autoria do dono, sem linha de coautoria nem assinatura de ferramenta. |
| RD-5 | Sem camuflagem contra detecção, sem imitar comportamento humano e sem driblar limite do LinkedIn ou plano pago. |
| RD-6 | Nenhuma chave de API no repositório ou no pacote. Senha de conta é digitada só pelo dono. |
| RD-7 | Sem logo do LinkedIn, sem selo "Open to Work" e sem nome que imite marca de terceiros. |
| RD-8 | Nenhuma nota ou filtro usa idade, gênero, raça, foto, religião, estado civil, deficiência ou endereço, nem tenta deduzir isso. A nota é apoio, e a decisão é da pessoa. |

## Parte 2: decisões do dono

### D-01. O que o produto faz

- **Status:** decidida pelo dono.
- **Contexto:** a pergunta sobre público recebeu uma descrição do produto.
- **Decisão:** a extensão filtra candidatos por stack e experiência, dá a cada dev uma classificação de match com a vaga, gera relatório com o link de cada um e lista os 10 melhores na própria extensão.
- **Consequência:** o foco é recrutamento de devs. A lista de termos é de tecnologia, o que funciona bem só com regras. Lemos "os 10+" como "os 10 de maior match" (DP-15).

### D-02. Público

- **Status:** decidida pelo dono.
- **Decisão:** recrutador de tecnologia autônomo ou consultoria pequena.
- **Consequência:** quem usa é a pessoa responsável pelos dados. Sem lista compartilhada, sem administração por empresa, sem integração com sistemas de RH. Alguém de RH pode usar individualmente, mas o produto não é pensado para isso.

### D-03. Nome: Triagem+

- **Status:** decidida pelo dono.
- **Contexto:** Recruta+ lembra Recruta Simples e Recrutei; Seleta+ lembra Selecty. Busca simples não achou Triagem+ igual.
- **Decisão:** o nome visível é Triagem+. No código, `triagem`. A pasta `extensao-recrutadores` segue com nome provisório.
- **Consequência:** consultar o INPI antes de publicar (R-08).

### D-04. Distribuição: só no Chrome do dono

- **Status:** decidida pelo dono.
- **Decisão:** instalação a partir da pasta. Sem GitHub e sem loja nesta versão. Publicar é uma decisão futura, depois de revisão jurídica.
- **Consequência:** sem atualização automática e sem exigências de loja por enquanto. Sem licença pública por ora.

### D-05. Sem IA

- **Status:** decidida pelo dono.
- **Contexto:** IA no perfil mandaria dados de candidatos a uma empresa de fora. IA só na vaga evitaria isso, mas ainda exigiria chave e rede.
- **Decisão:** só regras locais.
- **Consequência:** nota exata e explicável, sem rede nenhuma. Limite: reconhece só o que está na lista de termos ou nos requisitos da vaga.

### D-06. Entrada: um perfil por vez

- **Status:** decidida pelo dono.
- **Contexto:** foram apresentados três caminhos: um por vez; leitura em lote da página de resultados; percorrer tudo sozinha. O segundo traz pouca informação e é cópia em lote. O terceiro é o caso mais claro de proibição do LinkedIn.
- **Decisão:** um por vez, abrindo o perfil e clicando, ou colando o texto.
- **Consequência:** 10 devs custam 10 gestos. Risco menor, sem chegar a zero, porque a regra do LinkedIn não traz exceção para o clique (R-01).

### D-07. Lista de fora mantida

- **Status:** veio da recomendação inicial do dono. Mantida, porque ele não pediu nenhum dos itens ao responder às perguntas.
- **Decisão:** ficam fora o convite e a mensagem automáticos, o envio de dados a servidor e a base compartilhada.

### D-08. Lista automática depois de analisar, PDF e conversa

- **Status:** decidida pelo dono.
- **Contexto:** o dono pediu lista automática, PDF e os 10 primeiros no "chat da extensão". Foram apresentadas as leituras possíveis: automática depois de analisar, ler a página de resultados ou a extensão buscar sozinha; e, para o chat, conversa com botões, lista comum ou chat com IA.
- **Decisão:** automática depois de analisar: a pessoa analisa um perfil por vez, e a lista, a ordem e os 10 primeiros se atualizam sozinhos. O PDF sai com um clique. O painel tem forma de conversa com botões, sem IA.
- **Consequência:** D-05 e D-06 continuam valendo. RF-36 mudou, e RF-37, RF-66 a RF-69 e RF-75 são novos.

## Parte 3: decisões de projeto

### DP-01. O leitor trabalha com texto, não com a estrutura da página

- **Status:** adotada, revisável.
- **Contexto:** o HTML do LinkedIn muda sem aviso, e colar precisa funcionar de qualquer jeito.
- **Decisão:** clique e colagem entregam texto puro ao mesmo leitor.
- **Consequência:** menos código e menos quebra. Depende de os títulos de seção aparecerem no texto, o que só a conta real confirma (R-04).

### DP-02. Lista fechada de seções

- **Status:** adotada, revisável.
- **Decisão:** contam só Sobre, Experiência, Competências, Licenças e certificados, Idiomas e Projetos.
- **Consequência:** o que não está na lista não tem como mudar a nota. Isso é provado pelo teste dos gêmeos (RF-57).

### DP-03. Só os requisitos mudam a nota

- **Status:** adotada, revisável.
- **Contexto:** "Sobre" é texto livre e pode citar qualquer coisa pessoal.
- **Decisão:** a nota só procura os termos da vaga. A trava de termos impede que um assunto proibido vire requisito.
- **Consequência:** um texto pessoal no perfil é ignorado sem precisar ser identificado. Isso protege melhor do que tentar achar e apagar dados sensíveis.

### DP-04. Experiência só com mínimo

- **Status:** adotada, revisável.
- **Decisão:** "pelo menos N anos" é aceito. Teto é recusado.
- **Consequência:** evita um filtro de idade disfarçado.

### DP-05. Formação fora da nota

- **Status:** adotada, revisável.
- **Contexto:** o ano de formatura indica idade, e o nome da faculdade pode indicar origem social.
- **Decisão:** a seção é ignorada.
- **Consequência:** vaga que exige diploma precisa conferir fora da nota. O dono pode rever se isso atrapalhar.

### DP-06. Local fora da nota e da busca

- **Status:** adotada, revisável.
- **Contexto:** a regra RD-8 proíbe endereço.
- **Decisão:** cidade não é lida nem pontuada. Vaga presencial usa o filtro de local do próprio LinkedIn.
- **Consequência:** em vaga presencial, a nota não diz quem mora perto.

### DP-07. Vagas afirmativas ficam fora da ferramenta

- **Status:** adotada, revisável.
- **Contexto:** há seleções em que esses critérios são legítimos, como cotas previstas em lei. A regra RD-8 não abre exceção.
- **Decisão:** a nota e os filtros não tratam desse critério, e a ajuda explica isso. A trava recusa, inclusive, "PCD".
- **Consequência:** quem conduz uma vaga afirmativa trata esse ponto por fora. Vale levar à revisão jurídica.

### DP-08. Conta da nota

- **Status:** adotada, revisável.
- **Decisão:** a do Apêndice A da especificação. Obrigatório vale 3, desejável vale 1, com faixas Forte, Parcial e Fraco.
- **Consequência:** simples de explicar. Os pesos e cortes vão ser calibrados no teste do dono.

### DP-09. Prazo padrão de 180 dias

- **Status:** adotada, revisável.
- **Contexto:** a lei pede prazo, mas não dá um número para recrutamento. 180 dias é a nossa proposta, não uma regra legal.
- **Decisão:** 180 dias desde a última atualização, ajustável de 30 a 365, com aviso nos 7 dias finais e apagamento automático.
- **Consequência:** o advogado pode indicar outro número, e basta trocar o padrão.

### DP-10. Texto completo não é guardado

- **Status:** adotada, revisável.
- **Decisão:** fica só a ficha com termos reconhecidos, tempo e cargos. A nota é recalculada por ela.
- **Consequência:** termo novo fora da lista, adicionado depois, pede nova análise daquele perfil (RF-55).

### DP-11. Relatório em PDF e CSV

- **Status:** adotada, revisável.
- **Decisão:** PDF de verdade, baixado com um clique, e planilha CSV como segunda opção.
- **Consequência:** sem permissão de downloads. A forma de gerar o PDF está em DP-21.
- **Revista em 2026-11-06 (D-08):** antes era uma página HTML que virava PDF pelo imprimir do Chrome.

### DP-12. Sem importação

- **Status:** adotada, revisável.
- **Decisão:** exporta, mas não importa, nesta versão.
- **Consequência:** menos código e menos validação. Trocar de computador fica para depois.

### DP-13. Clique pelo menu e pelo atalho

- **Status:** adotada, revisável.
- **Contexto:** a documentação do Chrome lista os gestos que dão acesso temporário à aba, e clique dentro do painel não aparece. A alternativa seria acesso fixo ao LinkedIn, que é mais amplo.
- **Decisão:** menu do botão direito e atalho de teclado, com `activeTab`. Sem acesso fixo.
- **Consequência:** é preciso provar em Chrome real na fatia F01. Se falhar, a alternativa é pedir acesso ao site no primeiro uso, e isso volta ao dono antes de mudar.

### DP-14. "Abrir no LinkedIn" fica, e Copiar é o principal

- **Status:** adotada, revisável.
- **Contexto:** as regras do LinkedIn limitam link direto para dentro do serviço. Numa leitura literal, abrir a busca por link pode cair nisso.
- **Decisão:** o botão existe, abre por clique da pessoa, e o principal é Copiar.
- **Consequência:** dá para retirar o botão sem afetar o resto. Vale levar à revisão jurídica.

### DP-15. "Os 10+" são os 10 de maior match

- **Status:** adotada, revisável.
- **Decisão:** a conversa da vaga abre com os 10 de maior nota da lista, e "Ver todos" mostra o resto.
- **Consequência:** se o dono quis dizer outra coisa, o número vira ajuste.

### DP-16. Registro de origem do código

- **Status:** adotada, revisável.
- **Decisão:** um arquivo `docs/PROCEDENCIA.md` lista o que veio da Candidata+ e confirma a sala limpa.
- **Consequência:** se um dia publicar, a origem já está documentada.

### DP-17. Tela só em português; perfis em português e inglês

- **Status:** adotada, revisável.
- **Decisão:** a tela é só em pt-BR, com os textos reunidos em um arquivo. O leitor entende os títulos de seção nos dois idiomas.
- **Consequência:** perfis vistos com o LinkedIn em outro idioma mostram o aviso de leitura incompleta.

### DP-18. Teste na conta real é só do dono

- **Status:** adotada, revisável.
- **Decisão:** nenhum teste automático acessa o linkedin.com. Os perfis de teste são fictícios. O roteiro real é feito pelo dono, sem colar dados de terceiros em lugar nenhum fora da extensão.
- **Consequência:** a parte real só se confirma depois do roteiro.

### DP-19. A análise já coloca na lista

- **Status:** adotada, revisável.
- **Contexto:** guardar só quem interessa reduz a responsabilidade pelos dados, mas um Salvar separado contraria a lista automática de D-08.
- **Decisão:** ao terminar a análise, a pessoa entra na lista da vaga ativa, só com a ficha. A mensagem traz Tirar da lista.
- **Consequência:** 10 devs custam 10 gestos. Quem teve nota baixa continua guardado até sair ou vencer o prazo (R-11). Vale levar à revisão jurídica.
- **Revista em 2026-11-06 (D-08):** antes a análise não salvava sozinha.

### DP-20. Leitura por clique desligada até aceitar o aviso

- **Status:** adotada, revisável.
- **Contexto:** o dono escolheu a entrada "um por vez", e a descrição dizia que o clique pede aceitar um aviso uma vez.
- **Decisão:** vem desligada, liga na tela de Ajustes depois do aceite, e o item só aparece no menu com ela ligada.
- **Consequência:** a pessoa decide conscientemente assumir o risco de R-01.

### DP-21. Gerador próprio de PDF

- **Status:** adotada, revisável.
- **Contexto:** gerar PDF sem passar pela tela de imprimir exige escrever o arquivo. Uma biblioteca pesaria no pacote e iria contra RNF-12.
- **Decisão:** um gerador pequeno e próprio, só com texto, linhas e links, usando as fontes padrão do formato.
- **Consequência:** pacote leve e nenhuma biblioteca. Acentos do português saem certos. Letras de outros alfabetos saem como `?` (RF-75, R-12). Se isso atrapalhar, embutir uma fonte é o caminho, com aumento do pacote.

### DP-22. A conversa não é guardada

- **Status:** adotada, revisável.
- **Contexto:** guardar o histórico criaria uma segunda cópia dos dados, com risco de sobrar depois de apagar alguém.
- **Decisão:** a conversa é remontada dos dados da lista a cada abertura.
- **Consequência:** apagar ou vencer o prazo tira a pessoa de tudo. Mensagens antigas não voltam, mas a explicação de cada pessoa continua no detalhe.

### DP-23. A ficha só tem palavras de listas fechadas

- **Status:** adotada, revisável.
- **Contexto:** a revisão independente mostrou que o cargo, lido como texto, podia levar para a ficha frases como "Tenho 38 anos, sou casada" e nomes de empresa. Tentar reconhecer o que é cargo no texto real é frágil.
- **Decisão:** o cargo só é guardado se bater com uma lista fechada e é escrito pela lista, em forma neutra de gênero. Sem correspondência, fica vazio.
- **Consequência:** nenhum texto do perfil tem caminho até a ficha, além do nome informado. Cargos fora da lista aparecem vazios na tela e no relatório, o que o teste real vai medir.

### DP-24. Só conta tempo de entrada com sinal de trabalho

- **Status:** adotada, revisável.
- **Contexto:** uma entrada "Maternidade" com período somava tempo e subia a nota. Nenhuma lista de pausas cobre tudo.
- **Decisão:** o tempo só conta se a entrada tiver palavra de cargo, tipo de contrato ou termo de tecnologia. Rótulos de pausa na linha inteira do cargo descartam a entrada.
- **Consequência:** um emprego real sem nenhum desses sinais não soma tempo. É o erro menos grave: a tela mostra "confira no perfil" e a pessoa decide.

### DP-25. Termo livre não é procurado em Sobre

- **Status:** adotada, revisável.
- **Contexto:** Sobre é o texto mais pessoal do perfil, e um termo como "Campinas" ou o nome de uma faculdade passava pela trava e mudava a nota.
- **Decisão:** em Sobre, só contam termos da lista de tecnologia. Termo livre é procurado em Experiência, Competências, Certificados e Projetos.
- **Consequência:** tecnologia nova citada só em Sobre aparece como "não encontrado no texto".
