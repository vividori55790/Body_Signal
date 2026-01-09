import React, { useState } from 'react';
import { Download, Trash2, Github, Mail, Shield, Moon, Bell, ToggleRight, ToggleLeft } from 'lucide-react';

const SettingsPage = ({ onExport, onReset }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="min-h-screen bg-bg p-4 pb-24 space-y-8">
       <header>
           <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
           <p className="text-slate-500 text-sm">App configuration</p>
       </header>

        {/* Section: Appearance & Logic */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preferences</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                            <Moon size={20} />
                        </div>
                        <div className="font-bold text-slate-700">Dark Mode</div>
                    </div>
                    <button onClick={() => setDarkMode(!darkMode)} className={`text-2xl ${darkMode ? 'text-primary' : 'text-slate-300'}`}>
                        {darkMode ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                    </button>
                </div>
                
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                            <Bell size={20} />
                        </div>
                        <div className="font-bold text-slate-700">Daily Reminders</div>
                    </div>
                    <button onClick={() => setNotifications(!notifications)} className={`text-2xl ${notifications ? 'text-primary' : 'text-slate-300'}`}>
                        {notifications ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                    </button>
                </div>
            </div>
        </section>

        {/* Section: Data Management */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Data Management</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button 
                  onClick={onExport}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 border-b border-slate-100"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <Download size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-700">Export Data</div>
                            <div className="text-xs text-slate-400">Download JSON backup</div>
                        </div>
                    </div>
                </button>
                <button 
                  onClick={() => {
                      if (window.confirm("Are you sure? This will verify the 'Reset' functionality.")) {
                          onReset();
                      }
                  }}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-rose-50 active:bg-rose-100 group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-100 text-rose-600 rounded-lg group-hover:bg-rose-200">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-rose-600">Reset Application</div>
                            <div className="text-xs text-slate-400">Clear all local data</div>
                        </div>
                    </div>
                </button>
            </div>
        </section>

        {/* Section: About */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">About</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 flex items-center gap-3 border-b border-slate-100">
                    <Shield size={20} className="text-slate-400" />
                    <span className="text-slate-600 font-medium">Version 5.0.0 (AI Enhanced)</span>
                </div>
            </div>
        </section>
        
        <div className="text-center text-xs text-slate-300 mt-10">
            Body Signal PWA v5
        </div>
    </div>
  );
};

export default SettingsPage;
