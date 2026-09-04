import React, { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { AppSettings } from '../../preload/types';
import { loadSettingsAtom, settingsAtom, updateSettingsAtom } from '../state/settings';

export function SettingsPanel(): React.JSX.Element {
  const settings = useAtomValue(settingsAtom);
  const loadSettings = useSetAtom(loadSettingsAtom);
  const updateSettings = useSetAtom(updateSettingsAtom);

  const [draft, setDraft] = useState<AppSettings>(settings);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [fontFamilies, setFontFamilies] = useState<string[]>([]);
  const [fontLoadStatus, setFontLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'unavailable'>('idle');

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }));
    setStatus('idle');
  };

  const loadFontFamilies = async (): Promise<void> => {
    if (fontLoadStatus !== 'idle') return;
    if (!window.queryLocalFonts) {
      setFontLoadStatus('unavailable');
      return;
    }

    setFontLoadStatus('loading');
    try {
      const fonts = await window.queryLocalFonts();
      const families = [...new Set(fonts.map((font) => font.family).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right));
      setFontFamilies(families);
      setFontLoadStatus('loaded');
    } catch (error: unknown) {
      console.error('Unable to enumerate local fonts:', error);
      setFontLoadStatus('unavailable');
    }
  };

  const save = (event: React.FormEvent): void => {
    event.preventDefault();
    setStatus('saving');
    updateSettings({
      ...draft,
      defaultCwd: draft.defaultCwd.trim(),
      editorCommand: draft.editorCommand.trim() || 'nvim',
      shellOverride: draft.shellOverride.trim(),
      shellArgs: draft.shellArgs.trim(),
    })
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
          value={draft.defaultCwd}
          onChange={(event) => patch('defaultCwd', event.target.value)}
        />

        <label className="settings-panel__label" htmlFor="editor-command">
          Editor command
        </label>
        <input
          id="editor-command"
          placeholder="nvim"
          value={draft.editorCommand}
          onChange={(event) => patch('editorCommand', event.target.value)}
        />

        <label className="settings-panel__label" htmlFor="shell-override">
          Shell override
        </label>
        <input
          id="shell-override"
          placeholder="Leave blank to auto-detect"
          value={draft.shellOverride}
          onChange={(event) => patch('shellOverride', event.target.value)}
        />

        <label className="settings-panel__label" htmlFor="shell-args">
          Shell arguments
        </label>
        <input
          id="shell-args"
          placeholder="e.g. -NoLogo, -l"
          value={draft.shellArgs}
          onChange={(event) => patch('shellArgs', event.target.value)}
        />

        <label className="settings-panel__label" htmlFor="font-family">
          Font family
        </label>
        <input
          id="font-family"
          list="font-family-options"
          autoComplete="off"
          value={draft.fontFamily}
          onFocus={() => void loadFontFamilies()}
          onChange={(event) => patch('fontFamily', event.target.value)}
        />
        <datalist id="font-family-options">
          {fontFamilies.map((family) => <option key={family} value={family} />)}
        </datalist>
        {fontLoadStatus === 'loading' && <span className="settings-panel__hint">Loading installed fonts…</span>}
        {fontLoadStatus === 'unavailable' && (
          <span className="settings-panel__hint">Installed fonts unavailable; enter a CSS font family manually.</span>
        )}

        <label className="settings-panel__label" htmlFor="font-size">
          Font size
        </label>
        <input
          id="font-size"
          type="number"
          min={6}
          max={72}
          value={draft.fontSize}
          onChange={(event) => patch('fontSize', Number(event.target.value) || draft.fontSize)}
        />

        <label className="settings-panel__label" htmlFor="cursor-style">
          Cursor style
        </label>
        <select
          id="cursor-style"
          value={draft.cursorStyle}
          onChange={(event) => patch('cursorStyle', event.target.value as AppSettings['cursorStyle'])}
        >
          <option value="block">Block</option>
          <option value="underline">Underline</option>
          <option value="bar">Bar</option>
        </select>

        <label className="settings-panel__checkbox">
          <input type="checkbox" checked={draft.cursorBlink} onChange={(event) => patch('cursorBlink', event.target.checked)} />
          Cursor blink
        </label>

        <label className="settings-panel__label" htmlFor="scrollback">
          Scrollback lines
        </label>
        <input
          id="scrollback"
          type="number"
          min={0}
          max={1000000}
          value={draft.scrollback}
          onChange={(event) => patch('scrollback', Number(event.target.value) || 0)}
        />

        <label className="settings-panel__checkbox">
          <input
            type="checkbox"
            checked={draft.confirmBeforeClose}
            onChange={(event) => patch('confirmBeforeClose', event.target.checked)}
          />
          Confirm before closing a tab
        </label>

        <label className="settings-panel__checkbox">
          <input type="checkbox" checked={draft.mcpEnabled} onChange={(event) => patch('mcpEnabled', event.target.checked)} />
          Enable MCP server (restart required)
        </label>

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
