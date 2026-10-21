import { createStore } from 'zustand/vanilla';
import type { Language } from '@kitchentodoor/shared';
import { api } from './api';
import { getSession, saveSession, subscribeSession } from './authSession';
import { applyLanguage, cancelLanguageChanges, getLanguage, LANGUAGE_STORAGE_KEY } from './i18n';

export const languagePreferenceStore = createStore<{
  loading: boolean;
  saving: boolean;
  error: boolean;
  retryLanguage?: Language;
}>()(() => ({ loading: false, saving: false, error: false }));
const PENDING_KEY = 'ktd_language_pending';
function rememberPending(job: { owner: string; language: Language; intent: string }) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(job));
  } catch {
    /* Retry still works in memory. */
  }
}
function readPending(): { owner: string; language: Language; intent: string } | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null');
    if (
      value &&
      typeof value === 'object' &&
      'owner' in value &&
      typeof value.owner === 'string' &&
      'language' in value &&
      (value.language === 'en' || value.language === 'ja') &&
      'intent' in value &&
      typeof value.intent === 'string'
    )
      return { owner: value.owner, language: value.language, intent: value.intent };
  } catch {
    /* Ignore an invalid or unavailable browser record. */
  }
  return undefined;
}
interface SaveJob {
  language: Language;
  owner: string;
  epoch: number;
  choice: number;
  intent: string;
}
let owner: string | undefined;
let epoch = 0;
let choice = 0;
let editingOwner: string | undefined;
let queued: SaveJob | undefined;
let running = false;

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queued) {
      const job = queued;
      queued = undefined;
      if (job.epoch !== epoch || getSession().user?.id !== job.owner) continue;
      try {
        const persist = async () => {
          const latest = readPending();
          if (
            job.epoch !== epoch ||
            getSession().user?.id !== job.owner ||
            (latest && latest.intent !== job.intent)
          )
            return undefined;
          return api.auth.updateLanguage(job.language);
        };
        const saved =
          typeof navigator !== 'undefined' && navigator.locks
            ? await navigator.locks.request('ktd-language-preference', persist)
            : await persist();
        if (!saved) continue;
        const current = getSession();
        if (
          job.epoch === epoch &&
          job.choice === choice &&
          current.user?.id === job.owner &&
          current.token
        ) {
          saveSession({ accessToken: current.token, user: { ...current.user, ...saved } });
          editingOwner = undefined;
          try {
            const pending = readPending();
            if (pending?.intent === job.intent) localStorage.removeItem(PENDING_KEY);
          } catch {
            /* Browser storage can be unavailable. */
          }
          languagePreferenceStore.setState({ error: false });
        }
      } catch {
        if (job.epoch === epoch && job.choice === choice && getSession().user?.id === job.owner)
          languagePreferenceStore.setState({ error: true, retryLanguage: job.language });
      }
    }
  } finally {
    running = false;
    languagePreferenceStore.setState({ saving: false });
  }
}

export async function chooseLanguage(language: Language) {
  const request = ++choice;
  const currentOwner = getSession().user?.id;
  const currentEpoch = epoch;
  const intent = `${Date.now()}:${Math.random()}`;
  editingOwner = currentOwner;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* The in-memory choice still works. */
  }
  if (currentOwner) rememberPending({ owner: currentOwner, language, intent });
  languagePreferenceStore.setState({ loading: true, error: false, retryLanguage: language });
  try {
    await applyLanguage(language, true);
    if (request !== choice || currentEpoch !== epoch) return;
    if (currentOwner && currentOwner === getSession().user?.id) {
      queued = { language, owner: currentOwner, epoch, choice: request, intent };
      languagePreferenceStore.setState({ saving: true });
      void drain();
    }
  } catch {
    if (request === choice)
      languagePreferenceStore.setState({ error: true, retryLanguage: language });
  } finally {
    if (request === choice) languagePreferenceStore.setState({ loading: false });
  }
}

export function listenForLanguagePreferences() {
  const synchronize = () => {
    const user = getSession().user;
    if (user?.id !== owner) {
      owner = user?.id;
      epoch++;
      choice++;
      queued = undefined;
      editingOwner = undefined;
      cancelLanguageChanges();
      languagePreferenceStore.setState({ loading: false, saving: false, error: false });
      const pending = readPending();
      if (user && pending?.owner === user.id) {
        void chooseLanguage(pending.language);
        return;
      }
    }
    if (
      user &&
      editingOwner === user.id &&
      !languagePreferenceStore.getState().loading &&
      !languagePreferenceStore.getState().saving &&
      readPending()?.owner !== user.id
    )
      editingOwner = undefined;
    if (user && editingOwner !== user.id && (user.language ?? 'en') !== getLanguage())
      void applyLanguage(user.language ?? 'en').catch(() =>
        languagePreferenceStore.setState({ error: true, retryLanguage: user.language ?? 'en' }),
      );
  };
  const storage = (event: StorageEvent) => {
    if (event.key === PENDING_KEY) {
      const pending = readPending();
      if (pending?.owner === getSession().user?.id && pending) editingOwner = pending.owner;
      else synchronize();
    }
    if (event.key === LANGUAGE_STORAGE_KEY && (event.newValue === 'en' || event.newValue === 'ja'))
      void applyLanguage(event.newValue).catch(() =>
        languagePreferenceStore.setState({ error: true }),
      );
  };
  synchronize();
  const online = () => {
    const pending = readPending();
    if (pending && pending.owner === getSession().user?.id) void chooseLanguage(pending.language);
  };
  const unsubscribe = subscribeSession(synchronize);
  window.addEventListener('storage', storage);
  window.addEventListener('online', online);
  return () => {
    unsubscribe();
    window.removeEventListener('storage', storage);
    window.removeEventListener('online', online);
  };
}
