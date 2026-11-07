// Textos dos modelos de mensagem (RF-80 a RF-82), em português simples. Nenhum texto de candidato passa por aqui.
import type { Marker } from '../core/messages/templates.ts';

export const MESSAGE = {
  title: 'Mensagem para a pessoa',
  intro: 'Escolha um modelo, confira o texto e copie. A Triagem+ só copia: você cola e envia por onde preferir.',
  templateLabel: 'Modelo',
  textLabel: 'Mensagem pronta',
  copy: 'Copiar',
  copied: 'Mensagem copiada.',
  copyManual: 'Não foi possível copiar sozinho. O texto acima está selecionado: use Ctrl+C.',
  missing: (markers: readonly Marker[]): string =>
    `Faltam dados e ${markers.length === 1 ? 'o marcador continua' : 'os marcadores continuam'} escrito${markers.length === 1 ? '' : 's'} no texto: ${markers.join(', ')}. Preencha em Ajustes ou troque à mão antes de enviar.`,
  offerTitle: 'Já enviou a mensagem?',
  offerText: 'Marque “informado em” para a pessoa sair da lista de quem ainda não foi avisada.',
  mark: 'Marcar como informado hoje',
  undo: 'Desfazer o “informado”',
  markFailed: 'Não foi possível guardar. Tente de novo.',
};

export const TEMPLATES = {
  title: 'Modelos de mensagem',
  intro: 'São três: primeiro contato, retorno e encerramento. Os marcadores são trocados pelos dados de cada pessoa na hora de copiar.',
  markers: 'Marcadores: {nome}, {vaga}, {responsavel} e {contato}. Um marcador sem dado continua escrito no texto.',
  bodyLabel: (title: string): string => `Texto do modelo ${title}`,
  formNamed: (title: string): string => `Editar o modelo ${title}`,
  save: 'Salvar modelo',
  restore: 'Restaurar o padrão',
  saveNamed: (title: string): string => `Salvar modelo: ${title}`,
  restoreNamed: (title: string): string => `Restaurar o padrão: ${title}`,
  saved: 'Modelo salvo.',
  restored: 'Modelo restaurado ao padrão.',
  custom: 'Editado por você',
  standard: 'Texto padrão',
  empty: 'O modelo não pode ficar vazio. Use “Restaurar o padrão” se quiser voltar ao texto original.',
  tooLong: (max: number): string => `O modelo passa de ${max} caracteres. Encurte o texto.`,
  failed: 'Não foi possível guardar o modelo. Tente de novo.',
};
