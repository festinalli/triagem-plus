import type { RawResult, ResultsRead } from '../core/results/parse.ts';

/**
 * Lê as pessoas da página de resultados aberta (D-09, RF-38). É enviada ao navegador por scripting.executeScript({ func }), então
 * precisa ser autossuficiente: usa só `document` e `location`, nada do módulo. Só lê: não rola, não clica e não abre nada.
 *
 * Não usa nomes de classe do site, que mudam sem aviso. Parte dos links de perfil e sobe até o cartão: o item de lista mais
 * externo que ainda é de poucas pessoas, porque as conexões em comum podem ser links de perfil dentro do mesmo cartão.
 * O primeiro link do cartão é o dono dele.
 */
export function readResults(): ResultsRead {
  const MAX_ITEMS = 40;
  const MAX_TEXT_CHARS = 3000;
  const MAX_PEOPLE_IN_CARD = 4;
  const LINK = 'a[href*="/in/"]';
  const ITEM = 'li, [role="listitem"]';

  const root: Element = document.querySelector('main') ?? document.body;

  const slugOf = (link: Element): string | null => {
    try {
      const url = new URL((link as HTMLAnchorElement).href);
      if (!/(?:^|\.)linkedin\.com$/u.test(url.hostname)) return null;
      return /^\/in\/([^/?#]+)/u.exec(url.pathname)?.[1]?.toLowerCase() ?? null;
    } catch {
      return null;
    }
  };
  const peopleIn = (element: Element): Set<string> => {
    const slugs = new Set<string>();
    for (const link of Array.from(element.querySelectorAll(LINK))) {
      const slug = slugOf(link);
      if (slug !== null) slugs.add(slug);
    }
    return slugs;
  };
  const outerItem = (element: Element): Element | null => {
    const outer = element.parentElement?.closest(ITEM) ?? null;
    return outer !== null && root.contains(outer) ? outer : null;
  };
  const cardOf = (link: Element, slug: string): Element => {
    let item = link.closest(ITEM);
    if (item !== null && root.contains(item)) {
      for (let outer = outerItem(item); outer !== null && peopleIn(outer).size <= MAX_PEOPLE_IN_CARD; outer = outerItem(item)) item = outer;
      return item;
    }
    // Sem lista na página: sobe enquanto o bloco for só desta pessoa.
    let node = link;
    while (node.parentElement !== null && node.parentElement !== root) {
      const people = peopleIn(node.parentElement);
      if (people.size !== 1 || !people.has(slug)) break;
      node = node.parentElement;
    }
    return node;
  };
  const visibleName = (link: Element): string => {
    const shown = link.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    return (shown?.innerText || (link as HTMLElement).innerText || '').trim();
  };

  const owners = new Map<Element, { slug: string; href: string; name: string }>();
  for (const link of Array.from(root.querySelectorAll(LINK))) {
    if (link.closest('header, nav, footer, aside') !== null) continue;
    const slug = slugOf(link);
    if (slug === null) continue;
    const card = cardOf(link, slug);
    const owner = owners.get(card);
    if (owner === undefined) {
      if (owners.size >= MAX_ITEMS) break;
      owners.set(card, { slug, href: (link as HTMLAnchorElement).href, name: visibleName(link) });
    } else if (owner.slug === slug && owner.name === '') {
      owner.name = visibleName(link);
    }
  }

  const items: RawResult[] = [];
  owners.forEach((owner, card) => {
    items.push({ href: owner.href, name: owner.name, text: ((card as HTMLElement).innerText ?? '').slice(0, MAX_TEXT_CHARS) });
  });
  return { url: location.href, items };
}
