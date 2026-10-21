import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyLanguage, getLanguage, initializeI18n, translateCopy } from './i18n';

describe('English and Japanese localization', () => {
  beforeAll(async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.stubGlobal('document', { documentElement: { lang: 'en' } });
    await initializeI18n();
  });
  beforeEach(async () => {
    await applyLanguage('en');
  });
  afterAll(() => vi.unstubAllGlobals());

  it('loads Japanese interface, menu and validation copy without changing canonical data', async () => {
    await applyLanguage('ja');
    expect(translateCopy('Food Menu')).toBe('フードメニュー');
    expect(translateCopy('Truffle Smoke Burger')).toBe('トリュフスモークバーガー');
    expect(translateCopy('Please provide a valid email address')).toBe(
      '有効なメールアドレスを入力してください',
    );
    expect(translateCopy('READY_FOR_PICKUP')).toBe('受け取り準備完了');
    expect(translateCopy('unrecognized server message')).toBe('unrecognized server message');
    expect(document.documentElement.lang).toBe('ja');
    expect(localStorage.getItem('ktd_language')).toBe('ja');
    expect(getLanguage()).toBe('ja');
  });

  it('formats count labels in both languages', async () => {
    expect(translateCopy('View cart, {{count}} items', { count: 1 })).toBe('View cart, 1 item');
    expect(translateCopy('View cart, {{count}} items', { count: 2 })).toBe('View cart, 2 items');
    await applyLanguage('ja');
    expect(translateCopy('View cart, {{count}} items', { count: 1 })).toBe('カートを見る（1点）');
    expect(translateCopy('{{from}}–{{to}} of {{total}} items', { from: 1, to: 8, total: 27 })).toBe(
      '27件中 1～8件',
    );
  });

  it('keeps user-provided interpolation as React text', async () => {
    await applyLanguage('ja');
    const text = translateCopy('Welcome, {{name}}', { name: '<img src=x onerror=alert(1)>' });
    const html = renderToStaticMarkup(createElement('p', null, text));
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
  });

  it('switches back to English and preserves USD menu names', async () => {
    await applyLanguage('ja');
    await applyLanguage('en');
    expect(translateCopy('Truffle Smoke Burger')).toBe('Truffle Smoke Burger');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('ktd_language')).toBe('en');
  });
});
