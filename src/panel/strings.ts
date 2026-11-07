// Todos os textos da tela, em português simples e em um só lugar (sem tradução, DP-17). Nenhum texto de candidato passa por aqui.
import type { ActionId, NoticeId } from '../core/conversation/build.ts';
import type { Band, ProfileSection, RequirementKind, RequirementStatus, ResultNote, Stage } from '../core/model.ts';

export const APP_NAME = 'Triagem+';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const NOTICES: Readonly<Record<NoticeId, { readonly title: string; readonly text: string }>> = {
  responsibility: {
    title: 'Você responde pelos dados',
    text: 'Os dados de candidatos que você guarda aqui são de sua responsabilidade, nos termos da LGPD. Guarde só o que precisa e avise cada pessoa.',
  },
  account_risk: {
    title: 'Risco para a sua conta do LinkedIn',
    text: 'O LinkedIn proíbe ferramentas e extensões que copiam informação de perfis. As regras dele não trazem exceção para leitura feita por clique. Usar a Triagem+ pode levar o LinkedIn a limitar, suspender ou encerrar a sua conta. O risco é seu.',
  },
  no_relation: {
    title: 'Sem relação com o LinkedIn',
    text: 'A Triagem+ é independente. Não tem ligação com o LinkedIn nem aprovação dele.',
  },
  score_support: {
    title: 'A nota é só apoio',
    text: 'A nota ajuda a organizar a lista, mas a decisão sobre cada pessoa é sempre sua.',
  },
  not_legal: {
    title: 'Isto não é orientação jurídica',
    text: 'Estes avisos explicam o essencial e não trocam a opinião de um advogado. Antes de usar dados de candidatos, procure orientação jurídica.',
  },
};

export const FIRST_RUN = {
  noticesTitle: 'Antes de começar',
  noticesIntro: 'Leia os cinco avisos abaixo. Sem aceitar, a Triagem+ não abre.',
  acceptTitle: 'Seus dados e o prazo',
  acceptIntro: 'O nome e o contato entram no aviso que você envia ao candidato. Ficam só neste navegador e podem ser mudados depois.',
  acceptButton: 'Li os avisos e aceito',
};

export const FIELDS = {
  name: 'Seu nome',
  contact: 'Seu contato (e-mail ou telefone)',
  contactHelp: 'Quem recebe o aviso usa este contato para falar com você.',
  retention: 'Guardar candidatos por quantos dias',
  retentionHelp: (def: number, min: number, max: number): string =>
    `O padrão é ${def} dias, contados da última atualização da pessoa. Vale de ${min} a ${max}. Depois do prazo, a pessoa é apagada sozinha ao abrir o navegador ou o painel.`,
};

export const ERRORS = {
  name: 'Escreva o seu nome.',
  contact: 'Escreva um contato, como e-mail ou telefone.',
  retention: (min: number, max: number): string => `O prazo precisa ser um número inteiro de ${min} a ${max} dias.`,
  jobTitle: 'Escreva o título da vaga.',
  saveFailed: 'Não foi possível guardar. Tente de novo; se continuar, feche e abra o painel.',
  jobGone: 'Esta vaga não existe mais.',
  nothingChecked: 'Marque pelo menos uma sugestão.',
  excludedEmpty: 'Escreva o termo que quer excluir.',
  excludedDuplicate: 'Este termo já está na lista.',
  excludedLong: 'Escreva só o termo, sem a frase inteira.',
  yearsTotal: 'Escreva os anos mínimos, um número inteiro de 1 a 40.',
};

export const SHELL = {
  settings: 'Ajustes',
  privacy: 'Privacidade',
  activeJob: 'Vaga ativa',
  noActiveJob: 'Nenhuma vaga ativa',
  switchJob: 'Trocar',
  createJob: 'Criar vaga',
  messages: 'Conversa',
  working: 'Carregando…',
  loadFailed: 'Não foi possível abrir os dados guardados neste navegador. Feche e abra o painel de novo.',
};

