import React, { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { loadSettingsAtom, settingsAtom, updateSettingsAtom } from '../state/settings';

export function SettingsPanel(): React.JSX.Element {
  const settings = useAtomValue(settingsAtom);
  const loadSettings = useSetAtom(loadSettingsAtom);
  const updateSettings = useSetAtom(updateSettingsAtom);

  const [defaultCwd, setDefaultCwd] = useState(settings.defaultCwd);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setDefaultCwd(settings.defaultCwd);
  }, [settings.defaultCwd]);

  const save = (event: React.FormEvent): void => {
    event.preventDefault();
    setStatus('saving');
    updateSettings({ defaultCwd: defaultCwd.trim() })
      .then(() => setStatus('saved'))
      .catch((error: unknown) => {
        console.error('Failed to save settings:', error);
        setStatus('error');
      });
  };

  return (
    <div className="sidebar-panel settings-panel">
      <div className="sidebar-panel__header">
        <span>Settings</span>
      </div>
      <form className="sidebar-panel__form" onSubmit={save}>
        <label className="settings-panel__label" htmlFor="default-cwd">
          Initial landing path
        </label>
        <input
          id="default-cwd"
          placeholder="Leave blank for system default"
          value={defaultCwd}
          onChange={(event) => {
            setDefaultCwd(event.target.value);
            setStatus('idle');
          }}
        />
        <button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {status === 'saved' && <span className="settings-panel__status settings-panel__status--ok">Saved</span>}
        {status === 'error' && (
          <span className="settings-panel__status settings-panel__status--error">Failed to save</span>
        )}
      </form>
    </div>
  );
}
