import assert from 'node:assert/strict';
import { waitFor, type BrowserPage } from './browser.ts';

interface PasswordSnapshot {
  type: string;
  value: string;
  autocomplete: string;
  invalid: string | null;
  describedBy: string | null;
}

export async function checkPasswordVisibility(page: BrowserPage, id: string): Promise<void> {
  const field = JSON.stringify(id);
  const button = `document.querySelector('button[aria-controls="'+CSS.escape(${field})+'"]')`;
  const read = () =>
    page.evaluate<PasswordSnapshot>(`(()=>{
      const input=document.getElementById(${field});
      return {type:input.type,value:input.value,autocomplete:input.autocomplete,
        invalid:input.getAttribute('aria-invalid'),describedBy:input.getAttribute('aria-describedby')};
    })()`);
  const before = await read();
  assert.equal(before.type, 'password', `${id} is hidden by default`);
  assert.equal(await page.evaluate(`${button}.type`), 'button');
  assert(
    await page.evaluate(`(()=>{
      const input=document.getElementById(${field}).getBoundingClientRect();
      const toggle=${button}.getBoundingClientRect();
      return toggle.left>=input.left&&toggle.right<=input.right&&
        input.right-toggle.right<=10&&Math.abs((toggle.top-input.top)-(input.bottom-toggle.bottom))<2;
    })()`),
    `${id} has an inset, vertically centered visibility button on the right`,
  );
  await page.evaluate(`${button}.click()`);
  await waitFor(() => page.evaluate(`${button}.getAttribute('aria-pressed')==='true'`));
  assert.deepEqual(await read(), { ...before, type: 'text' });
  assert.equal(await page.evaluate(`${button}.getAttribute('aria-label')`), 'Hide Password');
  await page.evaluate(`${button}.focus()`);
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    text: '\r',
    unmodifiedText: '\r',
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  await waitFor(() => page.evaluate(`${button}.getAttribute('aria-pressed')==='false'`));
  assert.deepEqual(await read(), before, `${id} preserves the value and validation after hiding`);
}
