import React, { useState } from 'react';
import { Download, Trash2, Shield, Bell, Moon, Lock, Cloud, User, ChevronRight, Calendar, Upload, FileSpreadsheet } from 'lucide-react';
import { clearPin, savePin, verifyPin } from '../utils/pin';

const Switch = ({ checked, onChange }) => (
    <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-slate-700' : 'bg-slate-200'}`}
    >
        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
);

const SettingItem = ({ icon, label, subLabel, value, setValue, colorClass = "text-slate-600", bgClass = "bg-slate-100", customAction }) => (
  <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${bgClass} ${colorClass}`}>
              {React.createElement(icon, { size: 20 })}
          </div>
          <div>
              <div className="font-bold text-slate-700 text-sm">{label}</div>
              {subLabel && <div className="text-[10px] text-slate-400">{subLabel}</div>}
          </div>
      </div>
      {customAction || <Switch checked={value} onChange={setValue} />}
  </div>
);

const SettingsPage = ({ onExport, onImport, onExportCalendar, onExportCsv, onReset, isDarkMode, toggleTheme, pendingSyncCount }) => {
  // UI toggles only (no functionality except Dark Mode)
  
  const [appLock, setAppLock] = useState(() => localStorage.getItem('bs-pin-enabled') === 'true');
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState(null);

  const handleAppLockToggle = async (enabled) => {
      if (enabled) {
          const pin = prompt('Enter a 4-digit PIN to lock the app:', '');
          if (pin && pin.length === 4 && !isNaN(Number(pin))) {
              await savePin(pin);
              localStorage.setItem('bs-pin-enabled', 'true');
              setAppLock(true);
              alert('App Lock enabled successfully.');
          } else {
              alert('Invalid PIN. Must be 4 digits.');
              setAppLock(false);
          }
      } else {
          const confirmPin = prompt('Enter your 4-digit PIN to disable lock:', '');
          if (confirmPin && await verifyPin(confirmPin)) {
              clearPin();
              localStorage.setItem('bs-pin-enabled', 'false');
              setAppLock(false);
              alert('App Lock disabled.');
          } else {
              alert('Incorrect PIN.');
          }
      }
  };

  const handleImport = async (event) => {
      const [file] = event.target.files;
      event.target.value = '';
      if (!file) return;

      try {
          const contents = await file.text();
          const parsed = JSON.parse(contents);
          const backupData = parsed?.data || parsed;
          const preview = {
              conditions: Array.isArray(backupData?.conditions) ? backupData.conditions.length : 0,
              logs: Array.isArray(backupData?.logs) ? backupData.logs.length : 0,
              diaryEntries: Array.isArray(backupData?.diaryEntries) ? backupData.diaryEntries.length : 0,
          };
          setImportPreview(preview);
          if (!window.confirm(
              `This backup contains ${preview.conditions} condition(s), ${preview.logs} log(s), and ${preview.diaryEntries} journal entr${preview.diaryEntries === 1 ? 'y' : 'ies'}. It will replace current local data. Continue?`,
          )) {
              setImportPreview(null);
              return;
          }
          await onImport(file);
          setImportPreview(null);
          setImportError('');
          alert('Backup imported successfully.');
      } catch (error) {
          console.error('Failed to import backup.', error);
          setImportPreview(null);
          setImportError(error.message || 'Could not import this backup.');
      }
  };

  return (
    <div className="min-h-screen bg-bg p-4 pb-24 space-y-6">
       <header>
           <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
           <p className="text-slate-500 text-sm">App configuration</p>
       </header>

        {/* Local profile; account sync is not available in this release. */}
        <section>
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between shadow-sm">
                 <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                         <User size={24} />
                     </div>
                     <div>
                         <h3 className="font-bold text-slate-800">Local profile</h3>
                         <p className="text-xs text-slate-500">No account or login required</p>
                     </div>
                 </div>
                 <span className="text-[10px] font-bold uppercase text-slate-400">Offline</span>
            </div>
        </section>

        {/* Section: Appearance & General */}
        <section className="space-y-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">General</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-50">
                <SettingItem 
                    icon={Moon} 
                    label="Dark Mode" 
                    subLabel="Easy on the eyes" 
                    value={isDarkMode} 
                    setValue={toggleTheme} 
                />
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                            <Bell size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 text-sm">Daily reminders</div>
                            <div className="text-[10px] text-slate-400">Scheduling is not available in this release</div>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Unavailable</span>
                </div>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                            <Globe size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 text-sm">Language</div>
                            <div className="text-[10px] text-slate-400">English interface; translation is not available yet</div>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">English</span>
                </div>
                <div className="p-4 flex items-center justify-between border-t border-slate-50">
                    <div>
                        <div className="font-bold text-slate-700 text-sm">Sync queue</div>
                        <div className="text-[10px] text-slate-400">Prepared for future account sync</div>
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                        {pendingSyncCount > 0 ? `${pendingSyncCount} pending` : 'Up to date'}
                    </span>
                </div>
            </div>
        </section>

        {/* Section: Privacy & Data */}
        <section className="space-y-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Privacy & Data</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-50">
                 <SettingItem 
                    icon={Lock} 
                    label="App Lock (PIN)" 
                    subLabel={appLock ? "PIN authentication required" : "Secure with 4-digit PIN"} 
                    value={appLock} 
                    setValue={handleAppLockToggle} 
                    colorClass="text-indigo-600"
                    bgClass="bg-indigo-50"
                />
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                            <Lock size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 text-sm">Biometric unlock</div>
                            <div className="text-[10px] text-slate-400">Requires a native secure credential integration</div>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Unavailable</span>
                </div>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                            <Cloud size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 text-sm">Calendar integration</div>
                            <div className="text-[10px] text-slate-400">Cloud calendar sync is not configured; use local export below</div>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Unavailable</span>
                </div>
            </div>
        </section>

        {/* Section: Data Management */}
        <section className="space-y-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Storage</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-50">
                <button 
                  onClick={onExport}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <Download size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 text-sm">Export Data</div>
                            <div className="text-[10px] text-slate-400">Download formatted JSON</div>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                </button>
                <button
                  onClick={onExportCsv}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors border-t border-slate-50"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 text-sm">Export CSV Report</div>
                            <div className="text-[10px] text-slate-400">Review records in a spreadsheet</div>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                </button>
                <label className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer border-t border-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <Upload size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 text-sm">Import Backup</div>
                            <div className="text-[10px] text-slate-400">Restore a Body Signal JSON backup</div>
                        </div>
                    </div>
                    <input type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
                    <ChevronRight size={16} className="text-slate-300" />
                </label>
                {importError && <p className="px-4 pb-3 text-xs font-medium text-rose-600">{importError}</p>}
                {importPreview && (
                    <p className="px-4 pb-3 text-xs text-slate-500" role="status">
                        Preview: {importPreview.conditions} condition(s), {importPreview.logs} log(s), {importPreview.diaryEntries} journal entr{importPreview.diaryEntries === 1 ? 'y' : 'ies'}.
                    </p>
                )}
                <button 
                  onClick={onExportCalendar}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors border-t border-slate-50"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 text-sm">Export to Calendar</div>
                            <div className="text-[10px] text-slate-400">Download .ics file for Google/Apple Calendar</div>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                </button>
                <button 
                  onClick={() => {
                      if (window.confirm("Are you sure? This will delete all local data.")) {
                          onReset();
                      }
                  }}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-rose-50 active:bg-rose-100 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-100 transition-colors">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-rose-600 text-sm">Reset Application</div>
                            <div className="text-[10px] text-slate-400">Clear all local storage</div>
                        </div>
                    </div>
                </button>
            </div>
        </section>

        {/* Section: About */}
        <div className="text-center py-6">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                <Shield size={12} className="text-slate-400" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Version 0.1.0</span>
            </div>
        </div>
    </div>
  );
};

export default SettingsPage;
