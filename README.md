# Triagem+

Extensão do Chrome para quem recruta pessoas desenvolvedoras. Ela ajuda a triar candidatos pela stack e pela experiência, tudo dentro do navegador. Não tem servidor, conta nem IA, e não faz nenhum pedido de rede.

**Estado atual:** versão 0.1.0. A instalação é só pela pasta, em modo do desenvolvedor. Não está na loja do Chrome nem no GitHub.

## Aviso

- A Triagem+ **não é afiliada ao LinkedIn** nem aprovada por ele.
- **Há risco para a sua conta.** As regras do LinkedIn proíbem ferramentas e extensões que copiam informação de perfis e não trazem exceção para leitura feita por clique. Sua conta pode ser limitada, suspensa ou encerrada. A decisão de usar é sua.
- **Quem usa a extensão responde pelos dados** que guarda, nos termos da LGPD.
- Este projeto e seus textos **não são parecer jurídico**. Antes de usar dados de candidatos, procure um advogado.

## O que faz

1. Você cadastra a vaga e diz o que é obrigatório e o que é desejável.
2. A extensão monta um texto de busca (com AND, OR e NOT) para você usar no LinkedIn.
3. Você abre um perfil e clica para analisar, ou cola o texto do perfil no painel.
4. O painel mostra a nota de 0 a 100, a faixa (Forte, Parcial ou Fraco) e a explicação do que bateu e do que não foi encontrado.
5. Quem foi analisado entra na lista da vaga. A conversa mostra os 10 melhores.
6. Você filtra, anota, muda a etapa e gera um PDF (ou planilha) com a classificação e o link de cada pessoa.
7. Você copia um modelo de mensagem, com aviso de privacidade, e envia por conta própria.

## O que nunca faz

- Percorrer buscas ou perfis sozinha. Cada leitura nasce de um clique seu e lê uma única página.
- Enviar convite ou mensagem.
- Mandar dados de candidatos para fora do navegador. Só sai arquivo que você escolhe baixar e texto que você escolhe copiar.
- Usar ou tentar deduzir idade, gênero, raça, foto, religião, estado civil, deficiência ou endereço.
- Mudar a página do LinkedIn ou inserir qualquer coisa nela.
- Guardar o texto completo do perfil. Fica só uma ficha curta, apagada pelo prazo.

A nota é apoio. A decisão sobre cada pessoa é sua.

## Como construir e testar

Precisa de Node 22.18 ou mais novo.

```
npm install
npm run build          # gera dist/ (produção)
npm run build:proof    # gera dist-prova/ (com o menu de leitura, só para a prova do clique)
npm test               # testes de regra e de tela, sem navegador
npm run check          # tipos, segredos, testes, build e verificação do pacote
npm run test:e2e       # abre um Chromium com a extensão e prova zero pedidos de rede
```

Se o Chromium padrão do Playwright for bloqueado pelo sistema, o teste tenta os outros que estiverem instalados. Se nenhum abrir, aponte `TRIAGEM_CHROMIUM_PATH` para um Chromium que aceite `--load-extension`.

## Como instalar pela pasta

1. Rode `npm run build`.
2. No Chrome, abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta `dist/`.
4. Clique no ícone da Triagem+ para abrir o painel e leia os avisos da primeira abertura.

A leitura por clique vem desligada. Para ligar, abra **Ajustes** e aceite o aviso. Colar o texto do perfil funciona sempre.

## Documentos

- [Especificação](docs/ESPECIFICACAO.md): o que o produto faz e como conferir.
- [Decisões](docs/DECISOES.md): as escolhas e os motivos.
- [Plano](docs/PLANO.md): a ordem de construção.
- [Privacidade](docs/PRIVACIDADE.md): rascunho para revisão de advogado.
- [Procedência](docs/PROCEDENCIA.md): de onde veio o código reaproveitado.
- [Roteiro de teste na conta real](docs/ROTEIRO-DE-TESTE.md): o teste do dono, de cerca de 30 minutos.

## Limites conhecidos

Os testes automáticos usam páginas simuladas e perfis inventados. Só o roteiro de teste mostra como a extensão se comporta na página real do LinkedIn. A trava de termos proibidos é uma lista de palavras e não pega tudo.
