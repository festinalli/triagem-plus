// Renderizador atômico: monta a árvore fora da tela e a aplica de uma vez com replaceChildren, devolvendo o foco ao
// equivalente do elemento que o tinha (chave data-focus-key ou id). Adaptado do kit da Candidata+ (src/panel/ui/render.ts,
// ramo onda-4), sem adiamento por campo em foco: nenhuma tela renderiza a cada tecla, só ao confirmar uma mudança.

export type BuildResult = Node | readonly Node[] | null | undefined;

function keyOf(element: Element | null): string | null {
  if (element === null) return null;
  const key = element.getAttribute('data-focus-key') ?? element.getAttribute('id');
  return key === null || key === '' ? null : key;
}

function findByKey(root: ParentNode, key: string): HTMLElement | null {
  for (const candidate of root.querySelectorAll<HTMLElement>('[data-focus-key], [id]')) {
    if (keyOf(candidate) === key) return candidate;
  }
  return null;
}

/** Aplica `build()` em `host` de uma vez. O foco que estava dentro de `host` volta ao elemento de mesma chave, se existir. */
export function render(host: HTMLElement, build: () => BuildResult): void {
  const result = build();
  const staged = host.ownerDocument.createDocumentFragment();
  if (Array.isArray(result)) {
    for (const node of result as readonly Node[]) staged.appendChild(node);
  } else if (result) {
    staged.appendChild(result as Node);
  }
  const active = host.ownerDocument.activeElement;
  const key = active !== null && host.contains(active) ? keyOf(active) : null;
  host.replaceChildren(staged);
  if (key !== null) findByKey(host, key)?.focus();
}
