// Armazenamento local da Triagem+ (ESPECIFICACAO seção 9). Um registro por chave: "settings", "meta", "job:<id>", "cand:<id>".
// Índices são calculados lendo tudo. Todas as operações passam por uma fila única, então duas chamadas seguidas não se perdem.
// Leitura nunca lança por causa de dado ruim: registro inválido é ignorado e contado em `skipped`.
import {
  RETENTION_DEFAULT_DAYS,
  RETENTION_MAX_DAYS,
  RETENTION_MIN_DAYS,
  SCHEMA_VERSION,
  STAGES,
} from '../model.ts';
import type {
  Acceptance,
  Candidate,
  CardTerm,
  Evidence,
  Job,
  MatchResult,
  MessageTemplate,
  ProfileCard,
  Requirement,
  RequirementResult,
  Settings,
} from '../model.ts';
import { normalize } from '../text/normalize.ts';
import type { KeyValueArea } from './area.ts';

const SETTINGS_KEY = 'settings';
const META_KEY = 'meta';
const JOB_PREFIX = 'job:';
const CAND_PREFIX = 'cand:';

export interface ListResult<T> {
  readonly items: T[];
  /** Quantos registros inválidos ou ilegíveis foram ignorados. */
  readonly skipped: number;
}

export interface Meta {
  readonly version: number;
}

export interface MetaInfo {
  readonly version: number;
  /** O armazenamento foi gravado por uma versão mais nova que esta. Nada é apagado nem rebaixado. */
  readonly newer: boolean;
}

export type UpsertOutcome = 'created' | 'updated';

export interface UpsertResult {
  readonly outcome: UpsertOutcome;
  readonly candidate: Candidate;
}

export interface PersonExport {
  readonly schemaVersion: number;
  readonly exportedAt: number;
  /** Só o título de cada vaga: o texto da vaga e os termos excluídos não são da pessoa. */
  readonly jobs: Array<Pick<Job, 'id' | 'title'>>;
  readonly candidates: Candidate[];
}

export interface FullExport {
  readonly schemaVersion: number;
  readonly exportedAt: number;
  readonly settings: Settings;
  readonly jobs: Job[];
  readonly candidates: Candidate[];
}

export type SettingsPatch = Partial<Settings>;

export interface Store {
  getSettings(): Promise<Settings>;
  updateSettings(patch: SettingsPatch): Promise<Settings>;
  readMeta(): Promise<MetaInfo>;
  bytesInUse(): Promise<number>;

  listJobs(): Promise<ListResult<Job>>;
  getJob(id: string): Promise<Job | null>;
  saveJob(job: Job): Promise<void>;
  deleteJob(id: string): Promise<void>;

  listCandidates(jobId: string): Promise<ListResult<Candidate>>;
  listAllCandidates(): Promise<ListResult<Candidate>>;
  getCandidate(id: string): Promise<Candidate | null>;
  saveCandidate(candidate: Candidate): Promise<void>;
  deleteCandidate(id: string): Promise<void>;
  deleteCandidates(ids: readonly string[]): Promise<number>;
  /** Muda só updatedAt (renovar prazo). Falso se não existe. */
  touchCandidate(id: string, now: number): Promise<boolean>;
  upsertByProfile(candidate: Candidate): Promise<UpsertResult>;

  findPeople(query: string): Promise<Candidate[]>;
  deletePerson(candidate: Candidate): Promise<number>;
  exportPerson(candidate: Candidate, now: number): Promise<PersonExport>;
  exportAll(now: number): Promise<FullExport>;
  wipeAll(): Promise<void>;
}

// ---------- validação e recusa de campos ----------

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);
const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);
function isStrArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isStr);
}

const SECTIONS = ['about', 'experience', 'skills', 'certifications', 'languages', 'projects'];
const BANDS = ['strong', 'partial', 'weak'];
const STATUSES = ['met', 'partial', 'not_found', 'needs_reanalysis'];
const NOTES = ['mentioned_only', 'time_not_measurable', 'check_profile'];
const KINDS = ['term', 'total_experience', 'language', 'certification', 'title_word'];
const IMPORTANCES = ['required', 'preferred'];