export const ACTIONS: Readonly<Record<ActionId, string>> = {
  create_job: 'Nova vaga',
  show_jobs: 'Ver vagas',
  activate_job: 'Usar esta vaga',
  edit_job: 'Editar vaga',
  archive_job: 'Arquivar',
  unarchive_job: 'Tirar do arquivo',
  delete_job: 'Apagar',
  confirm_archive_job: 'Arquivar a vaga',
  confirm_delete_job: 'Apagar a vaga e os candidatos',
  cancel: 'Cancelar',
  open_requirements: 'Requisitos',
  open_search: 'Montar a busca',
  open_help: 'Vaga afirmativa?',
  go_home: 'Voltar ao início',
  open_paste: 'Colar um perfil',
  remove_from_list: 'Tirar da lista',
  add_more_text: 'Somar mais texto',
  show_detail: 'Ver detalhe',
  show_all: 'Ver todos',
  open_report: 'Gerar PDF',
  delete_candidate: 'Apagar a ficha',
  confirm_delete_candidate: 'Apagar a ficha de vez',
  renew_candidate: 'Renovar o prazo',
  open_privacy: 'Privacidade e seus dados',
  back_privacy: 'Voltar para a Privacidade',
  delete_person: 'Apagar em todas as vagas',
  confirm_delete_person: 'Apagar a pessoa de vez',
};

export const HOME = {
  noJobTitle: 'Vamos começar pela vaga',
  noJobText: 'Você ainda não tem uma vaga ativa. Crie uma vaga para cadastrar os requisitos e montar a busca.',
  noJobArchived: (n: number): string => `Você tem ${plural(n, 'vaga arquivada', 'vagas arquivadas')}. Dá para voltar a usar uma delas.`,
  summaryTitle: 'Vaga ativa',
  summaryCounts: (required: number, preferred: number, excluded: number): string =>
    `${plural(required, 'obrigatório', 'obrigatórios')}, ${plural(preferred, 'desejável', 'desejáveis')} e ${plural(excluded, 'termo excluído', 'termos excluídos')}.`,
  nextRequirements: 'Próximo passo: cadastrar os requisitos, colando o texto da vaga.',
  nextSearch: 'Próximo passo: colar o perfil de uma pessoa para analisar. Quem for analisado entra na lista sozinho.',
};

export const JOBS = {
  listTitle: 'Suas vagas',
  listEmpty: 'Nenhuma vaga ainda.',
  requirementCount: (n: number): string => plural(n, 'requisito', 'requisitos'),
  active: 'Ativa',
  archived: 'Arquivada',
  listLabel: 'Lista de vagas',
  formCreateTitle: 'Nova vaga',
  formEditTitle: 'Editar vaga',
  titleLabel: 'Título da vaga',
  titleHelp: 'Por exemplo: Pessoa desenvolvedora back-end sênior.',
  textLabel: 'Texto da vaga',
  textHelp: 'Cole aqui a descrição da vaga. A Triagem+ sugere os requisitos a partir dela. Não cole dados de candidatos.',
  saveCreate: 'Salvar e ver requisitos',
  save: 'Salvar',
  confirmDeleteTitle: 'Apagar a vaga?',
  confirmDeleteText: (title: string): string => `Apagar a vaga “${title}” leva junto todos os candidatos dela. Isso não pode ser desfeito.`,
  confirmArchiveTitle: 'Arquivar a vaga?',
  confirmArchiveText: (title: string): string => `A vaga “${title}” sai da lista de vagas em uso, mas continua guardada. Você pode tirá-la do arquivo depois.`,
};

