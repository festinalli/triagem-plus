# Privacidade da Triagem+

> **RASCUNHO, AINDA SEM REVISÃO DE ADVOGADO.** Este texto não é parecer jurídico nem a política de privacidade oficial da Triagem+. Ele está público junto com o código (D-12), mas só vale como política depois de revisado por advogado. Os pontos que pedem revisão estão na última seção.

Versão do rascunho: 0.1. Base: [especificação](ESPECIFICACAO.md) (seções 4, 9 e 10) e [decisões](DECISOES.md).

## 1. Em uma frase

A Triagem+ guarda uma ficha curta de cada candidato analisado, só no navegador de quem a usa. Não tem servidor, conta nem pedido de rede. Quem usa a extensão é quem responde pelos dados.

## 2. O que a extensão guarda

Tudo fica no armazenamento local do Chrome (`chrome.storage.local`), com número de versão.

| Registro | O que tem |
|---|---|
| Ajustes | nome e contato de quem usa (o responsável), prazo de guarda, se a leitura por clique está ligada, data e versão de cada aviso aceito, modelos de mensagem, vaga ativa |
| Vaga | título, texto colado, requisitos, datas, se está arquivada |
| Candidato (um por vaga) | nome, link do perfil, a ficha, resultado por requisito, nota, faixa, etapa, favorito, notas de quem usa, data do aviso ao candidato ("informado em"), origem (texto colado ou clique), datas de entrada e de atualização |
| Ficha | meses de experiência total; cargo atual (só se for de uma lista fechada de palavras de cargo); termos reconhecidos (tecnologias, ferramentas, idiomas e certificados) com a seção, os meses e até 3 cargos; termos livres procurados; seções lidas; sinal de leitura cortada |

**Página de resultados (D-09, D-10).** Com um gesto ou com o botão Ler esta página, a extensão lê as pessoas da página de resultados aberta. Quem mostra na lista algo que a vaga pede é guardado com nome, link, termos e pré-nota, mesmo sem ter sido escolhido um a um. Quem não mostrou nada da vaga não é guardado. O texto da página não fica guardado, nem por um instante depois da análise.

**Próximo perfil (D-11).** Cada clique no botão abre um perfil de quem já está na lista e lê esse perfil, como o botão Ler esta página. Um perfil por clique, nunca sozinho. O que fica guardado é o mesmo de uma análise comum.

**Só na memória da sessão:** o texto do perfil da última análise. Ele some quando a pessoa analisa outro perfil ou fecha o navegador. Nunca vai para o armazenamento permanente.

## 3. O que a extensão não guarda

Texto completo do perfil, foto, título profissional livre ("headline"), texto de "Sobre", local, empresa, formação, contato do candidato, pronomes, idade, gênero, raça, religião, estado civil, deficiência ou endereço. A extensão também não tenta deduzir nada disso. A conversa do painel não é guardada: é remontada a partir das vagas e dos candidatos.

## 4. O que sai do navegador

Só por clique de quem usa:

| O quê | Para onde |
|---|---|
| Relatório em PDF ou CSV, exportação em JSON | pasta de downloads |
| Texto de mensagem e de busca | área de transferência |
| Texto de busca | endereço de uma aba nova do LinkedIn, no botão "Abrir no LinkedIn" |

Nada mais sai. O pacote não faz pedido de rede, e a regra de segurança das páginas dele bloqueia conexões.

## 5. Onde e por quanto tempo

- **Onde:** no computador de quem usa, na área de dados da extensão, no perfil do Chrome.
- **Quanto tempo:** 180 dias desde a última atualização do candidato. Quem usa pode mudar o prazo de 30 a 365 dias. Nos 7 dias finais a tela avisa e deixa renovar pessoa por pessoa. Vencido o prazo, o candidato é apagado ao abrir o navegador ou o painel.
- **Antes do prazo:** "Tirar da lista" apaga a ficha e o texto em memória. Apagar uma pessoa a remove de todas as vagas. "Apagar tudo" exige digitar `APAGAR`.
- Desinstalar a extensão apaga os dados guardados nela. Não apaga arquivos já baixados.

## 6. Quem responde pelos dados

Quem usa a extensão é o responsável (controlador, art. 5º, VI da LGPD). O autor do projeto não recebe nenhum dado. A extensão não tem servidor, então não há outro lugar onde os dados estejam. Quem recebe um relatório baixado passa também a responder por ele.

