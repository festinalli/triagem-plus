// Hyperscript seguro do painel: monta nós só com createElement, textContent/createTextNode e addEventListener. Nada aqui
// interpreta texto como marcação: não existe caminho que leve um valor variável a HTML, e atributos de manipulador (on*),
// estilo inline e atributos de URL fora de href são recusados (RNF-04).
// Adaptado do kit de tela da Candidata+ (src/panel/ui/h.ts, ramo onda-4), sem os tipos de link com marca e sem troca de documento.
//
// Contrato:
//   h(tag, props?, ...filhos)  tag de uma lista fechada; props só de uma lista fechada de atributos mais aria-* e data-*;
//                              filhos: texto, número, nó, listas (achatadas); false, null, undefined e true somem.
//   props.on                   { click: (evento) => ... }: o único caminho para eventos (addEventListener).
//   props.href                 só https ou caminho relativo, conferido em execução.
//   <form>                     nunca envia por navegação: o envio nativo é sempre cancelado.
// Um <button> sem type recebe type="button".
export type Href = string;

type Falsy = false | null | undefined;
export type ClassValue = string | Falsy | readonly ClassValue[];
export type Child = Node | string | number | boolean | null | undefined | readonly Child[];
type AttrValue = string | number | boolean | null | undefined;

export type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

export const TAGS = [
  'a', 'abbr', 'article', 'aside', 'b', 'blockquote', 'br', 'button', 'caption', 'code', 'dd', 'details', 'dialog',
  'div', 'dl', 'dt', 'em', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hr', 'i', 'input', 'kbd', 'label', 'legend', 'li', 'main', 'mark', 'meter', 'nav', 'ol', 'optgroup',
  'option', 'output', 'p', 'pre', 'progress', 'q', 's', 'samp', 'section', 'select', 'small', 'span', 'strong',
  'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'time', 'tr', 'u', 'ul',
  'var', 'wbr',
] as const satisfies readonly (keyof HTMLElementTagNameMap)[];

export type Tag = (typeof TAGS)[number];

const TAG_SET: ReadonlySet<string> = new Set(TAGS);

export interface HProps {
  class?: ClassValue;
  id?: string;
  role?: string;
  title?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  name?: string;
  type?: string;
  placeholder?: string;
  pattern?: string;
  autocomplete?: string;
  scope?: 'row' | 'col' | 'rowgroup' | 'colgroup';
  for?: string;
  form?: string;
  list?: string;
  accept?: string;
  wrap?: 'soft' | 'hard';
  spellcheck?: boolean | 'true' | 'false';
  inputmode?: string;
  enterkeyhint?: string;
  rel?: string;
  target?: '_blank' | '_self';
  download?: string;
  label?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  maxlength?: number;
  minlength?: number;
  rows?: number;
  cols?: number;
  colspan?: number;
  rowspan?: number;
  tabindex?: number;
  headers?: string;
  abbr?: string;
  datetime?: string;
  value?: string | number;
  hidden?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  multiple?: boolean;
  open?: boolean;
  novalidate?: boolean;
  autofocus?: boolean;
  inert?: boolean;
  checked?: boolean;
  selected?: boolean;
  href?: Href;
  aria?: Readonly<Record<string, AttrValue>>;
  data?: Readonly<Record<string, AttrValue>>;
  on?: Listeners;
  ref?: (element: HTMLElement) => void;
  [key: `aria-${string}`]: AttrValue;
  [key: `data-${string}`]: AttrValue;
}

const STRING_ATTRIBUTES: ReadonlySet<string> = new Set([
  'id', 'role', 'title', 'lang', 'dir', 'name', 'type', 'placeholder', 'pattern', 'autocomplete', 'scope', 'form', 'list',
  'accept', 'wrap', 'inputmode', 'enterkeyhint', 'rel', 'target', 'download', 'label', 'min', 'max', 'step',
  'maxlength', 'minlength', 'rows', 'cols', 'colspan', 'rowspan', 'tabindex', 'headers', 'abbr', 'datetime',
]);

/** Atributos enumerados "true"/"false": o booleano vira o texto, nunca presença (`spellcheck=false` não pode sumir). */
const ENUMERATED_BOOLEAN_ATTRIBUTES: ReadonlySet<string> = new Set(['spellcheck']);

const BOOLEAN_ATTRIBUTES: ReadonlySet<string> = new Set(['hidden', 'disabled', 'readonly', 'required', 'multiple', 'open', 'novalidate', 'autofocus', 'inert']);