export const REQUIREMENTS = {
  title: 'Requisitos',
  forJob: (title: string): string => `Vaga: ${title}`,
  suggestionsTitle: 'Sugestões a partir do texto da vaga',
  suggestionsIntro: 'Confira cada sugestão. Você pode corrigir o nome, trocar entre obrigatório e desejável e mudar os anos mínimos.',
  suggestionsUse: 'Usar os marcados',
  suggestionsDiscard: 'Descartar sugestões',
  suggestionsAgain: 'Sugerir de novo a partir do texto',
  noText: 'Esta vaga não tem texto. Use “Editar vaga” para colar o texto, ou adicione os requisitos à mão.',
  manualNeeded: 'Não encontramos requisitos no texto. Adicione à mão, logo abaixo.',
  truncated: 'O texto da vaga é longo e só o começo foi lido. Pode faltar requisito: confira e complete à mão.',
  ignoredTitle: 'Frases que ficaram de fora',
  ignoredIntro: 'Estas frases tratam de assuntos que não podem ser critério. O resto da vaga continua valendo.',
  ignoredReason: 'Motivo',
  use: 'Usar',
  nameLabel: 'Nome do requisito',
  yearsLabel: 'Anos mínimos',
  yearsHelp: 'Só o mínimo. Não existe teto de experiência.',
  importance: 'Importância',
  required: 'Obrigatório',
  preferred: 'Desejável',
  savedTitle: 'Requisitos da vaga',
  savedEmpty: 'Nenhum requisito ainda.',
  savedLabel: 'Requisitos cadastrados',
  remove: 'Remover',
  removeNamed: (label: string): string => `Remover ${label}`,
  yearsNamed: (label: string): string => `Anos mínimos de ${label}`,
  importanceNamed: (label: string): string => `Importância de ${label}`,
  yearsSuffix: (n: number): string => (n === 1 ? 'mínimo 1 ano' : `mínimo ${n} anos`),
  addTitle: 'Adicionar à mão',
  addKind: 'Tipo',
  addLabel: 'Requisito',
  addLabelHelp: 'Escreva só o termo, como “Java” ou “inglês avançado”.',
  addYearsHelp: 'Para tecnologia é opcional. Para experiência total é obrigatório.',
  addButton: 'Adicionar requisito',
  excludedTitle: 'Termos para excluir da busca',
  excludedHelp: 'Entram na busca com NOT. Passam pela mesma trava dos requisitos.',
  excludedLabel: 'Termo a excluir',
  excludedButton: 'Excluir este termo',
  excludedEmpty: 'Nenhum termo excluído.',
  excludedListLabel: 'Termos excluídos',
  excludedRemove: (term: string): string => `Tirar ${term} da lista de excluídos`,
  guardLimits: 'A trava é uma lista de palavras e não pega tudo. O critério continua sendo sua responsabilidade.',
  helpLink: 'Vaga afirmativa? Veja como funciona',
  refusedPrefix: 'Não foi aceito:',
};

export const KIND_LABELS: Readonly<Record<RequirementKind, string>> = {
  term: 'Tecnologia ou ferramenta',
  total_experience: 'Anos de experiência no total',
  language: 'Idioma',
  certification: 'Certificado',
  title_word: 'Cargo ou senioridade',
};

export const SEARCH = {
  title: 'Busca para o LinkedIn',
  intro: 'A Triagem+ só monta o texto. Quem busca e navega é você.',
  versionLabel: 'Versão da busca',
  full: 'Completa',
  short: 'Curta (até 3 obrigatórios)',
  textLabel: 'Texto da busca',
  operators: (n: number): string => `Esta versão usa ${plural(n, 'operador', 'operadores')} (AND, OR e NOT).`,
  limitsTitle: 'Limites conhecidos por plano',
  limitFree: 'Conta gratuita: o LinkedIn limita os operadores, mas não publica o número.',
  limitSales: (n: number): string => `Sales Navigator: até ${n} operadores por busca.`,
  limitRecruiter: 'Recruiter e Recruiter Lite: sem limite de operadores.',
  overSales: (n: number): string => `Esta versão passa de ${n} operadores. No Sales Navigator, use a versão curta.`,
  monthlyLimit: 'Contas gratuitas que o LinkedIn vê como uso comercial, como recrutar, têm um limite mensal de buscas. A Triagem+ não tem como contornar esse limite.',
  copy: 'Copiar',
  copied: 'Busca copiada.',
  copyManual: 'Não foi possível copiar sozinho. O texto abaixo está selecionado: use Ctrl+C.',
  open: 'Abrir no LinkedIn',
  openHelp: 'Abre a busca de pessoas em uma aba nova, só com o texto da busca. Nada é lido da página.',
  empty: 'Ainda não há obrigatórios de tecnologia, idioma, certificado ou cargo para montar a busca.',
  refusedTitle: 'Ficaram de fora da busca',
  refusedTerm: (term: string, reason: string): string => `“${term}”: ${reason}`,
};

export const SETTINGS = {
  title: 'Ajustes',
  retentionConfirmTitle: 'Este prazo apaga pessoas agora',
  retentionConfirmText: (count: number, days: number): string =>
    `Com o prazo de ${days} dias, ${count === 1 ? '1 pessoa já passou do prazo e será apagada' : `${count} pessoas já passaram do prazo e serão apagadas`} agora, em todas as vagas. Isso não dá para desfazer.`,
  retentionConfirmButton: (count: number): string => (count === 1 ? 'Apagar 1 pessoa e mudar o prazo' : `Apagar ${count} pessoas e mudar o prazo`),
  retentionBack: 'Voltar sem mudar',
  save: 'Salvar ajustes',
  saved: 'Ajustes salvos.',
  accepted: (date: string): string => `Avisos aceitos em ${date}.`,
};