Antes do primeiro uso a extensão pede o aceite de cinco avisos: responsabilidade pelos dados, risco para a conta do LinkedIn, ausência de relação com o LinkedIn, nota como apoio, e que o texto não é orientação jurídica. Pede também nome e contato do responsável, usados no aviso ao candidato.

## 7. Direitos do candidato e como atender

O candidato pode pedir acesso, correção e eliminação (LGPD, art. 18). Quem usa atende pela tela **Privacidade**:

| Pedido | Como atender na extensão |
|---|---|
| Saber o que existe | **Achar uma pessoa**, por nome ou link, em todas as vagas, e **Ver tudo o que está guardado** |
| Cópia dos dados | **Exportar a ficha (JSON)** da pessoa |
| Corrigir | **Corrigir nome e link**, valendo para todas as vagas |
| Eliminar | **Apagar em todas as vagas** |

Arquivos já baixados (PDF, CSV, JSON) e mensagens já enviadas não são alcançados pela extensão. Apagá-los é com quem os tem.

Para informar o candidato (arts. 9º e 10, § 2º), há o modelo de mensagem "Primeiro contato" com aviso de privacidade. A extensão só copia o texto; quem usa envia. Ela marca "informado em" e mostra o selo "Não informado" em quem ainda não recebeu.

Nada é decidido sozinho. A nota é apoio, a explicação de cada nota é guardada e a decisão sobre cada pessoa é de quem usa (art. 20).

## 8. O que não é protegido

- Os dados ficam **sem criptografia**. Quem tem acesso ao perfil do Chrome na máquina consegue lê-los. Computador compartilhado expõe os dados.
- Arquivos baixados e relatórios encaminhados saem do controle da extensão.
- A trava de termos proibidos (idade, gênero, raça e outros) é uma lista de palavras e não pega tudo. A responsabilidade pelo critério é de quem usa.
- Num teste às cegas anterior aos últimos ajustes, 8 de 60 frases discriminatórias passaram pela trava e 4 de 60 frases legítimas foram barradas (especificação, R-03).

## 9. Pontos para o advogado revisar

1. **Motivo legal (art. 7º).** O caminho mais provável é o legítimo interesse (art. 7º, IX), que pede avaliação e registro. A extensão só traz texto de orientação. Dado público não libera o uso (art. 7º, § 4º). Confirmar o motivo e o modelo de registro.
2. **Prazo de 180 dias (DP-09).** É uma proposta, não uma regra legal. Dizer qual prazo é adequado a recrutamento. Trocar o padrão é simples.
3. **A análise já coloca na lista (DP-19, R-11).** Quem teve nota baixa continua guardado até sair da lista ou vencer o prazo. Avaliar se isso é compatível com guardar só o necessário.
4. **Relatório enviado a terceiros (R-06).** O PDF, o CSV e o JSON têm dados pessoais e saem do controle da extensão. Hoje há aviso antes de baixar, aceite na primeira vez e notas fora por padrão. Avaliar se basta e como orientar quem recebe.
5. **Vaga afirmativa (DP-07).** A nota e os filtros não tratam desse critério, a trava recusa até "PCD" e a ajuda manda conduzir o ponto por fora da ferramenta. Avaliar se essa solução é adequada.
6. **Botão "Abrir no LinkedIn" (DP-14).** As regras do LinkedIn limitam link direto para dentro do serviço. Abrir a busca por link pode cair nisso numa leitura literal. O botão pode ser retirado sem afetar o resto.
7. **Termos do LinkedIn.** As regras não trazem exceção para leitura por clique, e numa leitura literal até colar o texto pode ser alcançado. Avaliar o risco para quem usa e o texto dos avisos (DP-20).
8. **Texto dos avisos e dos modelos de mensagem** na tela, e a lista "O que cabe a você".
9. **Publicação.** O código foi aberto no GitHub em 2026-11-07, por decisão do dono (D-12), antes desta revisão. Ainda faltam a política de privacidade revisada, a declaração de dados (R-09) e a consulta ao INPI sobre o nome (R-08). Antes da loja do Chrome, tudo isso é obrigatório.
10. **Leitura da página de resultados (D-09, DP-28).** Junta dados de mais pessoas de uma vez, inclusive de quem a recrutadora ainda não olhou. Avaliar finalidade, necessidade e o aviso a essas pessoas. Nos termos do LinkedIn, é mais perto de cópia em lote do que ler um perfil por vez.
11. **Limite entre dado sensível e termo técnico**, e discriminação indireta (R-03): revisar a lista da trava e a explicação na tela.
