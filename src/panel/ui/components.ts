// Componentes do painel: funções que devolvem elementos já com as classes de components.css, o papel e os rótulos certos.
// Adaptado do kit da Candidata+ (src/panel/ui/components.ts, ramo onda-4): ficaram só botão, link-botão, campos, aviso,
// estado e divulgação. O kit não tem texto próprio: todo texto vem de quem chama (src/panel/strings.ts).
import { h } from './h.ts';
import type { Child, ClassValue } from './h.ts';

let idCounter = 0;

/** Id novo para ligar rótulo e controle quando a tela não tem um estável. */
export function uniqueId(prefix = 'tr'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function requireText(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${what}: o texto é obrigatório (nome acessível)`);
  return value;
}

export type Tone = 'info' | 'attention' | 'error' | 'success';

/** Ícone de cada tom, em texto (sem imagem, sem rede). Escondido dos leitores de tela: o texto ao lado diz o mesmo. */
export const TONE_ICONS: Readonly<Record<Tone, string>> = Object.freeze({ info: 'ℹ', attention: '⚠', error: '✖', success: '✔' });

// ---------------------------------------------------------------------------------------------------------
// Botões

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
  disabled?: boolean;
  block?: boolean;
  id?: string;
  /** Chave do foco: o botão refeito recebe o foco de volta se o antigo o tinha. */
  focusKey?: string;
  /** Nome acessível mais longo que o texto (por exemplo, com o nome da vaga). Deve começar pelo texto visível. */
  ariaLabel?: string;
  describedBy?: string;
  onClick?: (event: MouseEvent) => void;
}

export function Button(props: ButtonProps): HTMLButtonElement {
  const label = requireText(props.label, 'Button');
  const variant = props.variant ?? 'secondary';
  const onClick = props.onClick;
  return h(
    'button',
    {
      class: ['tr-btn', `tr-btn--${variant}`, props.block && 'tr-btn--block'],
      type: props.type ?? 'button',
      disabled: props.disabled === true,
      'aria-describedby': props.describedBy,
      'aria-label': props.ariaLabel,
      id: props.id,
      'data-focus-key': props.focusKey,
      on: onClick ? { click: onClick } : undefined,
    },
    h('span', { class: 'tr-btn__label' }, label),
  );
}

/** Link que parece botão e abre em aba nova, sem ligação com o painel. Só https (h confere de novo). */
export function LinkButton(props: { label: string; href: string; variant?: ButtonVariant; describedBy?: string }): HTMLAnchorElement {
  return h(
    'a',
    {
      class: ['tr-btn', `tr-btn--${props.variant ?? 'secondary'}`],
      href: props.href,
      target: '_blank',
      'aria-describedby': props.describedBy,
    },
    h('span', { class: 'tr-btn__label' }, requireText(props.label, 'LinkButton')),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Estado, divulgação

export type PillStatus = 'success' | 'attention' | 'error' | 'info' | 'neutral';

export const PILL_ICONS: Readonly<Record<PillStatus, string>> = Object.freeze({ success: '✔', attention: '⚠', error: '✖', info: 'ℹ', neutral: '•' });

/** Estado com ícone e texto, sempre os dois: a cor nunca é o único sinal. */
export function StatusPill(props: { status: PillStatus; label: string }): HTMLSpanElement {
  return h(
    'span',
    { class: ['tr-pill', props.status !== 'neutral' && `tr-pill--${props.status}`] },
    h('span', { class: 'tr-pill__icon', 'aria-hidden': 'true' }, PILL_ICONS[props.status]),
    h('span', { class: 'tr-pill__text' }, requireText(props.label, 'StatusPill')),
  );
}

export function Disclosure(props: { summary: string; children?: Child; open?: boolean }): HTMLDetailsElement {
  return h(
    'details',
    { class: 'tr-disclosure', open: props.open === true },
    h('summary', { class: 'tr-disclosure__summary' }, requireText(props.summary, 'Disclosure')),
    h('div', { class: 'tr-disclosure__body' }, props.children),
  );
}

export interface NoticeProps {
  tone?: Tone;
  title?: string;
  text?: string;
  children?: Child;
  /** Anuncia o aviso quando ele entra na página (role status; alert para erro). */
  live?: boolean;
  class?: ClassValue;
}

export function Notice(props: NoticeProps): HTMLDivElement {
  const tone = props.tone ?? 'info';
  return h(
    'div',
    { class: ['tr-notice', tone !== 'info' && `tr-notice--${tone}`, props.class], role: props.live ? (tone === 'error' ? 'alert' : 'status') : undefined },
    h('span', { class: 'tr-notice__icon', 'aria-hidden': 'true' }, TONE_ICONS[tone]),
    h(
      'div',
      { class: 'tr-notice__body' },
      props.title ? h('p', { class: 'tr-notice__title' }, props.title) : null,
      props.text ? h('p', { class: 'tr-notice__text' }, props.text) : null,
      props.children,
    ),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Formulário

export type FieldAttrs = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: 'true';
  required?: boolean;
};

export interface FieldProps {
  /** Id estável do controle (o foco é restaurado por ele depois de renderizar de novo). */
  id: string;
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  /** Recebe os atributos que ligam o controle ao rótulo, à ajuda e ao erro. */
  control: (attrs: FieldAttrs) => HTMLElement;
}

/** Campo: rótulo, controle, ajuda e erro, ligados por for, aria-describedby e aria-invalid. */
export function Field(props: FieldProps): HTMLDivElement {
  const label = requireText(props.label, 'Field');
  const describedBy: string[] = [];
  const helpId = `${props.id}-help`;
  const errorId = `${props.id}-error`;
  if (props.help) describedBy.push(helpId);
  if (props.error) describedBy.push(errorId);
  const attrs: FieldAttrs = { id: props.id };
  if (describedBy.length > 0) attrs['aria-describedby'] = describedBy.join(' ');
  if (props.error) attrs['aria-invalid'] = 'true';
  if (props.required) attrs.required = true;
  return h(
    'div',
    { class: ['tr-field', props.error && 'tr-field--invalid'] },
    h('label', { class: 'tr-field__label', for: props.id }, label, props.required ? h('span', { class: 'tr-field__required', 'aria-hidden': 'true' }, ' *') : null),
    props.control(attrs),
    props.help ? h('p', { class: 'tr-field__help', id: helpId }, props.help) : null,
    props.error
      ? h('p', { class: 'tr-field__error', id: errorId }, h('span', { class: 'tr-field__error-icon', 'aria-hidden': 'true' }, TONE_ICONS.error), h('span', null, props.error))
      : null,
  );
}

interface FieldBase {
  id: string;
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  name?: string;
}

export interface TextFieldProps extends FieldBase {
  type?: 'text' | 'email' | 'tel' | 'number';
  hideLabel?: boolean;
  value?: string;
  autocomplete?: string;
  inputmode?: string;
  maxlength?: number;
  min?: number;
  max?: number;
  onChange?: (value: string, event: Event) => void;
}

export function TextField(props: TextFieldProps): HTMLDivElement {
  const field = Field({
    id: props.id,
    label: props.label,
    help: props.help,
    error: props.error,
    required: props.required,
    control: (attrs) =>
      h('input', {
        ...attrs,
        class: 'tr-input',
        type: props.type ?? 'text',
        name: props.name ?? props.id,
        autocomplete: props.autocomplete ?? 'off',
        inputmode: props.inputmode,
        maxlength: props.maxlength,
        min: props.min,
        max: props.max,
        value: props.value ?? '',
        on: props.onChange ? { change: (event: Event) => props.onChange?.((event.target as HTMLInputElement).value, event) } : undefined,
      }),
  });
  if (props.hideLabel) field.querySelector('label')?.classList.add('tr-visually-hidden');
  return field;
}

export interface TextAreaFieldProps extends FieldBase {
  value?: string;
  rows?: number;
  maxlength?: number;
  readonly?: boolean;
}

export function TextAreaField(props: TextAreaFieldProps): HTMLDivElement {
  return Field({
    id: props.id,
    label: props.label,
    help: props.help,
    error: props.error,
    required: props.required,
    control: (attrs) =>
      h('textarea', {
        ...attrs,
        class: 'tr-textarea',
        name: props.name ?? props.id,
        rows: props.rows ?? 4,
        maxlength: props.maxlength,
        readonly: props.readonly === true,
        value: props.value ?? '',
      }),
  });
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends FieldBase {
  options: readonly SelectOption[];
  value?: string;
  /** Rótulo só para leitor de tela (a linha já mostra o contexto). */
  hideLabel?: boolean;
  onChange?: (value: string, event: Event) => void;
}

export function SelectField(props: SelectFieldProps): HTMLDivElement {
  const field = Field({
    id: props.id,
    label: props.label,
    help: props.help,
    error: props.error,
    required: props.required,
    control: (attrs) =>
      h(
        'select',
        {
          ...attrs,
          class: 'tr-select',
          name: props.name ?? props.id,
          value: props.value,
          on: props.onChange ? { change: (event: Event) => props.onChange?.((event.target as HTMLSelectElement).value, event) } : undefined,
        },
        props.options.map((option) => h('option', { value: option.value }, option.label)),
      ),
  });
  if (props.hideLabel) field.querySelector('label')?.classList.add('tr-visually-hidden');
  return field;
}

export interface RadioGroupProps {
  /** Nome do grupo (vira o name de cada rádio e a base dos ids). */
  name: string;
  legend: string;
  options: readonly { value: string; label: string }[];
  value?: string;
  onChange?: (value: string, event: Event) => void;
}

export function RadioGroup(props: RadioGroupProps): HTMLFieldSetElement {
  return h(
    'fieldset',
    { class: 'tr-field' },
    h('legend', { class: 'tr-field__label' }, requireText(props.legend, 'RadioGroup')),
    props.options.map((option) =>
      h(
        'label',
        { class: 'tr-check', for: `${props.name}-${option.value}` },
        h('input', {
          class: 'tr-check__input',
          type: 'radio',
          id: `${props.name}-${option.value}`,
          name: props.name,
          value: option.value,
          checked: props.value === option.value,
          on: props.onChange ? { change: (event: Event) => props.onChange?.((event.target as HTMLInputElement).value, event) } : undefined,
        }),
        h('span', { class: 'tr-check__text' }, option.label),
      ),
    ),
  );
}

export interface CheckboxProps {
  id: string;
  label: string;
  checked?: boolean;
  name?: string;
  /** Ajuda ligada ao campo (id de outro elemento). */
  describedBy?: string;
  onChange?: (checked: boolean, event: Event) => void;
}

/** Caixa de seleção com o rótulo ao lado (o rótulo é o próprio <label>, clicável). */
export function Checkbox(props: CheckboxProps): HTMLDivElement {
  return h(
    'div',
    { class: 'tr-field' },
    h(
      'label',
      { class: 'tr-check', for: props.id },
      h('input', {
        class: 'tr-check__input',
        type: 'checkbox',
        id: props.id,
        name: props.name ?? props.id,
        checked: props.checked === true,
        'aria-describedby': props.describedBy,
        on: props.onChange ? { change: (event: Event) => props.onChange?.((event.target as HTMLInputElement).checked, event) } : undefined,
      }),
      h('span', { class: 'tr-check__text' }, requireText(props.label, 'Checkbox')),
    ),
  );
}

export function Form(props: { children: Child; label: string; onSubmit: (form: HTMLFormElement) => void }): HTMLFormElement {
  return h(
    'form',
    {
      class: 'tr-form',
      novalidate: true,
      'aria-label': props.label,
      on: {
        submit: (event: SubmitEvent) => {
          event.preventDefault();
          props.onSubmit(event.currentTarget as HTMLFormElement);
        },
      },
    },
    props.children,
  );
}

/** Valores de um formulário, só dos campos com name. Caixa de seleção marcada vale "on"; desmarcada não aparece. */
export function formValues(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of new FormData(form).entries()) if (typeof value === 'string') out[key] = value;
  return out;
}
