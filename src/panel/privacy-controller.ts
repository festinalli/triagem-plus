// Privacidade no painel (RF-91 a RF-94, FL-9): achar uma pessoa em todas as vagas, corrigir, exportar a ficha, apagar,
// exportar tudo e apagar tudo. O que foi achado vive só na memória do painel (RF-69). Nenhum nome, link ou nota de
// candidato vai para registro ou mensagem de erro (RNF-11): as mensagens daqui são frases fixas.
import { HOME } from '../core/conversation/build.ts';
import type { Action } from '../core/conversation/build.ts';
import { NO_FILTERS } from '../core/conversation/filters.ts';
import { correctPerson, findAllRecords } from '../core/conversation/privacy.ts';
import type { PrivacyInput } from '../core/conversation/privacy.ts';
import { DEFAULT_REPORT_CHOICE } from '../core/conversation/triage.ts';
import type { Candidate } from '../core/model.ts';
import type { Store } from '../core/store/store.ts';
import type { TextMemory } from '../core/conversation/analyze-store.ts';
import type { UiState } from './app.ts';
import { DATA, FIND, FIND_ERRORS } from './privacy-strings.ts';
import { acceptFileExport } from './triage-controller.ts';
import { startDownload } from './ui/download-link.ts';

export interface PrivacyControl {
  /** O que a conversa precisa para desenhar a tela de Privacidade. */
  input(): PrivacyInput;
  /** Frase curta do último resultado de achar, corrigir, exportar ou apagar uma pessoa. */
  readonly peopleStatus: string | null;
  /** Frase curta do último resultado de exportar tudo ou apagar tudo. */
  readonly dataStatus: string | null;
  open(): void;
  /** Trata os botões da tela. Falso quando o botão não é daqui. */
  run(action: Action): boolean;
  search(query: string): Promise<void>;
  edit(candidateId: string | null): void;
  savePerson(candidateId: string, values: Record<string, string>): Promise<void>;
  exportPerson(candidateId: string): Promise<void>;
  exportEverything(): Promise<void>;
  wipe(values: Record<string, string>): Promise<void>;
  /** Esquece o que foi achado quando a pessoa sai da tela de Privacidade. */
  sync(): void;
  /** Outra janela mudou os dados: relê o que foi achado e o espaço em uso. */
  refresh(): Promise<void>;
}

export interface PrivacyContext {
  readonly store: Store;
  readonly memory: TextMemory;
  readonly ui: UiState;
  readonly now: () => number;
  readonly load: () => Promise<void>;
  readonly go: (step: UiState['step'], flash?: string | null) => void;
  readonly redraw: (options?: { focusError?: boolean }) => void;
  /** Esvazia também o que a extensão guarda só enquanto o navegador está aberto. */
  readonly wipeSession?: () => Promise<void>;
}

