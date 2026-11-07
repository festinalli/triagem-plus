// Guarda o que a pessoa já digitou nos campos antes de a tela ser redesenhada por uma mudança vinda de outra janela, e
// devolve depois. Só vale para o que foi mexido (valor diferente do inicial), então o que não mudou segue o dado novo.

export interface KeptField {
  readonly key: string;
  readonly value: string;
  readonly checked: boolean;
}

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function keyOf(field: Field): string {
  return field.id !== '' ? `#${field.id}` : field.name !== '' ? `[${field.name}]` : '';
}

function touched(field: Field): boolean {
  if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) return field.checked !== field.defaultChecked;
  if (field instanceof HTMLInputElement && (field.type === 'hidden' || field.type === 'submit' || field.type === 'button')) return false;
  if (field instanceof HTMLSelectElement) return Array.from(field.options).some((option) => option.selected !== option.defaultSelected);
  return field.value !== field.defaultValue;
}

export function captureFields(root: ParentNode): KeptField[] {
  const kept: KeptField[] = [];
  for (const field of root.querySelectorAll<Field>('input, textarea, select')) {
    const key = keyOf(field);
    if (key === '' || !touched(field)) continue;
    kept.push({ key, value: field.value, checked: field instanceof HTMLInputElement ? field.checked : false });
  }
  return kept;
}

export function restoreFields(root: ParentNode, kept: readonly KeptField[]): void {
  for (const item of kept) {
    const field = Array.from(root.querySelectorAll<Field>('input, textarea, select')).find((candidate) => keyOf(candidate) === item.key);
    if (field === undefined) continue;
    if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) field.checked = item.checked;
    else field.value = item.value;
  }
}
