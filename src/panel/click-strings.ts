// Textos da leitura por clique: o aviso de Ajustes (RF-32) e as mensagens do painel ao receber uma leitura.
// Linguagem simples. Nenhum texto aqui leva nome, link ou trecho de perfil (RNF-11).

export const CLICK_READ = {
  title: 'Leitura por clique',
  intro: 'Com a leitura ligada, você abre uma busca de pessoas ou um perfil no LinkedIn e clica em Ler esta página, aqui no painel. Também dá para usar o botão direito na página ou o atalho Alt+Shift+T. A Triagem+ analisa o que está naquela página.',
  statusOff: 'Desligada.',
  statusOn: (date: string): string => `Ligada. Aviso aceito em ${date}.`,
  turnOn: 'Ligar a leitura por clique',
  turnOff: 'Desligar a leitura por clique',
  warningTitle: 'Antes de ligar, leia este aviso',
  warning: [
    'As regras do LinkedIn citam extensões de navegador e não trazem exceção para leitura feita por clique.',
    'Por isso a sua conta pode ser limitada ou encerrada. O risco é seu.',
    'A Triagem+ lê só quando você pede, uma página por vez. Ela não rola a página, não abre outras páginas e não muda nada no site.',
    'Na página de resultados, ela lê todas as pessoas mostradas e guarda nome, link e as tecnologias citadas de quem mostra algo da vaga. Você responde por esses dados.',
    'Colar o texto do perfil continua disponível, com a leitura ligada ou não.',
  ],
  accept: 'Entendi o risco, ligar',
  cancel: 'Cancelar',
  failed: 'Não foi possível salvar. Tente de novo.',
};

/** O botão "Ler esta página" do painel (D-10). */
export const PAGE_BUTTON = {
  title: 'Ler a página aberta',
  read: 'Ler esta página',
  help: 'Com a busca de pessoas aberta no LinkedIn, espere carregar e clique em Ler esta página. A Triagem+ lê as pessoas daquela página, cerca de 10. Para ler mais, passe de página no LinkedIn e clique de novo. Num perfil aberto, ela lê o perfil inteiro.',
  firstTime: 'Na primeira vez, o Chrome pede permissão, e o aviso dele fala em "ler e alterar" dados do LinkedIn. A Triagem+ só lê, e só quando você clica. O botão direito na página e o atalho Alt+Shift+T continuam funcionando.',
  noAccess: 'O Chrome não deu a permissão, então nada foi lido. Clique de novo e escolha Permitir, ou use o botão direito na página (Analisar esta página com a Triagem+) ou o atalho Alt+Shift+T.',
  notLinkedIn: 'A aba aberta nesta janela não é uma busca de pessoas nem um perfil do LinkedIn. Nada foi lido. Abra uma delas e clique de novo.',
};

/** O botão Próximo perfil (D-11, RF-26). */
export const NEXT_PROFILE = {
  button: (left: number) => `Abrir e ler o próximo perfil (${left === 1 ? 'falta 1' : `faltam ${left}`})`,
  help: 'Abre numa aba o próximo da lista que só tem pré-nota e lê o perfil dele. É um perfil por clique. A pré-nota vira nota completa, com o que o perfil mostra, como o tempo de experiência.',
  opening: 'Abrindo o perfil numa aba. Assim que a página carregar, a Triagem+ lê. Isso leva alguns segundos.',
  noAccess: 'O Chrome não deu a permissão, então nenhum perfil foi aberto. Clique de novo e escolha Permitir.',
  notOpened: 'O perfil não terminou de abrir, então nada foi lido. Clique de novo para tentar.',
  notProfile: 'O LinkedIn não mostrou o perfil. Ele pode ter pedido o login ou uma verificação. Nada foi lido. Resolva na aba e clique de novo.',
  nothingRead: 'O perfil abriu, mas não deu para ler o texto dele. A pessoa continua com pré-nota. Clique de novo para ir ao próximo.',
  none: 'Todos da lista já têm nota completa.',
  allTried: 'Os perfis que faltam não puderam ser lidos. Clique de novo para tentar outra vez, ou abra um deles e clique em Ler esta página.',
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
  noListingRequirement: 'Esta vaga só tem requisitos que a lista de resultados não mostra, como tempo de experiência ou termo fora da lista. Cadastre uma tecnologia da lista, ou analise os perfis um a um. Nada foi guardado.',
  noPeople: 'Não achamos pessoas nesta página. Espere a página carregar, role até o fim e repita. Nada foi guardado.',
};

function people(n: number): string {
  return n === 1 ? '1 pessoa' : `${n} pessoas`;
}

/** O resumo da leitura de uma página de resultados. Só números: nenhum nome (RNF-11). */
export function listingSummary(outcome: { read: number; created: number; updated: number; kept: number; nothingSeen: number; noName: number; failed: number }): string {
  const parts = [`Li ${people(outcome.read)} nesta página: ${outcome.created} ${outcome.created === 1 ? 'nova' : 'novas'}`];
  if (outcome.updated > 0) parts.push(`${outcome.updated} ${outcome.updated === 1 ? 'atualizada' : 'atualizadas'}`);
  if (outcome.kept > 0) parts.push(`${outcome.kept} já com nota completa`);
  const sentences = [`${parts.join(', ')}.`];
  if (outcome.nothingSeen > 0) sentences.push(`${people(outcome.nothingSeen)} não ${outcome.nothingSeen === 1 ? 'mostrou' : 'mostraram'} nada do que a vaga pede e não ${outcome.nothingSeen === 1 ? 'foi guardada' : 'foram guardadas'}.`);
  if (outcome.noName > 0) sentences.push(`${people(outcome.noName)} ${outcome.noName === 1 ? 'entrou' : 'entraram'} sem o nome: confira pelo link.`);
  if (outcome.failed > 0) sentences.push(`Não coube guardar ${people(outcome.failed)}. Apague fichas antigas em Privacidade.`);
  sentences.push('Para ler mais, passe de página no LinkedIn e clique em Ler esta página de novo.');
  return sentences.join(' ');
}
