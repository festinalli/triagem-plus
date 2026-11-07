// Capturas das telas da triagem em 360 px de largura, nos temas claro e escuro, para conferir a olho. Só roda com
// TRIAGEM_SHOTS_DIR apontando para uma pasta. Também confere o contraste do texto e a falta de rolagem na horizontal.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import { ROOT, launch, openPanel, resetSession, resetStorage, trapLinkedIn } from './harness.ts';
import type { Harness } from './harness.ts';
import { pasteOnScreen, requirement, seeds15, seedWorkspace } from './panel-triage-kit.ts';

const DIST = path.join(ROOT, 'dist');
const SHOTS = process.env.TRIAGEM_SHOTS_DIR;
const fixture = (name: string): string => fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'profiles', `${name}.txt`), 'utf8');

describe('capturas da triagem', { timeout: 300_000, skip: SHOTS === undefined ? 'defina TRIAGEM_SHOTS_DIR para gerar as capturas' : false }, () => {
  let h: Harness;
  before(async () => {
    h = await launch(DIST);
    await trapLinkedIn(h);
    fs.mkdirSync(SHOTS as string, { recursive: true });
  });
  after(async () => {
    await (h as Harness | undefined)?.close();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`telas da triagem em 360 px, tema ${scheme}`, async () => {
      await resetStorage(h);
      await resetSession(h);
      const people = seeds15().map((person, index) => (index === 4 ? { ...person, ageDays: 176 } : person));
      await seedWorkspace(h, people, { requirements: [requirement('term', 'Java', 'required', 5), requirement('term', 'Spring'), requirement('term', 'Kubernetes', 'preferred')] });
      const { page, errors } = await openPanel(h);
      await page.setViewportSize({ width: 360, height: 760 });
      await page.emulateMedia({ colorScheme: scheme });
      let n = 0;
      const shoot = async (name: string): Promise<void> => {
        n += 1;
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(SHOTS as string, `${String(n).padStart(2, '0')}-${name}-${scheme}.png`), fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, `rolagem horizontal em ${name}`);
        await contrastAudit(page, `${name} (${scheme})`);
      };

      // Reabrir: o Top 10 vem da lista.
      await page.locator('[data-kind="top_ten"]').waitFor();
      await shoot('top10-ao-abrir');

      // Colar.
      await page.getByRole('button', { name: 'Colar um perfil' }).first().click();
      await page.getByRole('heading', { name: 'Colar o perfil', level: 2 }).waitFor();
      await shoot('colar-vazio');
      await page.getByLabel('Texto do perfil').fill(fixture('pt-um-cargo'));
      await page.getByLabel('Link do perfil').fill('https://exemplo.test/clara');
      await shoot('colar-preenchido-link-fora-do-padrao');
      await page.getByRole('button', { name: 'Analisar', exact: true }).click();
      await page.getByRole('heading', { name: 'Análise: Clara Fictícia Exemplo', level: 2 }).waitFor();
      await shoot('analise-resultado-e-top10');

      // Uma pessoa com nota alta e uma de leitura cortada, para ver os dois jeitos do resultado.
      await pasteOnScreen(page, { name: 'Pessoa Forte Imaginária', slug: 'sem-termos', skills: ['Java', 'Spring', 'Kubernetes'] });
      await shoot('analise-nota-forte');
      await page.getByRole('button', { name: 'Voltar ao início' }).click();
      await page.getByRole('button', { name: 'Colar um perfil' }).first().click();
      await page.getByLabel('Texto do perfil').fill(fixture('lista-cortada'));
      await page.getByLabel('Link do perfil').fill('https://www.linkedin.com/in/olivia-ficticia/');
      await page.getByRole('button', { name: 'Analisar', exact: true }).click();
      await page.getByText('A leitura pode estar incompleta').waitFor();
      await shoot('analise-leitura-incompleta');

      // Lista com filtro.
      await page.getByRole('button', { name: 'Ver todos' }).click();
      await page.getByRole('heading', { name: 'Todos da lista', level: 2 }).waitFor();
      await shoot('ver-todos-sem-filtro');
      await page.getByLabel('Tecnologia ou ferramenta').fill('kubernetes');
      await page.getByLabel('Faixa').selectOption('strong');
      await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
      await page.getByText('ficaram de fora dos filtros').waitFor();
      await shoot('ver-todos-com-filtro');

      // Detalhe, com prazo acabando e alerta nas notas.
      await page.getByRole('button', { name: 'Tirar os filtros' }).click();
      await page.getByText('Mostrando 18 de 18.').waitFor();
      await page.locator('li.tr-person', { hasText: people[4]!.name }).getByRole('button', { name: 'Ver detalhe' }).click();
      await page.getByRole('heading', { name: `Detalhe: ${people[4]!.name}`, level: 2 }).waitFor();
      await page.getByLabel('Notas', { exact: true }).fill('Ela é casada e tem filhos pequenos.');
      await page.getByRole('button', { name: 'Salvar', exact: true }).click();
      await page.getByText('Alterações salvas.').waitFor();
      await shoot('detalhe-prazo-e-alerta');

      // Relatório: primeira vez, e depois de baixar com nome fora do alfabeto.
      await page.getByRole('button', { name: 'Voltar ao início' }).click();
      await page.getByRole('button', { name: 'Gerar PDF' }).click();
      await page.getByRole('heading', { name: 'Gerar PDF', level: 2 }).waitFor();
      await shoot('gerar-pdf-primeira-vez');

      assert.deepEqual(errors, []);
      await page.close();
    });
  }
});

/** Contraste (WCAG) de todo texto visível contra o fundo efetivo: 4,5:1 no mínimo. */
async function contrastAudit(page: Page, where: string): Promise<void> {
  const failures = await page.evaluate(() => {
    const parse = (value: string): [number, number, number, number] => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (!m) return [0, 0, 0, 0];
      const p = (m[1] as string).split(/[,\s/]+/).filter(Boolean).map(Number);
      return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
    };
    const lum = (c: number[]): number => {
      const f = (v: number): number => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0] ?? 0) + 0.7152 * f(c[1] ?? 0) + 0.0722 * f(c[2] ?? 0);
    };
    const backdrop = (el: Element | null): number[] => {
      for (let node = el; node; node = node.parentElement) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg[3] === 1) return bg;
      }
      return parse(getComputedStyle(document.body).backgroundColor);
    };
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      const el = node.parentElement;
      if (!text || !el || el.closest('[hidden]') || el.closest('.tr-visually-hidden') || el.closest('option')) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const fg = parse(style.color);
      const bg = backdrop(el);
      const [a, b] = [lum(fg), lum(bg)];
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) out.push(`${ratio.toFixed(2)} ${style.color} sobre ${style.backgroundColor || 'fundo'}: ${text.slice(0, 40)}`);
    }
    return out;
  });
  assert.deepEqual(failures, [], `contraste baixo em ${where}`);
}