export const HELP = {
  title: 'Vagas afirmativas',
  paragraphs: [
    'Algumas vagas são abertas só para um grupo de pessoas, como as vagas afirmativas. Esse tipo de seleção é legítimo.',
    'Mesmo assim, esse tratamento fica fora da Triagem+: a nota e os filtros não usam esse critério, e a trava não deixa cadastrá-lo como requisito.',
    'Conduza esse ponto por fora da ferramenta, por exemplo ao escrever o anúncio e ao conversar com a pessoa candidata. Vale conversar com um advogado.',
  ],
};

// ---------------------------------------------------------------------------------------------------------
// Triagem: colar o perfil, resultado, Top 10, lista, detalhe e relatório (RF-30 a RF-37, RF-50 a RF-56, RF-60 a RF-75).
// Nome, link e cargo de candidatos nunca entram aqui: chegam de fora e são colocados na tela como texto.

export const FOOTER_PHRASE = 'A nota é apoio, e a decisão é sua.';

export const BAND_NAMES: Readonly<Record<Band, string>> = { strong: 'Forte', partial: 'Parcial', weak: 'Fraco' };

export const STAGE_NAMES: Readonly<Record<Stage, string>> = {
  new: 'Novo',
  reviewing: 'Em análise',
  contacted: 'Contatado',
  interview: 'Entrevista',
  offer: 'Proposta',
  closed: 'Encerrado',
};

export const SECTION_NAMES: Readonly<Record<ProfileSection, string>> = {
  about: 'Sobre',
  experience: 'Experiência',
  skills: 'Competências',
  certifications: 'Licenças e certificados',
  languages: 'Idiomas',
  projects: 'Projetos',
};

export const STATUS_NAMES: Readonly<Record<RequirementStatus, string>> = {
  met: 'Bateu',
  partial: 'Em parte',
  not_found: 'Não encontrado no texto',
  needs_reanalysis: 'Precisa analisar de novo',
};

export const NOTE_TEXTS: Readonly<Record<ResultNote, string>> = {
  mentioned_only: 'O termo só aparece em Sobre ou Projetos. Está citado, mas sem prova de uso.',
  time_not_measurable: 'O termo aparece, mas não deu para medir o tempo. Confira no perfil.',
  check_profile: 'Não achamos datas legíveis no perfil. Confira o tempo de experiência por lá.',
};

export const PASTE = {
  title: 'Colar o perfil',
  addingTitle: 'Somar mais texto',
  intro: 'Cole o texto do perfil. A Triagem+ analisa pela vaga ativa e já coloca a pessoa na lista.',
  addingIntro: (name: string): string => `O texto novo é somado ao que já existe de ${name}. Use depois de rolar a página, abrir “ver tudo” ou ler outra parte do perfil.`,
  textLabel: 'Texto do perfil',
  textHelp: 'Abra o perfil, selecione a página (Ctrl+A), copie (Ctrl+C) e cole aqui. O texto fica só na memória do navegador, até você analisar outro perfil ou fechar o navegador.',
  urlLabel: 'Link do perfil',
  urlHelp: 'Precisa começar com https://. Por exemplo: https://www.linkedin.com/in/nome/',
  urlNotProfile: 'Este link não parece ser de um perfil do LinkedIn. Você pode seguir, mas se colar esta pessoa de novo ela entra como outra.',
  nameLabel: 'Nome',
  nameHelp: 'Já vem preenchido com o nome lido no texto. Pode corrigir.',
  submit: 'Analisar',
  submitAdd: 'Somar e analisar de novo',
  working: 'Analisando…',
  blockedNoJobTitle: 'Falta a vaga',
  blockedNoJob: 'Para analisar um perfil, crie uma vaga ou escolha uma que já existe. A análise sempre usa a vaga ativa.',
  blockedNoReqTitle: 'Falta cadastrar os requisitos',
  blockedNoReq: 'A vaga ativa ainda não tem requisitos, e sem requisitos não há nota. Cadastre os requisitos e volte para colar o perfil.',
};

export const PASTE_ERRORS = {
  text: 'Cole o texto do perfil.',
  url: 'Escreva o link do perfil.',
  urlHttps: 'O link precisa começar com https://.',
  name: 'Escreva o nome da pessoa. Não achamos o nome no texto.',
  nothingRead: 'Não reconhecemos nenhuma seção do perfil neste texto, como Experiência ou Competências. Cole o texto completo da página.',
  noJob: 'Escolha ou crie uma vaga antes de analisar.',
  noRequirements: 'Cadastre os requisitos da vaga antes de analisar.',
  noAcceptance: 'Aceite os avisos antes de analisar.',
  saveFailed: 'Não foi possível analisar e guardar. Tente de novo; se continuar, feche e abra o painel.',
  jobChanged: 'A vaga ativa foi trocada em outra janela. Confira a vaga mostrada no alto e analise de novo.',
};

