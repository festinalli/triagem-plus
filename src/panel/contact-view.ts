// Modelos de mensagem na tela (RF-80 a RF-82). No detalhe da pessoa: escolher o modelo, ver a mensagem pronta, Copiar e,
// depois, marcar "informado em". Em Ajustes: editar os três modelos e restaurar o padrão. Copiar é o único gesto (RF-81):
// nenhum botão daqui envia, preenche caixa de conversa ou abre página. Nome e dados da pessoa entram só como texto.
import type { ConversationMessage } from '../core/conversation/build.ts';
import { h } from './ui/h.ts';
import { Button, Form, formValues, Notice, SelectField, TextAreaField } from './ui/components.ts';
import { copyText } from './clipboard.ts';
import { draft, formError } from './frame.ts';
import type { Controller } from './app.ts';
import { templateField } from './contact-controller.ts';
import { MESSAGE, TEMPLATES } from './contact-strings.ts';
import { DETAIL } from './strings.ts';

type Detail = Extract<ConversationMessage, { kind: 'candidate_detail' }>;
type Settings = Extract<ConversationMessage, { kind: 'settings_form' }>;

function dateText(at: number): string {
  return new Date(at).toLocaleDateString('pt-BR');
}

function markButton(message: Detail, ctl: Controller): HTMLElement {
  return Button({ label: MESSAGE.mark, variant: 'primary', focusKey: 'mark-informed', onClick: () => void ctl.contact.markInformed(message.candidateId, true) });
}

/** A linha do aviso de privacidade: "Informado em" com desfazer, ou "Ainda não informado" com o botão de marcar. */
export function InformedStatus(message: Detail, ctl: Controller): HTMLElement {
  const informed = message.informedAt !== null;
  // Depois de copiar, o botão de marcar aparece junto do aviso da mensagem; aqui ele não se repete.
  const offered = !informed && ctl.contact.copy !== null;
  return h(
    'div',
    { class: 'tr-informed' },
    h('p', { class: 'tr-text', 'data-testid': 'informed-status' }, message.informedAt === null ? DETAIL.notInformed : DETAIL.informedAt(dateText(message.informedAt))),
    informed
      ? Button({ label: MESSAGE.undo, focusKey: 'undo-informed', onClick: () => void ctl.contact.markInformed(message.candidateId, false) })
      : offered
        ? null
        : Button({ label: MESSAGE.mark, focusKey: 'mark-informed', onClick: () => void ctl.contact.markInformed(message.candidateId, true) }),
  );
}

export function MessageSection(message: Detail, ctl: Controller): HTMLElement {
  const chosen = message.templates.find((template) => template.id === ctl.contact.templateId) ?? (message.templates[0] as Detail['templates'][number]);
  const copied = ctl.contact.copy;

  const copy = async (): Promise<void> => {
    const ok = await copyText(chosen.text);
    ctl.contact.copied(ok);
    if (!ok) {
      const area = document.getElementById('message-text');
      if (area instanceof HTMLTextAreaElement) {
        area.focus();
        area.select();
      }
    }
  };

  return h(
    'section',
    { class: 'tr-block', 'aria-labelledby': 'message-title' },
    h('h3', { class: 'tr-block__title', id: 'message-title' }, MESSAGE.title),
    h('p', { class: 'tr-text tr-text--muted tr-text--small' }, MESSAGE.intro),
    SelectField({
      id: 'message-template',
      name: 'template',
      label: MESSAGE.templateLabel,
      options: message.templates.map((template) => ({ value: template.id, label: template.title })),
      value: chosen.id,
      onChange: (value) => ctl.contact.setTemplate(value),
    }),
    TextAreaField({ id: 'message-text', label: MESSAGE.textLabel, rows: 10, readonly: true, value: chosen.text }),
    chosen.missing.length > 0 ? Notice({ tone: 'attention', text: MESSAGE.missing(chosen.missing) }) : null,
    h('div', { class: 'tr-msg__actions' }, Button({ label: MESSAGE.copy, variant: 'primary', focusKey: 'message-copy', onClick: () => void copy() })),
    h('p', { class: 'tr-text tr-text--ok', role: 'status', 'data-testid': 'message-copy-status' }, copied === 'copied' ? MESSAGE.copied : copied === 'manual' ? MESSAGE.copyManual : ''),
    copied !== null && message.informedAt === null ? Notice({ tone: 'info', title: MESSAGE.offerTitle, text: MESSAGE.offerText, children: markButton(message, ctl) }) : null,
  );
}

/** Em Ajustes: os três modelos, cada um com seu texto, Salvar e Restaurar o padrão. */
export function TemplatesSection(message: Settings, ctl: Controller): HTMLElement {
  return h(
    'section',
    { class: 'tr-block', 'aria-labelledby': 'templates-title' },
    h('h3', { class: 'tr-block__title', id: 'templates-title' }, TEMPLATES.title),
    h('p', { class: 'tr-text tr-text--muted tr-text--small' }, TEMPLATES.intro),
    h('p', { class: 'tr-text tr-text--small' }, TEMPLATES.markers),
    message.templates.map((template) => {
      const status = ctl.contact.status;
      return h(
        'div',
        { class: 'tr-template', 'data-template': template.id },
        h('p', { class: 'tr-msg__strong' }, template.title, ' ', h('span', { class: 'tr-text--muted tr-text--small' }, template.isDefault ? `(${TEMPLATES.standard})` : `(${TEMPLATES.custom})`)),
        Form({
          label: TEMPLATES.formNamed(template.title),
          onSubmit: (form) => void ctl.contact.saveTemplate(template.id, formValues(form)),
          children: [
            TextAreaField({ id: templateField(template.id), name: 'body', label: TEMPLATES.bodyLabel(template.title), rows: 9, value: draft(ctl, templateField(template.id), template.body), error: formError(ctl, templateField(template.id)) }),
            h(
              'div',
              { class: 'tr-msg__actions' },
              Button({ label: TEMPLATES.save, ariaLabel: TEMPLATES.saveNamed(template.title), variant: 'primary', type: 'submit', focusKey: `tpl-save-${template.id}` }),
              Button({ label: TEMPLATES.restore, ariaLabel: TEMPLATES.restoreNamed(template.title), disabled: template.isDefault, focusKey: `tpl-restore-${template.id}`, onClick: () => void ctl.contact.restoreTemplate(template.id) }),
            ),
            h('p', { class: 'tr-text tr-text--ok', role: 'status' }, status !== null && status.id === template.id ? status.text : ''),
          ],
        }),
      );
    }),
  );
}
