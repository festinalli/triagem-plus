// Textos da tela de Privacidade (RF-91 a RF-94, RNF-05, FL-9), em português simples. Nome, link e notas de candidatos
// chegam de fora e são colocados na tela como texto; nada deles passa por este arquivo.
import type { CorrectionFailure } from '../core/conversation/privacy.ts';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const PRIVACY = {
  title: 'Privacidade e seus dados',
  notLegal: {
    title: 'Isto não é parecer jurídico',
    text: 'A tela explica o essencial em linguagem simples. Ela não troca a opinião de um advogado.',
  },
  stored: {
    title: 'O que fica guardado',
    items: [
      'Das vagas: o título, o texto colado e os requisitos.',
      'De cada pessoa que você analisa: nome, link do perfil, uma ficha com cargo atual, tempo de experiência e tecnologias achadas, a nota, a etapa, as suas notas e a data do aviso.',
      'Seu nome, seu contato, o prazo de guarda, os avisos que você aceitou e os modelos de mensagem.',
    ],
    session: 'O texto do perfil que você cola não fica guardado. Ele vive só na memória do navegador, até você analisar outro perfil ou fechar o navegador.',
  },
  where: {
    title: 'Onde fica',
    text: 'Só neste navegador, neste computador, na área de dados da extensão. A Triagem+ não tem servidor, conta nem acesso à internet: nada é enviado para fora.',
  },
  howLong: {
    title: 'Por quanto tempo',
    text: (days: number): string =>
      `Cada pessoa fica ${plural(days, 'dia', 'dias')}, contados da última atualização. Nos 7 dias finais, a tela avisa e deixa renovar. Passado o prazo, a pessoa é apagada sozinha ao abrir o navegador ou o painel. Você muda o prazo em Ajustes.`,
  },
  unprotected: {
    title: 'O que NÃO é protegido',
    items: [
      'Os dados ficam sem criptografia. Quem usa este perfil do Chrome neste computador consegue ler.',
      'Arquivos que você baixa (PDF, planilha ou JSON) saem do controle da Triagem+. Quem os receber também passa a responder por eles.',
    ],
  },
  yours: {
    title: 'O que cabe a você',
    items: [
      'Ter um motivo legal para usar os dados. Em geral é o legítimo interesse, que você precisa avaliar e registrar, de preferência com um advogado.',
      'Avisar cada pessoa. O modelo “Primeiro contato” ajuda, mas quem envia é você.',
      'Atender os pedidos: ver, corrigir e apagar os dados da pessoa. Use “Achar uma pessoa”, logo abaixo.',
      'Não discriminar. A nota é só apoio, e a decisão é sua.',
    ],
  },
  space: {
    title: 'Espaço usado',
    used: (usedText: string, limitText: string): string => `Você usa ${usedText} de ${limitText}.`,
    unknown: 'Não foi possível medir o espaço agora.',
    near: 'Está perto do limite. Apague quem já não interessa, ou exporte e apague vagas antigas, antes que o navegador deixe de guardar.',
    ok: 'Ainda há bastante espaço.',
  },
};

export const FIND = {
  title: 'Achar uma pessoa',
  intro: 'Procura em todas as vagas, pelo nome ou pelo link do perfil. Letras com ou sem acento dão o mesmo resultado.',
  label: 'Nome ou link',
  help: 'Por exemplo: ana souza, ou parte do link do perfil.',
  submit: 'Achar',
  empty: 'Escreva um nome ou um link.',
  none: 'Ninguém foi achado com esse texto.',
  count: (n: number): string => (n === 1 ? 'Uma pessoa achada.' : `${n} pessoas achadas.`),
  listLabel: 'Pessoas achadas',
  inJobs: (n: number): string => `Guardada em ${plural(n, 'vaga', 'vagas')}.`,
  seeAll: 'Ver tudo o que está guardado',
  correct: 'Corrigir nome e link',
  correctNamed: (name: string): string => `Corrigir nome e link: ${name}`,
  export: 'Exportar a ficha (JSON)',
  exportNamed: (name: string): string => `Exportar a ficha (JSON): ${name}`,
  delete: 'Apagar em todas as vagas',
  deleteNamed: (name: string): string => `Apagar em todas as vagas: ${name}`,
  exportNotice: 'O arquivo da ficha tem dados pessoais. Ele sai do controle da Triagem+, e quem o receber também passa a responder por eles.',
  exported: 'Ficha baixada. Procure na sua pasta de downloads.',
  exportFailed: 'Não foi possível gerar o arquivo. Tente de novo.',
  corrected: 'Nome e link corrigidos em todas as vagas.',
  deleted: (n: number): string => `A pessoa foi apagada de ${plural(n, 'vaga', 'vagas')}.`,
  deleteFailed: 'Não foi possível apagar. Tente de novo.',
  editName: 'Nome',
  editLink: 'Link do perfil',
  editLinkHelp: 'Precisa começar com https://. A correção vale para todas as vagas em que a pessoa está.',
  editSave: 'Salvar a correção',
  editCancel: 'Cancelar',
};

