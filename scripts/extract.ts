import { chromium } from "playwright";
import fs from "node:fs/promises";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  let coursesData = null;
  let relationsData = null;

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('rpc/get_study_plan_courses_details')) {
      coursesData = await response.json();
    } else if (url.includes('course_relation?select=from_course_id%2Cto_course_id%2Crelation_type&study_plan_id=eq.48')) {
      relationsData = await response.json();
    }
  });

  await page.goto("https://claustrum.maugp.com/curriculum?c=3&r=10&p=48");
  await page.waitForTimeout(5000); // wait for requests

  await fs.writeFile('extracted.json', JSON.stringify({ coursesData, relationsData }, null, 2));
  
  await browser.close();
}

main();