/** Atributos recusados com mensagem própria: o motivo é mais útil do que "atributo desconhecido". */
const REFUSED: ReadonlyMap<string, string> = new Map([
  ['style', 'sem estilo inline: use as classes do kit (panel-css.test)'],
  ['srcdoc', 'documento de iframe montado por texto'],
  ['src', 'o painel não carrega recursos por src'],
  ['action', 'o painel não envia formulário por URL'],
  ['formaction', 'o painel não envia formulário por URL'],
  ['poster', 'o painel não carrega recursos por URL'],
  ['xlink:href', 'URL fora de href tipado'],
  ['innerhtml', 'inserção de HTML por texto (I-7)'],
  ['outerhtml', 'inserção de HTML por texto (I-7)'],
  ['innertext', 'use filhos de texto'],
  ['textcontent', 'use filhos de texto'],
]);

const ARIA_NAME = /^aria-[a-z]+$/;
const DATA_NAME = /^data-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EVENT_NAME = /^[a-z]+$/;

function fail(message: string): never {
  throw new TypeError(`h: ${message}`);
}

/** Lista (inclusive somente leitura): o Array.isArray do compilador não estreita readonly. */
function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** O objeto é literal simples (protótipo Object ou nulo)? Nó do DOM e lista não são. */
function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'nodeType' in value && typeof (value as { nodeType: unknown }).nodeType === 'number';
}

export function classNames(...values: ClassValue[]): string {
  const out: string[] = [];
  const visit = (value: ClassValue): void => {
    if (Array.isArray(value)) {
      for (const item of value as readonly ClassValue[]) visit(item);
    } else if (typeof value === 'string') {
      for (const token of value.split(/\s+/)) if (token !== '') out.push(token);
    } else if (value !== null && value !== undefined && value !== false) {
      fail(`classe inválida: ${String(value)}`);
    }
  };
  for (const value of values) visit(value);
  return out.join(' ');
}

/** Janelas de destino aceitas: a mesma ou uma nova (sem nome de janela, sem _top nem _parent). */
const TARGETS: ReadonlySet<string> = new Set(['_blank', '_self']);

/** Valores aceitos em href, em execução: só https e caminho relativo da própria extensão (RNF-04). */
export function isAllowedHrefValue(value: string): boolean {
  const compact = value.replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
  if (compact === '' || compact.startsWith('//') || compact.startsWith('\\')) return false;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  return scheme === undefined || scheme === 'https';
}

function putAttribute(element: HTMLElement, name: string, value: AttrValue): void {
  if (value === null || value === undefined || value === false) return;
  if (value === true) {
    element.setAttribute(name, '');
    return;
  }
  element.setAttribute(name, String(value));
}

function applyAria(element: HTMLElement, group: 'aria' | 'data', values: Readonly<Record<string, AttrValue>>): void {
  for (const [key, value] of Object.entries(values)) {
    const name = `${group}-${key}`;
    if (!(group === 'aria' ? ARIA_NAME : DATA_NAME).test(name)) fail(`nome inválido em ${group}: "${key}"`);
    if (group === 'aria' && typeof value === 'boolean') {
      element.setAttribute(name, value ? 'true' : 'false'); // aria-* booleano é texto "true"/"false", nunca presença
    } else {
      putAttribute(element, name, value);
    }
  }
}