function oneOf(list: readonly string[], v: unknown): v is string {
  return isStr(v) && list.includes(v);
}
type Sections = ProfileCard['sectionsRead'];
function sectionList(v: unknown): Sections | null {
  return Array.isArray(v) && v.every((s) => oneOf(SECTIONS, s)) ? (v as Sections) : null;
}

function pickTerm(v: unknown): CardTerm | null {
  if (!isObj(v) || !isStr(v['key']) || !isNumOrNull(v['months']) || !isStrArray(v['jobTitles'])) return null;
  const sections = sectionList(v['sections']);
  if (!sections) return null;
  return { key: v['key'], sections: [...sections], months: v['months'], jobTitles: [...v['jobTitles']] };
}

function pickCard(v: unknown): ProfileCard | null {
  if (!isObj(v)) return null;
  const { totalMonths, currentTitle, terms, searchedFreeTerms, truncated } = v;
  const sectionsRead = sectionList(v['sectionsRead']);
  if (!isNumOrNull(totalMonths) || !isStrOrNull(currentTitle) || !Array.isArray(terms)) return null;
  if (!isStrArray(searchedFreeTerms) || !isBool(truncated) || !sectionsRead) return null;
  const picked: CardTerm[] = [];
  for (const t of terms) {
    const p = pickTerm(t);
    if (!p) return null;
    picked.push(p);
  }
  return {
    totalMonths,
    currentTitle,
    terms: picked,
    searchedFreeTerms: [...searchedFreeTerms],
    sectionsRead: [...sectionsRead],
    truncated,
  };
}

function pickEvidence(v: unknown): Evidence | null {
  if (!isObj(v) || !oneOf(SECTIONS, v['section']) || !isStr(v['term']) || !isStrArray(v['jobTitles']) || !isNumOrNull(v['months'])) {
    return null;
  }
  return { section: v['section'] as Evidence['section'], term: v['term'], jobTitles: [...v['jobTitles']], months: v['months'] };
}

function pickResult(v: unknown): RequirementResult | null {
  if (!isObj(v) || !isStr(v['requirementId']) || !oneOf(STATUSES, v['status']) || !isNum(v['credit']) || !Array.isArray(v['evidence'])) {
    return null;
  }
  const evidence: Evidence[] = [];
  for (const e of v['evidence']) {
    const p = pickEvidence(e);
    if (!p) return null;
    evidence.push(p);
  }
  const base = {
    requirementId: v['requirementId'],
    status: v['status'] as RequirementResult['status'],
    credit: v['credit'],
    evidence,
  };
  if (v['note'] === undefined) return base;
  if (!oneOf(NOTES, v['note'])) return null;
  return { ...base, note: v['note'] as NonNullable<RequirementResult['note']> };
}

function pickMatch(v: unknown): MatchResult | null {
  if (!isObj(v) || !isNum(v['score']) || !oneOf(BANDS, v['band']) || !Array.isArray(v['results'])) return null;
  if (!isNum(v['requiredMet']) || !isNum(v['requiredTotal'])) return null;
  const results: RequirementResult[] = [];
  for (const r of v['results']) {
    const p = pickResult(r);
    if (!p) return null;
    results.push(p);
  }
  return {
    score: v['score'],
    band: v['band'] as MatchResult['band'],
    results,
    requiredMet: v['requiredMet'],
    requiredTotal: v['requiredTotal'],
  };
}