export const RESULT = {
  title: (name: string): string => `Análise: ${name}`,
  scoreLabel: 'Nota',
  noScore: 'Sem nota',
  noScoreText: 'Os requisitos desta vaga ainda precisam ser conferidos no perfil. Enquanto isso, não há nota.',
  requiredCount: (met: number, total: number): string => `Obrigatórios que bateram: ${met} de ${total}.`,
  updated: 'Esta pessoa já estava na lista. A ficha foi atualizada, sem duplicar.',
  addedNothing: 'O texto não trouxe nada novo para a ficha.',
  notProfileLink: 'O link não parece ser de um perfil do LinkedIn. Se você colar esta pessoa de novo, ela entra como outra.',
  requirementsTitle: 'O que a vaga pede',
  requirementsLabel: 'Resultado por requisito',
  required: 'Obrigatório',
  preferred: 'Desejável',
  evidenceLabel: 'Onde apareceu',
  evidence: (section: string, term: string, titles: readonly string[], time: string | null): string => {
    const parts = [`${section}: ${term}`];
    if (titles.length > 0) parts.push(`cargo ${titles.join(', ')}`);
    if (time !== null) parts.push(time);
    return parts.join(' · ');
  },
  reanalysisHelp: 'Requisito novo. Cole o perfil de novo para conferir. Até lá, ele não pesa na nota.',
  readTitle: 'A leitura pode estar incompleta',
  readEmpty: 'Não reconhecemos nenhuma seção do perfil.',
  readMissing: (names: readonly string[]): string => `Faltou ler: ${names.join(' e ')}.`,
  readTruncated: 'O perfil mostra listas cortadas, como “Exibir todas”.',
  readHow: 'Para completar: role a página até o fim, abra “ver tudo” nas seções cortadas, ou cole o texto completo. Depois use “Somar mais texto”. A Triagem+ nunca faz isso sozinha.',
  support: FOOTER_PHRASE,
};

export const TOP = {
  title: 'Os 10 melhores',
  titleFew: (n: number): string => (n === 1 ? 'O candidato da lista' : `Os ${n} candidatos da lista`),
  total: (shown: number, total: number): string => (total === shown ? `Total da lista: ${total}.` : `Mostrando ${shown} de ${total} na lista.`),
  listLabel: 'Os melhores da lista, em ordem de nota',
  entered: (name: string, position: number, updated: boolean): string => (updated ? `${name} foi atualizada e está em ${position}º.` : `${name} entrou em ${position}º.`),
  enteredOut: (name: string, position: number, total: number): string => `${name} ficou fora dos 10: está em ${position}º, entre ${total}.`,
  notInformed: 'Não informado',
  notInformedHelp: 'O selo “Não informado” marca quem ainda não recebeu o aviso de privacidade.',
  noTitle: 'Cargo não identificado',
  noScore: 'Sem nota',
  favorite: 'Favorito',
  expiring: 'Prazo acabando',
  seeDetail: 'Ver detalhe',
  seeDetailShort: '›',
  seeDetailNamed: (name: string): string => `Ver detalhe: ${name}`,
  linkNamed: (name: string): string => `Abrir o perfil de ${name} (nova aba)`,
  noLink: 'Sem link clicável',
  support: FOOTER_PHRASE,
};

export const LIST = {
  title: 'Todos da lista',
  count: (shown: number, total: number): string => `Mostrando ${shown} de ${total}.`,
  hidden: (hidden: number): string =>
    hidden === 0 ? 'Nenhum ficou de fora.' : `${hidden === 1 ? '1 ficou de fora' : `${hidden} ficaram de fora`} dos filtros. Ninguém foi apagado: tire os filtros para ver todos.`,
  empty: 'Ninguém passa pelos filtros escolhidos.',
  filtersTitle: 'Filtros',
  term: 'Tecnologia ou ferramenta',
  termHelp: 'Por exemplo: Java ou Spring Boot.',
  minYears: 'Experiência mínima (anos)',
  band: 'Faixa',
  stage: 'Etapa',
  any: 'Todas',
  favoriteOnly: 'Só favoritos',
  allRequired: 'Só quem atende a todos os obrigatórios',
  apply: 'Filtrar',
  clear: 'Tirar os filtros',
  years: 'Escreva um número inteiro de anos, de 0 a 60.',
  listLabel: 'Candidatos da lista',
};

