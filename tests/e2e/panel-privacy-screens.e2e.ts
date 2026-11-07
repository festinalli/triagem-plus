// Capturas da Privacidade, do detalhe com modelo de mensagem, de Ajustes com os modelos e do Top 10 compacto, em 360 px de
// largura, nos temas claro e escuro. Só roda com TRIAGEM_SHOTS_DIR apontando para uma pasta. Também confere o contraste do
// texto, a falta de rolagem na horizontal e a altura de cada pessoa do Top 10.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, launch, openPanel, resetSession, resetStorage, trapLinkedIn } from './harness.ts';
import type { Harness } from './harness.ts';
import { seeds15, seedWorkspace } from './panel-triage-kit.ts';
import { ANA, BIA, CAIO, contrastFailures, seedTwoJobs } from './panel-privacy-kit.ts';

const DIST = path.join(ROOT, 'dist');
const SHOTS = process.env.TRIAGEM_SHOTS_DIR;

describe('capturas de privacidade, mensagens e Top 10', { timeout: 300_000, skip: SHOTS === undefined ? 'defina TRIAGEM_SHOTS_DIR para gerar as capturas' : false }, () => {
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
      await resetSession(h);
      await seedTwoJobs(h, [
        { ...ANA, jobs: ['a', 'b'], notes: 'Boa conversa. Falar de salário depois.' },
        { ...BIA, jobs: ['a'] },
        { ...CAIO, jobs: ['b'] },
      ]);
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
        assert.deepEqual(await contrastFailures(page), [], `contraste baixo em ${name} (${scheme})`);
      };

      await page.locator('[data-kind="top_ten"]').waitFor();
      await shoot('top10-poucas-pessoas');

      // Detalhe com o modelo de mensagem.
      await page.locator('li.tr-person', { hasText: ANA.name }).getByRole('button', { name: 'Ver detalhe' }).click();
      await page.getByRole('heading', { name: `Detalhe: ${ANA.name}`, level: 2 }).waitFor();
      await shoot('detalhe-modelo-primeiro-contato');
      await page.getByRole('button', { name: 'Copiar', exact: true }).click();
      await page.getByText('Mensagem copiada.').waitFor();
      await shoot('detalhe-depois-de-copiar');
      await page.getByRole('button', { name: 'Marcar como informado hoje' }).click();
      await page.getByRole('button', { name: /Desfazer/ }).waitFor();
      await shoot('detalhe-informado');
      await page.getByLabel('Modelo').selectOption('closing');
      await shoot('detalhe-modelo-encerramento');

      // Ajustes com os modelos.
      await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
      await page.getByRole('heading', { name: 'Modelos de mensagem', level: 3 }).waitFor();
      await shoot('ajustes-com-modelos');

      // Privacidade.
      await page.getByRole('button', { name: 'Privacidade', exact: true }).click();
      await page.getByRole('heading', { name: 'Privacidade e seus dados', level: 2 }).waitFor();
      await shoot('privacidade-abertura');
      await page.getByLabel('Nome ou link').fill('ana ficticia muller');
      await page.getByRole('button', { name: 'Achar', exact: true }).click();
      await page.getByText('Uma pessoa achada.').waitFor();
      await shoot('privacidade-pessoa-achada');
      await page.getByRole('button', { name: /^Corrigir nome e link/ }).click();
      await page.getByLabel('Link do perfil').waitFor();
      await shoot('privacidade-corrigir');
      await page.getByRole('button', { name: 'Cancelar' }).click();
      await page.getByRole('button', { name: /^Apagar em todas as vagas/ }).click();
      await page.getByRole('heading', { name: 'Apagar esta pessoa de todas as vagas?', level: 2 }).waitFor();
      await shoot('privacidade-confirmar-apagar-pessoa');

      assert.deepEqual(errors, []);
      await page.close();
    });

    test(`Top 10 compacto com 15 pessoas em 360 px, tema ${scheme}`, async () => {
      await resetStorage(h);
      await resetSession(h);
      await seedWorkspace(h, seeds15().map((person, index) => (index === 3 ? { ...person, ageDays: 176 } : person)));
      const { page, errors } = await openPanel(h);
      await page.setViewportSize({ width: 360, height: 760 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.locator('[data-kind="top_ten"]').waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(SHOTS as string, `20-top10-compacto-${scheme}.png`), fullPage: true });
      const heights = await page.locator('[data-kind="top_ten"] li.tr-person').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().height)));
      fs.writeFileSync(path.join(SHOTS as string, `20-top10-alturas-${scheme}.txt`), `${heights.join(', ')}\n`);
      assert.equal(heights.length, 10);
      assert.deepEqual(await contrastFailures(page), [], 'contraste baixo no Top 10');
      assert.deepEqual(errors, []);
      await page.close();
    });
  }
});
