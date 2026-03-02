import { expect, test } from '@playwright/test';

test('fluxo principal: login, cadastro, edicao, status, exclusao e logout', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('crm:e2e:bootstrap', '1');
    localStorage.setItem(
      'crm:e2e:session',
      JSON.stringify({
        user: {
          id: 'e2e-user-graphyx',
          email: 'graphyx.ai@gmail.com',
          user_metadata: { workspace: 'graphyx' },
          app_metadata: { workspace: 'graphyx' }
        }
      })
    );
  });

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.getByRole('button', { name: '+ Novo Lead' }).click();
  await page.goto('/prospeccao/psicologo?newLead=1');
  await expect(page).toHaveURL(/\/prospeccao\/psicologo/);
  await expect(page.getByRole('heading', { name: 'Adicionar Cliente' })).toBeVisible();

  await page.getByLabel('Nome *').fill('Cliente E2E');
  await page.getByLabel('Telefone').fill('(11) 99999-0000');
  await page.getByLabel('Endereco').fill('Rua Teste, 42');
  await page.getByLabel('Possui site?').check();
  await page.getByRole('textbox', { name: 'Site' }).fill('https://cliente-e2e.test');
  await page.getByRole('button', { name: 'Salvar' }).click();

  const row = page.locator('tr', { hasText: 'Cliente E2E' });
  await expect(row).toBeVisible();
  await expect(row.getByRole('link', { name: 'https://cliente-e2e.test' })).toBeVisible();

  await row.locator('select').selectOption('contatado');
  await expect(row.locator('select')).toHaveValue('contatado');

  await row.locator('button[title=\"Editar\"]').click();
  await expect(page.getByRole('heading', { name: 'Editar Cliente' })).toBeVisible();
  await page.getByLabel('Nome *').fill('Cliente E2E Editado');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: 'Editar Cliente' })).not.toBeVisible();
  await expect(page.locator('tr', { hasText: 'Cliente E2E' })).toBeVisible();

  await page.locator('tr', { hasText: 'Cliente E2E' }).locator('button[title=\"Editar\"]').click();
  await page.getByLabel('Nome *').fill('Cliente E2E Editado');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.locator('tr', { hasText: 'Cliente E2E Editado' })).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('tr', { hasText: 'Cliente E2E Editado' }).locator('button[title=\"Excluir\"]').click();
  await expect(page.locator('tr', { hasText: 'Cliente E2E Editado' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
