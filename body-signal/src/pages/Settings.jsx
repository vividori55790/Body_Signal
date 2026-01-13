import React, { useState } from 'react';
import { Download, Trash2, Shield, Bell, Moon, Lock, Cloud, Globe, User, ChevronRight } from 'lucide-react';

const SettingsPage = ({ onExport, onReset }) => {
  // UI toggles only (no functionality)
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [appLock, setAppLock] = useState(false);
  const [cloudSync, setCloudSync] = useState(false);
  const [language, setLanguage] = useState('en');

  // Custom Switch Component for better aesthetics
  const Switch = ({ checked, onChange }) => (
      <button 
          onClick={() => onChange(!checked)}
          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-slate-700' : 'bg-slate-200'}`}
      >
          <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
  );

  // Reusable Setting Item Row
  const SettingItem = ({ icon: Icon, label, subLabel, value, setValue, colorClass = "text-slate-600", bgClass = "bg-slate-100", customAction }) => (
    <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${bgClass} ${colorClass}`}>
                <Icon size={20} />
            </div>
            <div>
                <div className="font-bold text-slate-700 text-sm">{label}</div>
                {subLabel && <div className="text-[10px] text-slate-400">{subLabel}</div>}
            </div>
        </div>
        {customAction ? customAction : <Switch checked={value} onChange={setValue} />}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg p-4 pb-24 space-y-6">
       <header>
           <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
           <p className="text-slate-500 text-sm">App configuration</p>
       </header>

        {/* Section: Account Mock */}
        <section>
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between shadow-sm">
                 <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                         <User size={24} />
                     </div>
                     <div>
                         <h3 className="font-bold text-slate-800">User Profile</h3>
                         <p className="text-xs text-slate-500">Free Plan</p>
                     </div>
                 </div>
                 <button className="text-slate-400 hover:text-slate-600"><ChevronRight size={20}/></button>
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
                    value={darkMode} 
                    setValue={setDarkMode} 
                />
                <SettingItem 
                    icon={Bell} 
                    label="Daily Reminders" 
                    subLabel="Notifications at 8:00 PM" 
                    value={notifications} 
                    setValue={setNotifications} 
                />
                 <SettingItem 
                    icon={Globe} 
                    label="Language" 
                    subLabel={language === 'en' ? "English (US)" : "Korean (한국어)"}
                    colorClass="text-blue-600"
                    bgClass="bg-blue-50"
                    customAction={
                        <button 
                            onClick={() => setLanguage(l => l === 'en' ? 'ko' : 'en')}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-colors"
                        >
                            {language === 'en' ? 'EN' : 'KO'}
                        </button>
                    }
                />
            </div>
        </section>

        {/* Section: Privacy & Data */}
        <section className="space-y-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Privacy & Data</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-50">
                 <SettingItem 
                    icon={Lock} 
                    label="App Lock" 
                    subLabel="Require authentication on entry" 
                    value={appLock} 
                    setValue={setAppLock} 
                    colorClass="text-indigo-600"
                    bgClass="bg-indigo-50"
                />
                <SettingItem 
                    icon={Cloud} 
                    label="Cloud Sync" 
                    subLabel="Backup data to cloud" 
                    value={cloudSync} 
                    setValue={setCloudSync} 
                    colorClass="text-sky-600"
                    bgClass="bg-sky-50"
                />
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
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Version 5.0.0</span>
            </div>
        </div>
    </div>
  );
};

export default SettingsPage;