/** Devolve o candidato só com os campos do modelo, ou null se a forma não serve. Qualquer campo extra é descartado (CA-10). */
function pickCandidate(v: unknown): Candidate | null {
  if (!isObj(v)) return null;
  if (!isStr(v['id']) || v['id'] === '' || !isStr(v['jobId']) || !isStr(v['name']) || !isStr(v['profileUrl'])) return null;
  if (!isStrOrNull(v['profileKey']) || !oneOf(STAGES, v['stage']) || !isBool(v['favorite']) || !isStr(v['notes'])) return null;
  if (!isNumOrNull(v['informedAt']) || !oneOf(['pasted', 'clicked'], v['source']) || !isNum(v['addedAt']) || !isNum(v['updatedAt'])) {
    return null;
  }
  const card = pickCard(v['card']);
  const match = pickMatch(v['match']);
  if (!card || !match) return null;
  return {
    id: v['id'],
    jobId: v['jobId'],
    name: v['name'],
    profileUrl: v['profileUrl'],
    profileKey: v['profileKey'],
    card,
    match,
    stage: v['stage'] as Candidate['stage'],
    favorite: v['favorite'],
    notes: v['notes'],
    informedAt: v['informedAt'],
    source: v['source'] as Candidate['source'],
    addedAt: v['addedAt'],
    updatedAt: v['updatedAt'],
  };
}

function pickRequirement(v: unknown): Requirement | null {
  if (!isObj(v) || !isStr(v['id']) || !oneOf(KINDS, v['kind']) || !oneOf(IMPORTANCES, v['importance']) || !isStr(v['label'])) {
    return null;
  }
  const base = {
    id: v['id'],
    kind: v['kind'] as Requirement['kind'],
    importance: v['importance'] as Requirement['importance'],
    label: v['label'],
  };
  const withCanon = isStr(v['canonical']) ? { ...base, canonical: v['canonical'] } : base;
  return isNum(v['minYears']) ? { ...withCanon, minYears: v['minYears'] } : withCanon;
}

function pickJob(v: unknown): Job | null {
  if (!isObj(v) || !isStr(v['id']) || v['id'] === '' || !isStr(v['title']) || !isStr(v['text'])) return null;
  if (!Array.isArray(v['requirements']) || !isStrArray(v['excludedTerms']) || !isBool(v['archived'])) return null;
  if (!isNum(v['createdAt']) || !isNum(v['updatedAt'])) return null;
  const requirements: Requirement[] = [];
  for (const r of v['requirements']) {
    const p = pickRequirement(r);
    if (!p) return null;
    requirements.push(p);
  }
  return {
    id: v['id'],
    title: v['title'],
    text: v['text'],
    requirements,
    excludedTerms: [...v['excludedTerms']],
    archived: v['archived'],
    createdAt: v['createdAt'],
    updatedAt: v['updatedAt'],
  };
}

export function defaultSettings(): Settings {
  return {
    responsibleName: '',
    responsibleContact: '',
    retentionDays: RETENTION_DEFAULT_DAYS,
    clickReadEnabled: false,
    activeJobId: null,
    messageTemplates: [],
    acceptances: {},
  };
}

function pickAcceptance(v: unknown): Acceptance | undefined {
  return isObj(v) && isNum(v['version']) && isNum(v['at']) ? { version: v['version'], at: v['at'] } : undefined;
}

function pickTemplates(v: unknown): MessageTemplate[] {
  if (!Array.isArray(v)) return [];
  const out: MessageTemplate[] = [];
  for (const t of v) {
    if (isObj(t) && isStr(t['id']) && isStr(t['title']) && isStr(t['body'])) out.push({ id: t['id'], title: t['title'], body: t['body'] });
  }
  return out;
}

function validRetention(v: unknown): v is number {
  return isNum(v) && Number.isInteger(v) && v >= RETENTION_MIN_DAYS && v <= RETENTION_MAX_DAYS;
}

/** Lê ajustes de forma tolerante: o que não presta volta ao padrão. */
function pickSettings(v: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(v)) return d;
  const acc = isObj(v['acceptances']) ? v['acceptances'] : {};
  const terms = pickAcceptance(acc['terms']);
  const clickRead = pickAcceptance(acc['clickRead']);
  const fileExport = pickAcceptance(acc['fileExport']);
  return {
    responsibleName: isStr(v['responsibleName']) ? v['responsibleName'] : d.responsibleName,
    responsibleContact: isStr(v['responsibleContact']) ? v['responsibleContact'] : d.responsibleContact,
    retentionDays: validRetention(v['retentionDays']) ? v['retentionDays'] : d.retentionDays,
    clickReadEnabled: isBool(v['clickReadEnabled']) ? v['clickReadEnabled'] : d.clickReadEnabled,
    activeJobId: isStr(v['activeJobId']) ? v['activeJobId'] : null,
    messageTemplates: pickTemplates(v['messageTemplates']),
    acceptances: {
      ...(terms ? { terms } : {}),
      ...(clickRead ? { clickRead } : {}),
      ...(fileExport ? { fileExport } : {}),
    },
  };
}

