import { expect, test } from "@playwright/test";

test("phase 1 commercial routes render", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Perakende POS ekosisteminizi webden satin alin, Desktop ve Mobile'da kullanin."
    })
  ).toBeVisible();

  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Gercek SaaS fiyatlandirma deneyimi" })).toBeVisible();

  await page.goto("/download");
  await expect(page.getByRole("heading", { name: "Windows, Android ve iOS uygulama dagitimi" })).toBeVisible();

  await page.goto("/reseller/apply");
  await expect(page.getByRole("heading", { name: "Bayi basvurunuzu birakin" })).toBeVisible();

  await page.goto("/checkout?plan=pro&cycle=monthly");
  await expect(page.getByRole("heading", { name: "Subscription checkout" })).toBeVisible();
});
