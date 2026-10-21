import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { clearSession, getSession, saveSession } from './authSession';
import { applyLanguage, getLanguage, initializeI18n } from './i18n';
import {
  chooseLanguage,
  languagePreferenceStore,
  listenForLanguagePreferences,
} from './languagePreferences';
import type { LanguagePreference } from '@kitchentodoor/shared';

vi.mock('./api', () => ({
  api: {
    auth: { updateLanguage: vi.fn<(language: 'en' | 'ja') => Promise<LanguagePreference>>() },
  },
}));
const user = {
  id: 'customer-1',
  name: 'Customer',
  email: 'customer@example.test',
  role: 'CUSTOMER' as const,
  language: 'en' as const,
  languageVersion: 0,
};

describe('Account language preference synchronization', () => {
  let stop: () => void;
  const values = new Map<string, string>();
  beforeAll(async () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal('document', { documentElement: { lang: 'en' } });
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('navigator', {});
    await initializeI18n();
  });
  beforeEach(async () => {
    clearSession();
    values.clear();
    await applyLanguage('en');
    languagePreferenceStore.setState({ loading: false, saving: false, error: false });
    stop = listenForLanguagePreferences();
    vi.mocked(api.auth.updateLanguage).mockReset();
  });
  afterEach(() => stop());
  afterAll(() => vi.unstubAllGlobals());

  it('saves a guest choice locally and restores the account preference on sign-in', async () => {
    await chooseLanguage('ja');
    expect(getLanguage()).toBe('ja');
    expect(api.auth.updateLanguage).not.toHaveBeenCalled();
    saveSession({ accessToken: 'test-token', user });
    await vi.waitFor(() => expect(getLanguage()).toBe('en'));
  });

  it('persists a signed-in choice and ignores an older profile response', async () => {
    saveSession({ accessToken: 'test-token', user });
    vi.mocked(api.auth.updateLanguage).mockResolvedValue({ language: 'ja', languageVersion: 1 });
    await chooseLanguage('ja');
    await vi.waitFor(() => expect(getSession().user?.languageVersion).toBe(1));
    saveSession({ accessToken: 'test-token', user: { ...user } });
    expect(getSession().user?.language).toBe('ja');
    expect(JSON.parse(localStorage.getItem('ktd_user') ?? '{}')).toMatchObject({
      language: 'ja',
      languageVersion: 1,
    });
    expect(localStorage.getItem('ktd_language_pending')).toBeNull();
  });

  it('keeps an unsaved local choice and retries after a connection returns', async () => {
    saveSession({ accessToken: 'test-token', user });
    vi.mocked(api.auth.updateLanguage).mockRejectedValueOnce(new Error('offline'));
    await chooseLanguage('ja');
    await vi.waitFor(() => expect(languagePreferenceStore.getState().error).toBe(true));
    expect(getLanguage()).toBe('ja');
    expect(localStorage.getItem('ktd_language_pending')).toContain('customer-1');
    vi.mocked(api.auth.updateLanguage).mockResolvedValue({ language: 'ja', languageVersion: 2 });
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(getSession().user?.language).toBe('ja'));
    expect(languagePreferenceStore.getState().error).toBe(false);
    expect(localStorage.getItem('ktd_language_pending')).toBeNull();
  });

  it('coalesces queued selections and saves the final choice', async () => {
    saveSession({ accessToken: 'test-token', user });
    let release: (value: LanguagePreference) => void = () => {};
    vi.mocked(api.auth.updateLanguage).mockImplementationOnce(
      () =>
        new Promise<LanguagePreference>((resolve) => {
          release = resolve;
        }),
    );
    vi.mocked(api.auth.updateLanguage).mockResolvedValue({ language: 'ja', languageVersion: 2 });
    await chooseLanguage('ja');
    await chooseLanguage('en');
    await chooseLanguage('ja');
    release({ language: 'ja', languageVersion: 1 });
    await vi.waitFor(() => expect(getSession().user?.languageVersion).toBe(2));
    expect(vi.mocked(api.auth.updateLanguage).mock.calls.map((call) => call[0])).toEqual([
      'ja',
      'ja',
    ]);
  });

  it.each(['sign-out', 'different-account'] as const)(
    'ignores a preference response after %s',
    async (change) => {
      saveSession({ accessToken: 'first-token', user });
      let release: (value: LanguagePreference) => void = () => {};
      vi.mocked(api.auth.updateLanguage).mockImplementationOnce(
        () =>
          new Promise<LanguagePreference>((resolve) => {
            release = resolve;
          }),
      );
      await chooseLanguage('ja');
      await vi.waitFor(() => expect(api.auth.updateLanguage).toHaveBeenCalledOnce());
      clearSession();
      if (change === 'different-account')
        saveSession({ accessToken: 'second-token', user: { ...user, id: 'customer-2' } });
      release({ language: 'ja', languageVersion: 1 });
      await vi.waitFor(() => expect(languagePreferenceStore.getState().saving).toBe(false));
      expect(getSession().user?.id).toBe(change === 'sign-out' ? undefined : 'customer-2');
      expect(getSession().token).toBe(change === 'sign-out' ? null : 'second-token');
      expect(getSession().user?.languageVersion).not.toBe(1);
    },
  );
});