function dayText(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

function jsonBlob(value: unknown): Blob {
  return new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
}

export function createPrivacyControl(ctx: PrivacyContext): PrivacyControl {
  const state: { bytes: number | null; query: string; ids: string[] | null; found: Candidate[] | null; editing: string | null; people: string | null; data: string | null } = {
    bytes: null,
    query: '',
    ids: null,
    found: null,
    editing: null,
    people: null,
    data: null,
  };

  function clearState(): void {
    state.bytes = null;
    state.query = '';
    state.ids = null;
    state.found = null;
    state.editing = null;
    state.people = null;
    state.data = null;
  }

  async function readBytes(): Promise<void> {
    try {
      state.bytes = await ctx.store.bytesInUse();
    } catch {
      state.bytes = null;
    }
  }

  /** Relê do armazenamento os registros das pessoas achadas. Quem foi apagado some. */
  async function refreshFound(): Promise<void> {
    if (state.ids === null) return;
    const ids = new Set(state.ids);
    const { items } = await ctx.store.listAllCandidates();
    state.found = items.filter((item) => ids.has(item.id));
    state.ids = state.found.map((item) => item.id);
  }

  function open(): void {
    clearState();
    ctx.go({ name: 'privacy' });
    void readBytes().then(() => ctx.redraw());
  }

  async function search(rawQuery: string): Promise<void> {
    const query = rawQuery.replace(/\p{Cs}/gu, '').trim();
    state.query = rawQuery;
    state.people = null;
    state.editing = null;
    if (query === '') {
      state.found = null;
      state.ids = null;
      ctx.ui.errors = { 'privacy-query': FIND.empty };
      ctx.redraw({ focusError: true });
      return;
    }
    ctx.ui.errors = {};
    try {
      const records = await findAllRecords(ctx.store, query);
      state.found = records;
      state.ids = records.map((item) => item.id);
      ctx.ui.banner = null;
    } catch {
      ctx.ui.banner = FIND.deleteFailed;
    }
    ctx.redraw();
  }

  function edit(candidateId: string | null): void {
    state.editing = candidateId;
    state.people = null;
    ctx.ui.errors = {};
    ctx.ui.drafts = {};
    ctx.redraw();
  }

  async function savePerson(candidateId: string, values: Record<string, string>): Promise<void> {
    const outcome = await correctPerson(ctx.store, candidateId, { name: values['name'] ?? '', link: values['link'] ?? '' });
    if (!outcome.ok) {
      const field = outcome.reason === 'no_name' ? 'person-name' : 'person-link';
      if (outcome.reason === 'not_found' || outcome.reason === 'save_failed') ctx.ui.banner = FIND_ERRORS[outcome.reason];
      ctx.ui.errors = outcome.reason === 'not_found' || outcome.reason === 'save_failed' ? {} : { [field]: FIND_ERRORS[outcome.reason] };
      ctx.ui.drafts = { name: values['name'] ?? '', link: values['link'] ?? '' };
      ctx.redraw({ focusError: true });
      return;
    }
    state.editing = null;
    state.people = FIND.corrected;
    ctx.ui.errors = {};
    ctx.ui.drafts = {};
    ctx.ui.banner = null;
    try {
      await refreshFound();
      await ctx.load();
    } catch {
      ctx.ui.banner = FIND_ERRORS.save_failed;
    }
    ctx.redraw();
  }

  async function exportPerson(candidateId: string): Promise<void> {
    const target = state.found?.find((item) => item.id === candidateId);
    if (target === undefined) return;
    try {
      const file = await ctx.store.exportPerson(target, ctx.now());
      startDownload(jsonBlob(file), `triagem-ficha-${dayText(ctx.now())}.json`);
      state.people = FIND.exported;
      ctx.ui.banner = null;
    } catch {
      state.people = null;
      ctx.ui.banner = FIND.exportFailed;
    }
    ctx.redraw();
  }

  async function exportEverything(): Promise<void> {
    try {
      await acceptFileExport(ctx.store, ctx.now());
      await ctx.load();
      const file = await ctx.store.exportAll(ctx.now());
      startDownload(jsonBlob(file), `triagem-tudo-${dayText(ctx.now())}.json`);
      state.data = DATA.exportDone;
      ctx.ui.banner = null;
    } catch {
      state.data = null;
      ctx.ui.banner = DATA.exportFailed;
    }
    ctx.redraw();
  }

  async function deletePerson(candidateId: string): Promise<void> {
    const target = state.found?.find((item) => item.id === candidateId);
    if (target === undefined) return ctx.go({ name: 'privacy' });
    try {
      const same = (state.found ?? []).filter((item) => (target.profileKey === null ? item.id === target.id : item.profileKey === target.profileKey));
      const count = await ctx.store.deletePerson(target);
      // Se o texto da última análise era desta pessoa, ele também sai da memória da sessão.
      const stored = await ctx.memory.read().catch(() => null);
      if (stored !== null && same.some((item) => item.id === stored.candidateId)) await ctx.memory.clear().catch(() => undefined);
      ctx.ui.analysis = null;
      await refreshFound();
      await ctx.load();
      await readBytes();
      ctx.go({ name: 'privacy' });
      state.people = FIND.deleted(count);
    } catch {
      ctx.go({ name: 'privacy' });
      ctx.ui.banner = FIND.deleteFailed;
    }
    ctx.redraw();
  }

  async function wipe(values: Record<string, string>): Promise<void> {
    if ((values['confirm'] ?? '').trim() !== DATA.wipeWord) {
      ctx.ui.errors = { 'wipe-confirm': DATA.wipeEmpty };
      ctx.ui.drafts = { confirm: values['confirm'] ?? '' };
      ctx.redraw({ focusError: true });
      return;
    }
    try {
      await ctx.store.wipeAll();
      await ctx.memory.clear().catch(() => undefined);
      await ctx.wipeSession?.().catch(() => undefined);
    } catch {
      ctx.ui.banner = DATA.wipeFailed;
      ctx.redraw();
      return;
    }
    // Volta à primeira abertura: nada do que havia na tela fica na memória do painel.
    clearState();
    ctx.ui.analysis = null;
    ctx.ui.suggestion = null;
    ctx.ui.filters = NO_FILTERS;
    ctx.ui.report = DEFAULT_REPORT_CHOICE;
    await ctx.load();
    ctx.go(HOME);
  }

  return {
    input: () => ({ bytes: state.bytes, query: state.query, found: state.found, editing: state.editing }),
    get peopleStatus() {
      return state.people;
    },
    get dataStatus() {
      return state.data;
    },
    open,
    run: (action) => {
      switch (action.id) {
        case 'open_privacy':
          open();
          return true;
        case 'back_privacy':
          ctx.go({ name: 'privacy' });
          return true;
        case 'delete_person':
          if (action.candidateId !== undefined) ctx.go({ name: 'privacy_delete', candidateId: action.candidateId });
          return true;
        case 'confirm_delete_person':
          if (action.candidateId !== undefined) void deletePerson(action.candidateId);
          return true;
        default:
          return false;
      }
    },
    search,
    edit,
    refresh: async () => {
      if (ctx.ui.step.name !== 'privacy' && ctx.ui.step.name !== 'privacy_delete') return;
      try {
        await refreshFound();
      } catch {
        state.found = null;
      }
      await readBytes();
    },
    savePerson,
    exportPerson,
    exportEverything,
    wipe,
    sync: () => {
      if (ctx.ui.step.name !== 'privacy' && ctx.ui.step.name !== 'privacy_delete') clearState();
      else {
        state.data = null;
        state.people = null;
      }
    },
  };
}
