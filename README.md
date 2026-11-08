# Triagem+

Extensão do Chrome para quem recruta pessoas desenvolvedoras. Ela ajuda a triar candidatos pela stack e pela experiência, tudo dentro do navegador. Não tem servidor, conta nem IA, e não faz nenhum pedido de rede.

**Estado atual:** versão 0.1.0, gratuita e de código aberto. Ainda não está na loja do Chrome: a instalação é pelo arquivo .zip, em modo do desenvolvedor ([veja como](#como-instalar)). O uso na página real do LinkedIn ainda está em teste.

## Aviso

- A Triagem+ **não é afiliada ao LinkedIn** nem aprovada por ele.
- **Há risco para a sua conta.** As regras do LinkedIn proíbem ferramentas e extensões que copiam informação de perfis e não trazem exceção para leitura feita por clique. Sua conta pode ser limitada, suspensa ou encerrada. A decisão de usar é sua.
- **Quem usa a extensão responde pelos dados** que guarda, nos termos da LGPD.
- Este projeto e seus textos **não são parecer jurídico**. Antes de usar dados de candidatos, procure um advogado.

## O que faz

1. Você cadastra a vaga e diz o que é obrigatório e o que é desejável.
2. A extensão monta um texto de busca (com AND e NOT) para você usar no LinkedIn.
3. Na página de resultados, você clica em **Ler esta página** no painel (ou usa o botão direito ou o atalho), e a extensão lê as pessoas daquela página com uma pré-nota. Você passa de página e repete. Na primeira vez, o Chrome pede permissão para o LinkedIn.
4. Para a nota completa, você clica em **Abrir e ler o próximo perfil**: cada clique abre um perfil da lista e lê. Também dá para abrir o perfil e usar o mesmo gesto, ou colar o texto do perfil no painel.
5. O painel mostra a nota de 0 a 100, a faixa (Forte, Parcial ou Fraco) e a explicação do que bateu e do que não foi encontrado.
6. Quem foi analisado entra na lista da vaga. A conversa mostra os 10 melhores.
7. Você filtra, anota, muda a etapa e gera um PDF (ou planilha) com a classificação e o link de cada pessoa.
8. Você copia um modelo de mensagem, com aviso de privacidade, e envia por conta própria.

## O que nunca faz

- Percorrer buscas ou perfis sozinha. Cada leitura nasce de um clique seu e lê uma única página.
- Enviar convite ou mensagem.
- Mandar dados de candidatos para fora do navegador. Só sai arquivo que você escolhe baixar e texto que você escolhe copiar.
- Usar ou tentar deduzir idade, gênero, raça, foto, religião, estado civil, deficiência ou endereço.
- Mudar a página do LinkedIn ou inserir qualquer coisa nela.
- Guardar o texto completo do perfil. Fica só uma ficha curta, apagada pelo prazo.

A nota é apoio. A decisão sobre cada pessoa é sua.

## Como instalar

Precisa do Chrome 120 ou mais novo, no computador. Não funciona no celular.

1. Baixe o arquivo `triagem-plus-0.1.0.zip` na [página de versões](https://github.com/festinalli/triagem-plus/releases/latest).
2. Descompacte o arquivo. Vai aparecer uma pasta com o `manifest.json` dentro. Guarde essa pasta num lugar fixo, porque o Chrome usa a extensão direto dela.
3. No Chrome, abra `chrome://extensions` e ligue o **Modo do desenvolvedor**, no canto de cima.
4. Clique em **Carregar sem compactação** e escolha a pasta descompactada.
5. Clique no ícone de quebra-cabeça do Chrome, fixe a Triagem+ e clique no ícone dela para abrir o painel. Leia os avisos da primeira abertura.

A leitura por clique vem desligada. Para ligar, abra **Ajustes** e aceite o aviso. Colar o texto do perfil funciona sempre.

**Para atualizar:** baixe o .zip novo, troque o conteúdo da mesma pasta e clique em recarregar na Triagem+, em `chrome://extensions`. As vagas e as listas continuam guardadas. Se carregar de outra pasta, o Chrome trata como outra extensão, e elas não aparecem.

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

Para instalar o que você construiu, siga [Como instalar](#como-instalar) a partir do passo 3 e escolha a pasta `dist/`.

## Documentos

- [Especificação](docs/ESPECIFICACAO.md): o que o produto faz e como conferir.
- [Decisões](docs/DECISOES.md): as escolhas e os motivos.
- [Plano](docs/PLANO.md): a ordem de construção.
- [Privacidade](docs/PRIVACIDADE.md): rascunho, ainda sem revisão de advogado.
- [Procedência](docs/PROCEDENCIA.md): de onde veio o código reaproveitado.
- [Roteiro de teste na conta real](docs/ROTEIRO-DE-TESTE.md): o teste do dono, de cerca de 30 minutos.

## Limites conhecidos

Os testes automáticos usam páginas simuladas e perfis inventados. Só o roteiro de teste mostra como a extensão se comporta na página real do LinkedIn. A trava de termos proibidos é uma lista de palavras e não pega tudo.

## Sugestões e problemas

Abra uma [issue](https://github.com/festinalli/triagem-plus/issues). Não cole texto de perfil nem dados de candidatos na issue: descreva o problema com dados inventados.

## Licença

[Apache-2.0](LICENSE). Copyright 2026 Fábio Alves Festinalli.