export const FIND_ERRORS: Readonly<Record<CorrectionFailure, string>> = {
  no_name: 'Escreva o nome da pessoa.',
  bad_url: 'O link precisa começar com https://.',
  lost_link: 'Esta pessoa está em mais de uma vaga e precisa de um link de perfil, como https://www.linkedin.com/in/nome/, para continuar reconhecida.',
  taken: 'Já existe outra pessoa com este link na mesma vaga.',
  not_found: 'Esta pessoa já não está guardada.',
  save_failed: 'Não foi possível guardar. Tente de novo.',
};

export const RECORD = {
  job: 'Vaga',
  jobGone: 'Vaga que já não existe',
  score: 'Nota',
  noScore: 'Sem nota',
  stage: 'Etapa',
  currentTitle: 'Cargo atual',
  noTitle: 'Não identificado',
  experience: 'Experiência total',
  noExperience: 'Não deu para medir',
  terms: 'Tecnologias achadas',
  noTerms: 'Nenhuma',
  sections: 'Partes do perfil lidas',
  favorite: 'Favorito',
  yes: 'Sim',
  no: 'Não',
  notes: 'Suas notas',
  noNotes: 'Nenhuma',
  informed: 'Informado em',
  notInformed: 'Ainda não informado',
  source: 'Como entrou',
  pasted: 'Texto colado',
  clicked: 'Leitura por clique',
  results: 'Página de resultados',
  added: 'Entrou em',
  updated: 'Atualizada em',
  keepUntil: 'Guardada até',
  expiredNote: 'O prazo já passou; será apagada quando o painel abrir de novo',
  months: (total: number): string => {
    const years = Math.floor(total / 12);
    const months = total % 12;
    const parts = [years > 0 ? plural(years, 'ano', 'anos') : '', months > 0 ? plural(months, 'mês', 'meses') : ''].filter((part) => part !== '');
    return parts.length === 0 ? 'Menos de 1 mês' : parts.join(' e ');
  },
};

export const CONFIRM_PERSON = {
  title: 'Apagar esta pessoa de todas as vagas?',
  text: (name: string, count: number): string =>
    `${name} será apagada de ${plural(count, 'vaga', 'vagas')}, com a ficha, a nota e as suas notas. Isso não pode ser desfeito. Arquivos que você já baixou não são afetados.`,
};

export const DATA = {
  title: 'Seus dados neste navegador',
  exportTitle: 'Exportar tudo',
  exportText: 'Baixa um arquivo JSON com as vagas, as pessoas, os ajustes e os modelos de mensagem.',
  exportButton: 'Exportar tudo (JSON)',
  exportButtonFirst: 'Entendi o aviso e exportar tudo',
  exportDone: 'Arquivo baixado. Procure na sua pasta de downloads.',
  exportFailed: 'Não foi possível gerar o arquivo. Tente de novo.',
  wipeTitle: 'Apagar tudo',
  wipeText: 'Apaga as vagas, as pessoas, os ajustes, os avisos aceitos e a memória da sessão. A Triagem+ volta à primeira abertura.',
  wipeUninstall: 'Desinstalar a extensão também apaga o que está guardado nela, mas não os arquivos que você já baixou. Esses você apaga por conta própria.',
  wipeWord: 'APAGAR',
  wipeLabel: 'Para confirmar, digite APAGAR',
  wipeHelp: 'Em letras maiúsculas. Isso não pode ser desfeito.',
  wipeButton: 'Apagar tudo',
  wipeEmpty: 'Digite APAGAR, em letras maiúsculas, para confirmar.',
  wipeFailed: 'Não foi possível apagar tudo. Tente de novo; se continuar, feche e abra o painel.',
};