function applyProps(element: HTMLElement, tag: string, props: HProps): (() => void)[] {
  const after: (() => void)[] = [];
  const { href, class: cls, on, ref, aria, data, value, checked, selected, ...rest } = props;

  if (cls !== undefined) {
    const joined = classNames(cls);
    if (joined !== '') element.setAttribute('class', joined);
  }

  for (const [name, raw] of Object.entries(rest) as [string, AttrValue | undefined][]) {
    const lower = name.toLowerCase();
    if (lower.startsWith('on')) fail(`atributo "${name}" recusado: eventos só por props.on (addEventListener)`);
    const refused = REFUSED.get(lower);
    if (refused !== undefined) fail(`atributo "${name}" recusado: ${refused}`);
    if (ARIA_NAME.test(name) || DATA_NAME.test(name)) {
      if (ARIA_NAME.test(name) && typeof raw === 'boolean') element.setAttribute(name, raw ? 'true' : 'false');
      else putAttribute(element, name, raw);
    } else if (name === 'for') {
      putAttribute(element, 'for', raw);
    } else if (ENUMERATED_BOOLEAN_ATTRIBUTES.has(name)) {
      if (raw === undefined || raw === null) continue;
      if (typeof raw === 'boolean') element.setAttribute(name, raw ? 'true' : 'false');
      else if (raw === 'true' || raw === 'false') element.setAttribute(name, raw);
      else fail(`"${name}" aceita true ou false`);
    } else if (BOOLEAN_ATTRIBUTES.has(name)) {
      if (raw !== undefined && raw !== null && typeof raw !== 'boolean') fail(`"${name}" é booleano`);
      if (raw === true) element.setAttribute(name, '');
    } else if (STRING_ATTRIBUTES.has(name)) {
      if (raw === true) fail(`"${name}" não é booleano`);
      putAttribute(element, name, raw);
    } else {
      fail(`atributo "${name}" não permitido`);
    }
  }

  const target = element.getAttribute('target');
  if (target !== null) {
    if (!TARGETS.has(target)) fail(`target "${target}" não permitido (use _blank ou _self)`);
    // Toda janela nova nasce sem ligação com a do painel, mesmo se o tipo for contornado.
    if (target !== '_self') element.setAttribute('rel', 'noopener noreferrer');
  }
  if (href !== undefined && href !== null) {
    if (tag !== 'a') fail('href só em <a>');
    if (typeof href !== 'string' || !isAllowedHrefValue(href)) fail('href recusado (só https ou caminho relativo)');
    element.setAttribute('href', href);
  }
  if (element.hasAttribute('download') && tag !== 'a') fail('download só em <a>');

  if (aria) applyAria(element, 'aria', aria);
  if (data) applyAria(element, 'data', data);

  if (value !== undefined && value !== null) {
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      // select só aceita o valor depois de ter as opções, então vai para depois dos filhos
      after.push(() => {
        (element as HTMLInputElement).value = String(value);
      });
    } else {
      element.setAttribute('value', String(value));
    }
  }
  if (checked !== undefined) {
    if (checked) element.setAttribute('checked', '');
    after.push(() => {
      (element as HTMLInputElement).checked = checked === true;
    });
  }
  if (selected !== undefined) {
    if (selected) element.setAttribute('selected', '');
    after.push(() => {
      (element as HTMLOptionElement).selected = selected === true;
    });
  }

  if (on) {
    for (const [event, handler] of Object.entries(on)) {
      if (!EVENT_NAME.test(event)) fail(`nome de evento inválido: "${event}"`);
      if (handler === undefined) continue;
      if (typeof handler !== 'function') fail(`on.${event} precisa ser função`);
      element.addEventListener(event, handler as EventListener);
    }
  }
  if (ref) {
    if (typeof ref !== 'function') fail('ref precisa ser função');
    after.push(() => ref(element));
  }
  return after;
}

function appendChildren(parent: Node, children: readonly Child[], doc: Document): void {
  for (const child of children) {
    if (child === null || child === undefined || typeof child === 'boolean') continue;
    if (Array.isArray(child)) {
      appendChildren(parent, child as readonly Child[], doc);
    } else if (typeof child === 'string') {
      parent.appendChild(doc.createTextNode(child));
    } else if (typeof child === 'number') {
      parent.appendChild(doc.createTextNode(String(child)));
    } else if (isNode(child)) {
      parent.appendChild(child);
    } else {
      fail(`filho inválido: ${Object.prototype.toString.call(child)}`);
    }
  }
}

export function h<K extends Tag>(tag: K, props?: HProps | null, ...children: Child[]): HTMLElementTagNameMap[K];
export function h<K extends Tag>(tag: K, ...children: Child[]): HTMLElementTagNameMap[K];
export function h(tag: string, second?: HProps | Child | null, ...rest: Child[]): HTMLElement {
  if (!TAG_SET.has(tag)) fail(`tag "${tag}" não permitida`);
  const doc = document;
  const element = doc.createElement(tag);
  let props: HProps | null = null;
  let children: Child[] = rest;
  if (second === null || second === undefined) {
    // sem props
  } else if (typeof second === 'object' && !isList(second) && !('nodeType' in second) && isPlainObject(second)) {
    props = second;
  } else {
    children = [second as Child, ...rest];
  }
  // O painel não envia formulário por navegação: um <form> montado direto por h (sem o componente Form) também não
  // recarrega a página com os campos na URL no Enter. O listener entra antes dos de props.on.
  if (tag === 'form') element.addEventListener('submit', (event) => event.preventDefault());
  const after = props ? applyProps(element, tag, props) : [];
  if (tag === 'button' && !element.hasAttribute('type')) element.setAttribute('type', 'button');
  if (children.length === 1 && typeof children[0] === 'string') {
    element.textContent = children[0];
  } else {
    appendChildren(element, children, doc);
  }
  for (const run of after) run();
  return element;
}

/** Vários nós sem pai. */
