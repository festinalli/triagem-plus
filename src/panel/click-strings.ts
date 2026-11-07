// Textos da leitura por clique: o aviso de Ajustes (RF-32) e as mensagens do painel ao receber uma leitura.
// Linguagem simples. Nenhum texto aqui leva nome, link ou trecho de perfil (RNF-11).

export const CLICK_READ = {
  title: 'Leitura por clique',
  intro: 'Com a leitura ligada, você abre um perfil do LinkedIn, clica com o botão direito (ou usa o atalho Alt+Shift+T) e a Triagem+ analisa aquele perfil.',
  statusOff: 'Desligada.',
  statusOn: (date: string): string => `Ligada. Aviso aceito em ${date}.`,
  turnOn: 'Ligar a leitura por clique',
  turnOff: 'Desligar a leitura por clique',
  warningTitle: 'Antes de ligar, leia este aviso',
  warning: [
    'As regras do LinkedIn citam extensões de navegador e não trazem exceção para leitura feita por clique.',
    'Por isso a sua conta pode ser limitada ou encerrada. O risco é seu.',
    'A Triagem+ lê só quando você pede, uma página por vez. Ela não rola a página, não abre outras páginas e não muda nada no site.',
    'Colar o texto do perfil continua disponível, com a leitura ligada ou não.',
  ],
  accept: 'Entendi o risco, ligar',
  cancel: 'Cancelar',
  failed: 'Não foi possível salvar. Tente de novo.',
};

export const CLICK_MESSAGES = {
  readError: 'Não foi possível ler a página.',
  needAcceptance: 'Aceite os avisos para analisar perfis. Nada foi guardado.',
  needJob: 'Crie ou escolha uma vaga e repita o clique no perfil. Nada foi guardado.',
  needRequirements: 'A vaga ativa ainda não tem requisitos. Cadastre-os e repita o clique no perfil. Nada foi guardado.',
  emptyText: 'A página não trouxe texto do perfil. Espere o perfil carregar e repita o clique, ou cole o texto. Nada foi guardado.',
  nothingRead: 'Não reconhecemos nenhuma seção do perfil na página. Repita o clique com o perfil carregado, ou cole o texto. Nada foi guardado.',
  badUrl: 'O endereço da página não pôde ser usado. Cole o texto do perfil. Nada foi guardado.',
  noName: 'Não achamos o nome da pessoa. Escreva o nome e confirme.',
  saveFailed: 'Não foi possível analisar e guardar. Tente de novo; se continuar, feche e abra o painel.',
};
