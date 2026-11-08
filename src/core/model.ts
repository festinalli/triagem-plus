// Modelo de dados da Triagem+ (ESPECIFICACAO, seção 9). Puro: sem Chrome e sem DOM. Datas são milissegundos desde 1970.
// Este arquivo é o contrato entre as partes: mudar uma forma aqui é decisão, não detalhe de quem está usando.

/** Versão do formato guardado. Sobe quando a forma de um registro muda. */
export const SCHEMA_VERSION = 1;

export type Importance = 'required' | 'preferred';

/** term: stack ou ferramenta. total_experience: anos no total. title_word: palavra de cargo ou senioridade (RF-12). */
export type RequirementKind = 'term' | 'total_experience' | 'language' | 'certification' | 'title_word';

export interface Requirement {
  readonly id: string;
  readonly kind: RequirementKind;
  readonly importance: Importance;
  /** Como aparece na tela. */
  readonly label: string;
  /** Nome canônico quando veio da lista de termos. Ausente em texto livre. */
  readonly canonical?: string;
  /** Anos mínimos. Opcional em term, obrigatório em total_experience, ausente nos demais. Nunca há teto (RF-14). */
  readonly minYears?: number;
}

export interface Job {
  readonly id: string;
  readonly title: string;
  /** Texto colado da vaga. Não tem dado de candidato. */
  readonly text: string;
  readonly requirements: readonly Requirement[];
  /** Termos que a pessoa quer excluir da busca (NOT). Passam pela trava (RF-13). */
  readonly excludedTerms: readonly string[];
  readonly archived: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** A lista fechada de seções que contam (RF-41). `listing` é o que a página de resultados mostra: título e trecho (RF-38). */
export type ProfileSection = 'about' | 'experience' | 'skills' | 'certifications' | 'languages' | 'projects' | 'listing';

export interface CardTerm {
  /** Nome canônico da lista de termos ou, em termo livre, o texto normalizado. */
  readonly key: string;
  /** Onde apareceu. */
  readonly sections: readonly ProfileSection[];
  /** Meses medidos pela união dos períodos das experiências que citam o termo. Nulo se não deu para medir. */
  readonly months: number | null;
  /** Até 3 cargos em que apareceu, sem empresa nem local. */
  readonly jobTitles: readonly string[];
}

/** A ficha: o único resumo do perfil que fica guardado (RF-45, DP-10). Nunca tem texto livre do perfil. */
export interface ProfileCard {
  readonly totalMonths: number | null;
  /** Cargo da experiência mais recente. */
  readonly currentTitle: string | null;
  readonly terms: readonly CardTerm[];
  /** Termos livres procurados na análise. Quem não foi procurado precisa de nova análise (RF-55). */
  readonly searchedFreeTerms: readonly string[];
  readonly sectionsRead: readonly ProfileSection[];
  /** Há sinal de lista cortada ("Exibir todas", "Show all") (RF-35). */
  readonly truncated: boolean;
}

export type RequirementStatus = 'met' | 'partial' | 'not_found' | 'needs_reanalysis';

/** Motivo mostrado junto do resultado, quando há um (Apêndice A). */
export type ResultNote = 'mentioned_only' | 'time_not_measurable' | 'check_profile' | 'not_in_listing';

export interface Evidence {
  readonly section: ProfileSection;
  /** O termo como aparece na lista, nunca um trecho do perfil (RF-51). */
  readonly term: string;
  readonly jobTitles: readonly string[];
  readonly months: number | null;
}

export interface RequirementResult {
  readonly requirementId: string;
  readonly status: RequirementStatus;
  /** De 0 a 1 (Apêndice A). */
  readonly credit: number;
  readonly evidence: readonly Evidence[];
  readonly note?: ResultNote;
}

export type Band = 'strong' | 'partial' | 'weak';

export interface MatchResult {
  /** Inteiro de 0 a 100. */
  readonly score: number;
  readonly band: Band;
  readonly results: readonly RequirementResult[];
  readonly requiredMet: number;
  readonly requiredTotal: number;
}

export const STAGES = ['new', 'reviewing', 'contacted', 'interview', 'offer', 'closed'] as const;
export type Stage = (typeof STAGES)[number];

export interface Candidate {
  readonly id: string;
  readonly jobId: string;
  readonly name: string;
  readonly profileUrl: string;
  /** O trecho /in/<nome>/ do link, em minúsculas. Reconhece o mesmo perfil (RF-34, RF-64). Nulo fora do padrão. */
  readonly profileKey: string | null;
  readonly card: ProfileCard;
  readonly match: MatchResult;
  readonly stage: Stage;
  readonly favorite: boolean;
  readonly notes: string;
  readonly informedAt: number | null;
  readonly source: 'pasted' | 'clicked' | 'results';
  readonly addedAt: number;
  readonly updatedAt: number;
}

export interface Acceptance {
  readonly version: number;
  readonly at: number;
}

export interface MessageTemplate {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export const RETENTION_DEFAULT_DAYS = 180;
export const RETENTION_MIN_DAYS = 30;
export const RETENTION_MAX_DAYS = 365;

export interface Settings {
  readonly responsibleName: string;
  readonly responsibleContact: string;
  readonly retentionDays: number;
  readonly clickReadEnabled: boolean;
  readonly activeJobId: string | null;
  readonly messageTemplates: readonly MessageTemplate[];
  readonly acceptances: {
    readonly terms?: Acceptance;
    readonly clickRead?: Acceptance;
    readonly fileExport?: Acceptance;
  };
}