export const DETAIL = {
  gone: 'Esta pessoa não está mais na lista. Ela foi apagada em outra janela, e nada foi salvo.',
  title: (name: string): string => `Detalhe: ${name}`,
  position: (position: number, total: number): string => `${position}º lugar entre ${total}.`,
  link: 'Perfil',
  informed: 'Aviso de privacidade',
  informedAt: (date: string): string => `Informado em ${date}.`,
  notInformed: 'Ainda não informado.',
  expiredTitle: 'O prazo de guarda já passou',
  expiredText: 'Esta ficha será apagada sozinha quando você abrir o painel de novo. Renovar recomeça a contagem do prazo.',
  expiresTitle: 'O prazo de guarda está acabando',
  expiresText: (date: string): string => `Esta ficha será apagada sozinha depois de ${date}. Renovar recomeça a contagem do prazo.`,
  keepUntil: (date: string): string => `Guardada até ${date}.`,
  formTitle: 'Etapa, favorito e notas',
  stage: 'Etapa',
  favorite: 'Favorito',
  notes: 'Notas',
  notesHelp: 'Texto livre, só seu. As notas nunca entram na nota de match.',
  notesAlertTitle: 'Cuidado com o que você anota',
  notesAlertText: 'As notas parecem tratar de um assunto que não pode pesar na decisão. Nada foi bloqueado, mas confira o que você escreveu.',
  save: 'Salvar',
  saved: 'Alterações salvas.',
  renewed: 'Prazo renovado.',
  removed: 'A pessoa saiu da lista e a ficha foi apagada.',
  deleted: 'A ficha foi apagada.',
  explanationTitle: 'Como a nota foi calculada',
  confirmTitle: 'Apagar esta ficha?',
  confirmText: (name: string): string => `A ficha de ${name} será apagada desta vaga. Isso não pode ser desfeito.`,
  saveFailed: 'Não foi possível guardar. Tente de novo.',
  notesTooLong: 'As notas são longas demais. Reduza o texto.',
};

export const REPORT = {
  title: 'Gerar PDF',
  intro: 'O arquivo vai para a sua pasta de downloads, na hora, sem passar pela tela de imprimir.',
  scopeLegend: 'O que entra no arquivo',
  scopeTop: 'Os 10 melhores',
  scopeFiltered: (n: number): string => `Todos os que estão na lista filtrada (${n})`,
  scopeFilteredPlain: (n: number): string => `Todos da lista (${n})`,
  scopeEmpty: 'Nenhum candidato nesta vaga ainda.',
  includeNotes: 'Incluir as minhas notas sobre cada pessoa',
  includeNotesHelp: 'Desmarcado por padrão. Notas são só suas e podem ter coisas que não devem sair.',
  noticeTitle: 'Antes de baixar',
  notice: 'O arquivo tem dados pessoais. Ele sai do controle da Triagem+, e quem o receber também passa a responder por eles.',
  firstTimeNotice: 'É a primeira vez: ao baixar, você confirma que entendeu este aviso. Depois ele continua aqui, sem pedir outro clique.',
  pdf: 'Gerar PDF',
  pdfFirst: 'Entendi o aviso e gerar PDF',
  csv: 'Baixar planilha (CSV)',
  csvFirst: 'Entendi o aviso e baixar planilha',
  csvHelp: 'A planilha tem o mesmo conteúdo do PDF.',
  replacedTitle: 'Confira alguns nomes pelo link',
  replaced: (n: number): string =>
    n === 1
      ? 'Uma letra não existe no PDF e saiu como “?”, como acontece com nomes escritos em outro alfabeto. Confira essa pessoa pelo link do perfil.'
      : `${n} letras não existem no PDF e saíram como “?”, como acontece com nomes escritos em outro alfabeto. Confira essas pessoas pelo link do perfil.`,
  done: 'Arquivo gerado. Procure na sua pasta de downloads.',
  failed: 'Não foi possível gerar o arquivo. Tente de novo.',
  support: FOOTER_PHRASE,
};

export const FLASH = {
  requirementsChanged: 'Os requisitos mudaram. As notas foram refeitas pela ficha de cada pessoa.',
};
