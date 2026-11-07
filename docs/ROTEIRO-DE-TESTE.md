# Roteiro de teste na conta real

Para o dono da Triagem+. Leva cerca de 30 minutos.

## Para que serve

Os testes automáticos usam páginas simuladas e perfis inventados. Eles não provam que a extensão funciona na página real do LinkedIn. Só este roteiro prova isso (critérios CA-20 a CA-24 e CA-28 da [especificação](ESPECIFICACAO.md)).

## O risco, antes de começar

- As regras do LinkedIn não trazem exceção para leitura feita por clique. A sua conta pode ser limitada, suspensa ou encerrada.
- Esta extensão não tem relação com o LinkedIn.
- Decidir fazer este teste é uma escolha sua. Se não quiser correr o risco, não faça: colar o texto do perfil continua funcionando sem o roteiro.
- Use uma conta que você aceite arriscar.

## REGRA DE PARADA

> **Apareceu verificação de segurança, CAPTCHA ou aviso sobre a sua conta?**
> 1. **Pare na hora.** Não insista e não tente de novo.
> 2. **Anote** o que apareceu e em que passo (sem copiar texto de perfil).
> 3. **Desligue a extensão:** em `chrome://extensions`, desligue a Triagem+.

Essa parada também é um resultado do teste (CA-24). Marque o passo como **falhou** e escreva o que aconteceu.

## Regra dos dados

- Use **só o seu próprio perfil** no teste.
- Ver o perfil de outra pessoa não faz parte do roteiro. Se você fizer isso, a pessoa entra na extensão como uso real, e quem responde por esses dados é você.
- Nunca cole texto de perfil de terceiros em chat, e-mail, relatório ou arquivo do projeto.

## Antes de começar

1. Na pasta do projeto, rode `npm install` e depois `npm run build`. Isso cria a pasta `dist/`.
2. No Chrome, abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta `dist/` do projeto. Não use `dist-prova/`.
4. Clique no ícone da Triagem+ para abrir o painel. Na primeira abertura, leia os cinco avisos, escreva seu nome e um contato e aceite.
5. Em `chrome://extensions/shortcuts`, confira se o atalho **Analisar a página aberta com a Triagem+** está em Alt+Shift+T. Se estiver vazio, o Chrome não o atribuiu: defina você.
6. Tenha à mão uma vaga qualquer de tecnologia, escrita ou copiada de anúncio público seu, e o endereço do seu perfil no LinkedIn.

Marque cada passo: **Passou** ou **Falhou**. Se falhar, escreva em "Anotação" o que apareceu, sem copiar texto de perfil.

## Passos

### 1. Criar a vaga e a busca (CA-23)

- **O que fazer:** no painel, clique em **Nova vaga**. Escreva um título, cole o texto da vaga e clique em **Salvar e ver requisitos**. Confira as sugestões, ajuste e use **Usar os marcados**. Depois clique em **Montar a busca** e em **Copiar**.
- **O que deve acontecer:** a vaga aparece como **Vaga ativa**. A busca aparece com AND, OR e NOT e a mensagem "Busca copiada." Cole a busca no campo de pesquisa do LinkedIn, sem enviar nada de volta ao painel.
- **O LinkedIn aceita o texto da busca?** Ele deve rodar a busca sem dar erro de formato. Se reclamar do tamanho, teste a versão **Curta** e anote.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 2. Abrir no LinkedIn (CA-23)

- **O que fazer:** no painel, em **Montar a busca**, clique em **Abrir no LinkedIn**.
- **O que deve acontecer:** abre uma aba nova, na busca de pessoas, com o texto da busca. A Triagem+ não lê nada da página nem muda de página sozinha.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 3. Ligar a leitura por clique (CA-19, CA-20)

- **O que fazer:** abra **Ajustes** e clique em **Ligar a leitura por clique**. Leia o aviso e clique em **Entendi o risco, ligar**.
- **O que deve acontecer:** aparece "Ligada. Aviso aceito em" e a data. Antes de ligar, o botão direito num perfil não devia mostrar o item da Triagem+.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 4. Analisar o seu próprio perfil, pelo botão direito (CA-20, CA-21)

- **O que fazer:** abra o **seu** perfil no LinkedIn (endereço começando por `linkedin.com/in/`). Espere carregar. Clique com o botão direito num espaço vazio da página e escolha **Analisar este perfil com a Triagem+**.
- **O que deve acontecer:** o painel abre com **Análise: seu nome**, a nota, a faixa e o resultado de cada requisito. Você entra na lista (**Os 10 melhores**). O texto "A nota é apoio, e a decisão é sua." aparece.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 5. Analisar pelo atalho Alt+Shift+T (CA-20)

- **O que fazer:** no mesmo perfil, aperte Alt+Shift+T.
- **O que deve acontecer:** o painel mostra a análise de novo e avisa que a ficha foi atualizada, sem duplicar ("Esta pessoa já estava na lista"). Na lista continua uma pessoa só.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 6. Comparar o que foi lido com a tela (CA-22)