// ---------- a loja ----------

export function createStore(area: KeyValueArea): Store {
  let tail: Promise<unknown> = Promise.resolve();
  /** Fila única: cada operação começa depois que a anterior terminou, mesmo que ela tenha falhado. */
  function enqueue<T>(op: () => Promise<T>): Promise<T> {
    const run = tail.then(op, op);
    tail = run.catch(() => undefined);
    return run;
  }

  async function readMeta(): Promise<MetaInfo> {
    const raw = (await area.get([META_KEY]))[META_KEY];
    const version = isObj(raw) && isNum(raw['version']) ? raw['version'] : SCHEMA_VERSION;
    return { version, newer: version > SCHEMA_VERSION };
  }

  /** Garante o registro "meta". Se já existir (mesmo mais novo), deixa como está: nunca rebaixa. */
  async function ensureMeta(): Promise<void> {
    const raw = (await area.get([META_KEY]))[META_KEY];
    if (isObj(raw) && isNum(raw['version'])) return;
    const meta: Meta = { version: SCHEMA_VERSION };
    await area.set({ [META_KEY]: meta });
  }

  async function readSettings(): Promise<Settings> {
    return pickSettings((await area.get([SETTINGS_KEY]))[SETTINGS_KEY]);
  }

  async function readAll(): Promise<{ jobs: ListResult<Job>; candidates: ListResult<Candidate> }> {
    const all = await area.getAll();
    const jobs: Job[] = [];
    const candidates: Candidate[] = [];
    let jobSkipped = 0;
    let candSkipped = 0;
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(JOB_PREFIX)) {
        const job = pickJob(value);
        if (job && JOB_PREFIX + job.id === key) jobs.push(job);
        else jobSkipped++;
      } else if (key.startsWith(CAND_PREFIX)) {
        const cand = pickCandidate(value);
        if (cand && CAND_PREFIX + cand.id === key) candidates.push(cand);
        else candSkipped++;
      }
    }
    return { jobs: { items: jobs, skipped: jobSkipped }, candidates: { items: candidates, skipped: candSkipped } };
  }

  async function readCandidates(): Promise<ListResult<Candidate>> {
    return (await readAll()).candidates;
  }

  async function removeCandidatesOf(ids: readonly string[]): Promise<void> {
    await area.remove(ids.map((id) => CAND_PREFIX + id));
  }

  /** Mesma pessoa: mesmo profileKey não nulo; com chave nula, só o próprio registro. */
  function samePerson(a: Candidate, b: Candidate): boolean {
    return a.profileKey !== null ? b.profileKey === a.profileKey : b.id === a.id;
  }

  async function personRecords(candidate: Candidate): Promise<Candidate[]> {
    const { items } = await readCandidates();
    return items.filter((c) => samePerson(candidate, c));
  }

  async function writeCandidate(candidate: Candidate): Promise<Candidate> {
    const clean = pickCandidate(candidate);
    if (!clean) throw new TypeError('Candidato inválido.');
    await ensureMeta();
    await area.set({ [CAND_PREFIX + clean.id]: clean });
    return clean;
  }

  return {
    getSettings: () => enqueue(readSettings),

    updateSettings: (patch) =>
      enqueue(async () => {
        if (patch.retentionDays !== undefined && !validRetention(patch.retentionDays)) {
          throw new RangeError(`O prazo de guarda deve ser um número inteiro de ${RETENTION_MIN_DAYS} a ${RETENTION_MAX_DAYS} dias.`);
        }
        const merged = pickSettings({ ...(await readSettings()), ...patch });
        await ensureMeta();
        await area.set({ [SETTINGS_KEY]: merged });
        return merged;
      }),

    readMeta: () => enqueue(readMeta),
    bytesInUse: () => enqueue(() => area.bytesInUse()),

    listJobs: () => enqueue(async () => (await readAll()).jobs),

    getJob: (id) =>
      enqueue(async () => {
        const raw = (await area.get([JOB_PREFIX + id]))[JOB_PREFIX + id];
        return pickJob(raw);
      }),

    saveJob: (job) =>
      enqueue(async () => {
        const clean = pickJob(job);
        if (!clean) throw new TypeError('Vaga inválida.');
        await ensureMeta();
        await area.set({ [JOB_PREFIX + clean.id]: clean });
      }),

    deleteJob: (id) =>
      enqueue(async () => {
        const { items } = await readCandidates();
        await removeCandidatesOf(items.filter((c) => c.jobId === id).map((c) => c.id));
        await area.remove([JOB_PREFIX + id]);
        const settings = await readSettings();
        if (settings.activeJobId === id) await area.set({ [SETTINGS_KEY]: { ...settings, activeJobId: null } });
      }),

    listCandidates: (jobId) =>
      enqueue(async () => {
        const { items, skipped } = await readCandidates();
        return { items: items.filter((c) => c.jobId === jobId), skipped };
      }),

    listAllCandidates: () => enqueue(readCandidates),

    getCandidate: (id) => enqueue(async () => pickCandidate((await area.get([CAND_PREFIX + id]))[CAND_PREFIX + id])),

    saveCandidate: (candidate) =>
      enqueue(async () => {
        await writeCandidate(candidate);
      }),

    deleteCandidate: (id) => enqueue(() => removeCandidatesOf([id])),

    deleteCandidates: (ids) =>
      enqueue(async () => {
        await removeCandidatesOf(ids);
        return ids.length;
      }),

    touchCandidate: (id, now) =>
      enqueue(async () => {
        const current = pickCandidate((await area.get([CAND_PREFIX + id]))[CAND_PREFIX + id]);
        if (!current) return false;
        await writeCandidate({ ...current, updatedAt: now });
        return true;
      }),

    upsertByProfile: (candidate) =>
      enqueue(async (): Promise<UpsertResult> => {
        const incoming = pickCandidate(candidate);
        if (!incoming) throw new TypeError('Candidato inválido.');
        if (incoming.profileKey !== null) {
          const { items } = await readCandidates();
          const existing = items.find((c) => c.jobId === incoming.jobId && c.profileKey === incoming.profileKey);
          if (existing) {
            const merged: Candidate = {
              ...incoming,
              id: existing.id,
              name: existing.name,
              stage: existing.stage,
              favorite: existing.favorite,
              notes: existing.notes,
              informedAt: existing.informedAt,
              addedAt: existing.addedAt,
            };
            return { outcome: 'updated', candidate: await writeCandidate(merged) };
          }
        }
        return { outcome: 'created', candidate: await writeCandidate(incoming) };
      }),

    findPeople: (query) =>
      enqueue(async () => {
        const q = normalize(query);
        if (q === '') return [];
        const { items } = await readCandidates();
        return items.filter((c) => normalize(c.name).includes(q) || normalize(c.profileUrl).includes(q));
      }),

    deletePerson: (candidate) =>
      enqueue(async () => {
        const records = await personRecords(candidate);
        await removeCandidatesOf(records.map((c) => c.id));
        return records.length;
      }),

    exportPerson: (candidate, now) =>
      enqueue(async () => {
        const records = await personRecords(candidate);
        const jobIds = new Set(records.map((c) => c.jobId));
        const { jobs } = await readAll();
        return {
          schemaVersion: SCHEMA_VERSION,
          exportedAt: now,
          jobs: jobs.items.filter((j) => jobIds.has(j.id)).map((j) => ({ id: j.id, title: j.title })),
          candidates: records,
        };
      }),

    exportAll: (now) =>
      enqueue(async () => {
        const { jobs, candidates } = await readAll();
        return {
          schemaVersion: SCHEMA_VERSION,
          exportedAt: now,
          settings: await readSettings(),
          jobs: jobs.items,
          candidates: candidates.items,
        };
      }),

    wipeAll: () => enqueue(() => area.clear()),
  };
}
