// Modelos de mensagem (RF-80 a RF-82): três textos editáveis, com marcadores que a Triagem+ preenche.
// Puro: sem tela e sem armazenamento. O único gesto da tela é copiar o texto pronto (RF-81); nada aqui envia nada.
// Os textos padrão não citam ninguém e não prometem nada de ordem jurídica: dizem o que é guardado, onde, por quanto tempo
// (com a renovação enquanto o processo durar) e que relatórios gerados saem do controle da extensão (RF-80).
import type { MessageTemplate } from '../model.ts';

export const TEMPLATE_IDS = ['first_contact', 'follow_up', 'closing'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Os marcadores aceitos nos modelos, na forma em que aparecem no texto. */
export const MARKERS = ['{nome}', '{vaga}', '{responsavel}', '{contato}'] as const;
export type Marker = (typeof MARKERS)[number];

/** Tamanho máximo de um modelo. Passou disso, a tela pede para encurtar. */
export const MAX_TEMPLATE_CHARS = 3000;

export interface TemplateValues {
  readonly nome?: string | null;
  readonly vaga?: string | null;
  readonly responsavel?: string | null;
  readonly contato?: string | null;
}

const MARKER_PATTERN = /\{(nome|vaga|responsavel|contato)\}/g;

function valueOf(values: TemplateValues, key: string): string {
  const raw = (values as Readonly<Record<string, string | null | undefined>>)[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Troca cada marcador pelo valor. Marcador sem valor continua escrito no texto, para ninguém enviar a mensagem sem ver
 * que falta algo. A troca é de uma passada só: um valor que contenha "{vaga}" não é trocado de novo.
 */
export function fillTemplate(body: string, values: TemplateValues): string {
  return body.replace(MARKER_PATTERN, (marker, key: string) => {
    const value = valueOf(values, key);
    return value === '' ? marker : value;
  });
}

/** Marcadores que o modelo usa e que ficaram sem valor, na ordem em que aparecem, sem repetir. */
export function missingMarkers(body: string, values: TemplateValues): Marker[] {
  const out: Marker[] = [];
  for (const match of body.matchAll(MARKER_PATTERN)) {
    const marker = match[0] as Marker;
    if (valueOf(values, match[1] as string) === '' && !out.includes(marker)) out.push(marker);
  }
  return out;
}

export const TEMPLATE_TITLES: Readonly<Record<TemplateId, string>> = {
  first_contact: 'Primeiro contato',
  follow_up: 'Retorno',
  closing: 'Encerramento',
};

function daysText(days: number): string {
  return days === 1 ? '1 dia' : `${days} dias`;
}

/** Os textos padrão. O prazo atual de guarda entra no primeiro contato e no encerramento. */
export function defaultBody(id: TemplateId, retentionDays: number): string {
  const days = daysText(retentionDays);
  switch (id) {
    case 'first_contact':
      return [
        'Olá, {nome}! Meu nome é {responsavel} e trabalho com recrutamento de pessoas de tecnologia.',
        '',
        'Estou buscando gente para a vaga {vaga}. Vi dados profissionais públicos do seu perfil, só para esta vaga.',
        '',
        `Quero ser transparente: esses dados ficam no navegador de quem recruta, e podem aparecer em relatório que eu gerar sobre a vaga. Eu os guardo por ${days}, e esse prazo pode ser renovado enquanto o processo durar. Você pode me pedir para ver, corrigir ou apagar o que guardei. É só falar comigo em {contato}.`,
        '',
        'Se tiver interesse em conversar sobre a vaga, responda esta mensagem. Se não tiver, sem problema.',
      ].join('\n');
    case 'follow_up':
      return [
        'Olá, {nome}! Passando para saber se você viu minha mensagem sobre a vaga {vaga}.',
        '',
        'Se tiver interesse, é só responder. Se não for um bom momento, tudo bem também.',
        '',
        'Um abraço, {responsavel}.',
      ].join('\n');
    case 'closing':
      return [
        'Olá, {nome}! Obrigado pelo seu tempo. Estou encerrando o processo da vaga {vaga} para o seu perfil.',
        '',
        `Como o processo acabou, não vou renovar o prazo: os dados que guardei sobre você serão apagados quando completarem ${days} desde a última atualização. Se quiser que eu apague antes, ou tiver alguma dúvida, fale comigo em {contato}. Se um relatório com seus dados já foi gerado, ele não se apaga sozinho.`,
        '',
        'Um abraço, {responsavel}.',
      ].join('\n');
  }
}

export function defaultTemplates(retentionDays: number): MessageTemplate[] {
  return TEMPLATE_IDS.map((id) => ({ id, title: TEMPLATE_TITLES[id], body: defaultBody(id, retentionDays) }));
}

export interface ResolvedTemplate {
  readonly id: TemplateId;
  readonly title: string;
  readonly body: string;
  /** Está valendo o texto padrão (nenhuma edição guardada). */
  readonly isDefault: boolean;
}

/** Os três modelos que valem agora: o texto editado quando existe, o padrão quando não. Sempre na mesma ordem. */
export function resolveTemplates(stored: readonly MessageTemplate[], retentionDays: number): ResolvedTemplate[] {
  return TEMPLATE_IDS.map((id) => {
    const edited = stored.find((item) => item.id === id && item.body.trim() !== '');
    return edited === undefined
      ? { id, title: TEMPLATE_TITLES[id], body: defaultBody(id, retentionDays), isDefault: true }
      : { id, title: TEMPLATE_TITLES[id], body: edited.body, isDefault: false };
  });
}

/** A lista a guardar depois de editar um modelo. Texto igual ao padrão não é guardado: o padrão acompanha o prazo atual. */
export function withTemplate(stored: readonly MessageTemplate[], id: TemplateId, body: string, retentionDays: number): MessageTemplate[] {
  const others = stored.filter((item) => item.id !== id);
  if (body === defaultBody(id, retentionDays)) return others;
  return [...others, { id, title: TEMPLATE_TITLES[id], body }];
}

/** A lista a guardar depois de restaurar o padrão de um modelo. */
export function withoutTemplate(stored: readonly MessageTemplate[], id: TemplateId): MessageTemplate[] {
  return stored.filter((item) => item.id !== id);
}

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && (TEMPLATE_IDS as readonly string[]).includes(value);
}