- **O que fazer:** compare a análise com o seu perfil aberto. Veja o nome, o cargo atual, o tempo de experiência total e as tecnologias achadas em cada requisito (use **Ver detalhe**).
- **O que deve acontecer:**
  - o nome é o seu;
  - o cargo atual bate com o cargo mais recente, ou fica "Cargo não identificado" (isso não é erro);
  - o tempo total é parecido com o que você soma de cabeça, sem contar o tempo sobreposto duas vezes;
  - cada tecnologia marcada como **Bateu** aparece de fato no seu perfil, na seção indicada em "Onde apareceu";
  - tecnologia que está no perfil e ficou como **Não encontrado no texto** é falha: anote o nome da tecnologia (o termo, não o texto do perfil).
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 7. Lista cortada e "ver todas as competências" (CA-22)

- **O que fazer:** se a análise mostrou **A leitura pode estar incompleta**, leia o que faltou. Volte ao perfil, role até o fim e clique no botão do LinkedIn que mostra todas as competências ("Mostrar todas" ou semelhante). Quando abrir a lista completa, repita o gesto (botão direito ou Alt+Shift+T). Se o aviso não apareceu, faça o mesmo assim, para ver o comportamento.
- **O que deve acontecer:** a ficha é atualizada e soma o que veio novo (as competências a mais). O aviso diminui ou some. A Triagem+ não rolou nem clicou em nada sozinha.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 8. LinkedIn em inglês (CA-22)

- **O que fazer:** nas configurações do LinkedIn, troque o idioma para inglês. Abra o seu perfil e repita o gesto. (Ao terminar, volte o idioma.)
- **O que deve acontecer:** a análise acha as seções (Experience, Skills e outras) e dá resultado parecido com o de português. Se aparecer o aviso de leitura incompleta, anote qual seção faltou.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 9. Colar o texto e comparar com o clique (CA-22)

- **O que fazer:** no seu perfil, aperte Ctrl+A e Ctrl+C. No painel, clique em **Colar um perfil** (ou em **Somar mais texto**), cole o texto, escreva o link do perfil e clique em **Analisar**.
- **O que deve acontecer:** nota, faixa e resultado por requisito iguais ou muito parecidos com os do clique. Qualquer diferença grande vale anotar: diga qual requisito mudou, sem copiar texto.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 10. A página do LinkedIn não mudou (CA-21)

- **O que fazer:** depois de usar o clique e o atalho, olhe a página do LinkedIn com atenção.
- **O que deve acontecer:** nenhum botão, selo, cor ou texto novo na página. A página não rolou, não abriu outra aba e não trocou de endereço sozinha. Nenhuma aba nova foi aberta além das que você abriu.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 11. O atalho num site qualquer não lê nada (CA-21)

- **O que fazer:** abra um site comum (uma página de notícias, por exemplo) e aperte Alt+Shift+T.
- **O que deve acontecer:** o painel avisa que a aba não é um perfil do LinkedIn e que nada foi lido. Ninguém novo entra na lista. O item do botão direito também não aparece em sites comuns.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 12. Top 10 e PDF (CA-28)

- **O que fazer:** no painel, abra **Os 10 melhores** e clique em **Gerar PDF**. Leia o aviso, escolha o que entra no arquivo e clique em **Entendi o aviso e gerar PDF** (na primeira vez). Abra o arquivo baixado num leitor de PDF de verdade (o do Chrome e outro, se tiver). Clique no link do seu perfil. Depois imprima, ou veja a visualização de impressão.
- **O que deve acontecer:** o arquivo vai para a pasta de downloads, sem passar pela tela de imprimir. Tem título da vaga, data, requisitos, posição, nome, nota, faixa e o que bateu e o que faltou. Os acentos saem certos. O link abre o perfil. Na impressão a página fica legível e nada é cortado. A frase "A nota é apoio, e a decisão é sua." aparece.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 13. Apagar uma pessoa e apagar tudo (CA-16)

- **O que fazer:**
  1. Em **Privacidade**, use **Achar uma pessoa**, procure o seu nome e clique em **Apagar em todas as vagas**, confirmando em **Apagar a pessoa de vez**.
  2. Depois, em **Seus dados neste navegador**, escreva `APAGAR` e clique em **Apagar tudo**.
- **O que deve acontecer:** depois do passo 1, "A pessoa foi apagada" e a lista da vaga fica sem você. Depois do passo 2, a Triagem+ volta à primeira abertura, sem vagas nem ajustes.
- Passou [ ]  Falhou [ ]  Anotação: ______________________

### 14. Nenhum aviso de conta (CA-24)

- **O que fazer:** responda ao final de tudo.
- **O que deve acontecer:** em nenhum momento apareceu verificação de segurança, CAPTCHA ou aviso sobre a conta. Se apareceu, você já parou (regra de parada).
- Passou [ ]  Falhou [ ]  Anotação: ______________________

Ao terminar, desligue a leitura por clique (**Ajustes**) se não for usar, e volte o idioma do LinkedIn.

## Como relatar o resultado

Escreva uma linha por passo: número, passou ou falhou e, se falhou, o que apareceu na tela.

- Diga o **que** deu errado ("a tecnologia X ficou como não encontrada"), não o texto do perfil.
- Não cole texto de perfil de terceiros em chat, e-mail, relatório ou arquivo do projeto. Do seu próprio perfil, cole só o mínimo.
- Tela de aviso do LinkedIn: anote a data, a hora, o passo e o título do aviso.
- Se algo não funcionar, diga em que passo e, se der, o que o painel mostrou. Capturas de tela só com o painel, nunca com perfil de outra pessoa.
