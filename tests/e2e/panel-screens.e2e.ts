// Capturas de cada tela em 360 px de largura, nos temas claro e escuro, para conferir a olho. Só roda com
// TRIAGEM_SHOTS_DIR apontando para uma pasta. Também confere o contraste de texto das telas pelas cores calculadas.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import { ROOT, launch, openPanel, resetStorage, trapLinkedIn } from './harness.ts';
import type { Harness } from './harness.ts';

const DIST = path.join(ROOT, 'dist');
const SHOTS = process.env.TRIAGEM_SHOTS_DIR;

const VAGA = ['Pessoa Desenvolvedora Back-end Sênior', 'Requisitos:', '- Java 11 ou superior', '- Experiência com Spring Boot e Kafka', '- Mínimo de 5 anos de experiência', '- Inglês avançado', '- Aceitamos candidatos de até 35 anos', 'Diferenciais:', '- Docker e Kubernetes'].join('\n');

describe('capturas das telas', { timeout: 240_000, skip: SHOTS === undefined ? 'defina TRIAGEM_SHOTS_DIR para gerar as capturas' : false }, () => {
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
    test(`telas em 360 px, tema ${scheme}`, async () => {
      await resetStorage(h);
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
      };

      await page.getByRole('heading', { name: 'Antes de começar' }).waitFor();
      await shoot('avisos');
      await page.getByRole('button', { name: 'Li os avisos e aceito' }).click();
      await page.getByText('Escreva o seu nome.').waitFor();
      await shoot('aceite-com-erros');
      await page.getByLabel('Seu nome').fill('Marina Souza');
      await page.getByLabel('Seu contato').fill('marina@exemplo.test');
      await page.getByRole('button', { name: 'Li os avisos e aceito' }).click();
      await page.getByRole('heading', { name: 'Vamos começar pela vaga' }).waitFor();
      await shoot('sem-vaga');
      await page.getByRole('button', { name: 'Nova vaga' }).click();
      await shoot('formulario-vaga');
      await page.getByLabel('Título da vaga').fill('Pessoa desenvolvedora back-end sênior');
      await page.getByLabel('Texto da vaga').fill(VAGA);
      await page.getByRole('button', { name: 'Salvar e ver requisitos' }).click();
      await page.getByText('Frases que ficaram de fora', { exact: true }).waitFor();
      await shoot('requisitos-sugestoes');
      await page.getByRole('button', { name: 'Usar os marcados' }).click();
      await page.getByRole('list', { name: 'Requisitos cadastrados' }).waitFor();
      await page.getByLabel('Requisito', { exact: true }).fill('mulheres');
      await page.getByRole('button', { name: 'Adicionar requisito' }).click();
      await page.getByText('Gênero ou sexo não entra como critério').waitFor();
      await page.getByLabel('Termo a excluir').fill('estágio');
      await page.getByRole('button', { name: 'Excluir este termo' }).click();
      await page.getByRole('list', { name: 'Termos excluídos' }).waitFor();
      await shoot('requisitos-lista-e-recusa');
      await page.getByRole('button', { name: 'Montar a busca' }).click();
      await page.getByRole('heading', { name: 'Busca para o LinkedIn' }).waitFor();
      await shoot('busca');
      await page.getByRole('button', { name: 'Copiar', exact: true }).click();
      await page.getByText('Busca copiada.').waitFor();
      await shoot('busca-copiada');
      await page.getByRole('button', { name: 'Voltar ao início' }).click();
      await page.getByRole('heading', { name: 'Vaga ativa' }).waitFor();
      await shoot('inicio-com-vaga');
      await page.getByRole('button', { name: 'Trocar' }).click();
      await page.getByRole('heading', { name: 'Suas vagas' }).waitFor();
      await shoot('lista-de-vagas');
      await page.getByRole('button', { name: 'Voltar ao início' }).click();
      await page.getByRole('button', { name: 'Ajustes' }).click();
      await page.getByRole('heading', { name: 'Ajustes', level: 2 }).waitFor();
      await shoot('ajustes');
      await page.getByRole('button', { name: 'Voltar ao início' }).click();
      await page.getByRole('button', { name: 'Apagar', exact: true }).click();
      await page.getByRole('heading', { name: 'Apagar a vaga?' }).waitFor();
      await shoot('confirmar-apagar');
      await page.getByRole('button', { name: 'Cancelar' }).click();
      await page.getByRole('button', { name: 'Requisitos', exact: true }).click();
      await page.getByRole('button', { name: 'Vaga afirmativa?' }).click();
      await page.getByRole('heading', { name: 'Vagas afirmativas' }).waitFor();
      await shoot('ajuda-afirmativa');
      assert.deepEqual(errors, []);
      await contrastAudit(page, scheme);
      await page.close();
    });
  }
});

/** Contraste (WCAG) de todo texto visível contra o fundo efetivo: 4,5:1 no mínimo. */
async function contrastAudit(page: Page, scheme: string): Promise<void> {
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
  assert.deepEqual(failures, [], `contraste baixo no tema ${scheme}`);
}
