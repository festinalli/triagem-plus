// Modelos de mensagem no painel (RF-80 a RF-82): qual modelo está escolhido, se o texto foi copiado, marcar "informado em" e
// editar os três modelos em Ajustes. O único gesto sobre a mensagem é copiar: nada aqui envia, preenche caixa de conversa ou
// abre página (RF-81). Nenhum nome, contato ou texto de mensagem vai para registro ou mensagem de erro (RNF-11).
import { isTemplateId, MAX_TEMPLATE_CHARS, withTemplate, withoutTemplate } from '../core/messages/templates.ts';
import type { TemplateId } from '../core/messages/templates.ts';
import type { MessageTemplate } from '../core/model.ts';
import type { Store } from '../core/store/store.ts';
import type { Snapshot, UiState } from './app.ts';
import { MESSAGE, TEMPLATES } from './contact-strings.ts';

export type MessageCopy = 'copied' | 'manual' | null;

export interface ContactControl {
  /** O modelo escolhido na tela de detalhe. */
  readonly templateId: TemplateId;
  /** O texto foi copiado (ou não deu para copiar sozinho). Some ao sair da tela. */
  readonly copy: MessageCopy;
  /** Aviso curto do último salvar ou restaurar em Ajustes. */
  readonly status: { readonly id: TemplateId; readonly text: string } | null;
  setTemplate(id: string): void;
  copied(ok: boolean): void;
  markInformed(candidateId: string, informed: boolean): Promise<void>;
  saveTemplate(id: string, values: Record<string, string>): Promise<void>;
  restoreTemplate(id: string): Promise<void>;
  /** Limpa o que é só da tela atual (copiado, avisos). A escolha do modelo fica. */
  reset(): void;
}

export interface ContactContext {
  readonly store: Store;
  readonly ui: UiState;
  readonly data: () => Snapshot;
  readonly now: () => number;
  readonly load: () => Promise<void>;
  readonly redraw: (options?: { focusError?: boolean }) => void;
}

export const templateField = (id: TemplateId): string => `tpl-${id}`;

export function createContactControl(ctx: ContactContext): ContactControl {
  const state: { templateId: TemplateId; copy: MessageCopy; status: { id: TemplateId; text: string } | null } = { templateId: 'first_contact', copy: null, status: null };

  async function markInformed(candidateId: string, informed: boolean): Promise<void> {
    try {
      const current = await ctx.store.getCandidate(candidateId);
      if (current === null) throw new Error('sem registro');
      // O prazo de guarda não muda: updatedAt fica como está.
      await ctx.store.saveCandidate({ ...current, informedAt: informed ? ctx.now() : null });
      await ctx.load();
      ctx.ui.banner = null;
      state.copy = null;
    } catch {
      ctx.ui.banner = MESSAGE.markFailed;
    }
    ctx.redraw();
  }

  function oops(id: TemplateId, text: string, body: string): void {
    ctx.ui.errors = { [templateField(id)]: text };
    ctx.ui.drafts = { [templateField(id)]: body };
    ctx.redraw({ focusError: true });
  }

  async function writeTemplates(id: TemplateId, change: (stored: readonly MessageTemplate[], days: number) => MessageTemplate[], text: string): Promise<boolean> {
    try {
      const settings = await ctx.store.getSettings();
      await ctx.store.updateSettings({ messageTemplates: change(settings.messageTemplates, settings.retentionDays) });
      await ctx.load();
      ctx.ui.errors = {};
      ctx.ui.drafts = {};
      ctx.ui.banner = null;
      state.status = { id, text };
      return true;
    } catch {
      ctx.ui.banner = TEMPLATES.failed;
      return false;
    }
  }

  return {
    get templateId() {
      return state.templateId;
    },
    get copy() {
      return state.copy;
    },
    get status() {
      return state.status;
    },
    setTemplate: (id) => {
      if (isTemplateId(id)) state.templateId = id;
      state.copy = null;
      ctx.redraw();
    },
    copied: (ok) => {
      state.copy = ok ? 'copied' : 'manual';
      ctx.redraw();
    },
    markInformed,
    saveTemplate: async (id, values) => {
      if (!isTemplateId(id)) return;
      // O envio do formulário troca a quebra de linha por CRLF: o texto guardado usa só LF.
      const body = (values['body'] ?? '').replace(/\r\n?/gu, '\n').replace(/\p{Cs}/gu, '');
      if (body.trim() === '') return oops(id, TEMPLATES.empty, body);
      if (body.length > MAX_TEMPLATE_CHARS) return oops(id, TEMPLATES.tooLong(MAX_TEMPLATE_CHARS), body);
      await writeTemplates(id, (stored, days) => withTemplate(stored, id, body, days), TEMPLATES.saved);
      ctx.redraw();
    },
    restoreTemplate: async (id) => {
      if (!isTemplateId(id)) return;
      await writeTemplates(id, (stored) => withoutTemplate(stored, id), TEMPLATES.restored);
      ctx.redraw();
    },
    reset: () => {
      state.copy = null;
      state.status = null;
    },
  };
}
