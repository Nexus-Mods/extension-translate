import Settings from './Settings';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';
import * as i18next from 'i18next';
import { fs, log, types, util } from 'vortex-api';

const app = remote !== undefined ? remote.app : appIn;

class MissingKeysDB {
  private mLanguage: string;
  private mLanguagesPath: string;
  private mTranslations: { [ns: string]: { [key: string]: string } } = {};
  private mSyncDebouncer: util.Debouncer;

  constructor(language: string, languagesPath: string) {
    this.mLanguage = language;
    this.mLanguagesPath = languagesPath;
    this.mSyncDebouncer = new util.Debouncer(() =>
      Promise.map(Object.keys(this.mTranslations), this.syncNS), 1000);
  }

  public setLanguage(language: string) {
    this.mLanguage = language;
  }

  public onMissingKey(lngs: string[], namespace: string, key: string, res: string) {
    if (this.mTranslations[namespace] === undefined) {
      this.mTranslations[namespace] = {};
    }
    this.mTranslations[namespace][key] = res;
    this.mSyncDebouncer.schedule();
  }

  private syncNS = (ns: string) => {
    const nsFilePath = path.join(this.mLanguagesPath, this.mLanguage, `${ns}.json`);
    return fs.readFileAsync(nsFilePath, { encoding: 'utf-8' })
      .catch(err => (err.code === 'ENOENT')
          ? Promise.resolve('{}')
          : Promise.reject(err))
      .then(data => {
        const old = JSON.parse(data.toString());
        // only add texts that are not known, otherwise we might overwrite user data
        Object.keys(this.mTranslations[ns]).forEach(key => {
          if (old[key] === undefined) {
            old[key] = this.mTranslations[ns][key];
          }
        });
        return fs.writeFileAsync(nsFilePath, JSON.stringify(old, undefined, 2), { encoding: 'utf-8' });
      })
      .catch(err => {
        log('warn', 'failed to insert missing translations', { error: err.message });
        if (err.code !== 'EBUSY') {
          log('warn', 'failed to insert missing translations', { error: err.message });
        }
      });
  }
}

function init(context: types.IExtensionContext): boolean {
  context.requireVersion('>=0.14.1');
  const userLanguagesPath = path.join(app.getPath('userData'), 'locales');
  context.registerSettings('Interface', Settings, () => ({
    getKnownLanguages: () => fs.readdirAsync(userLanguagesPath).catch(err => []),
    onCreateLanguage: (lang: string) =>
      fs.ensureDirAsync(path.join(userLanguagesPath, lang))
        .then(fs.writeFileAsync(path.join(userLanguagesPath, lang, 'common.json'), '{}')),
  }));

  context.once(() => {
    const i18n: i18next.i18n = (context.api as any).getI18n();
    const db = new MissingKeysDB(i18n.language, userLanguagesPath);
    let refreshDebouncer = new util.Debouncer((language) => {
      i18n.reloadResources([language]);
    }, 1000);
    let watcher: fs.FSWatcher;
    const languageChanged = (lng) => {
      if (watcher !== undefined) {
        watcher.close();
      }
      db.setLanguage(lng);
      try {
        fs.statSync(path.join(userLanguagesPath, lng));
        fs.watch(path.join(userLanguagesPath, lng), {}, (event, fileName) => {
          refreshDebouncer.schedule(undefined, lng);
        });
        i18n.on('missingKey', missingHandler);
      } catch(err) {
        i18n.off('missingKey', missingHandler);
      }
    };
    const missingHandler = (lngs, namespace, key, res) => db.onMissingKey(lngs, namespace, key, res);
    i18n.options.saveMissing = true;
    i18n.on('languageChanged', languageChanged);
    const state: types.IState = context.api.store.getState();
    languageChanged(state.settings.interface.language);
  });
  return true;
}

export default init;
