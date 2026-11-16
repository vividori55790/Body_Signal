import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, History, Stethoscope, Settings, FileCheck2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAcutePain } from '../context/AcutePainContext';
import { triggerHaptic } from '../utils/native';

export const Layout: React.FC = () => {
  const { settings, t } = useSettings();
  const { openAcute } = useAcutePain();

  const navItems = [
    { path: '/', icon: Home, label: t('navDash') },
    { path: '/history', icon: History, label: t('navHistory') },
    ...(settings.showDiagnosticsTab === true
      ? [{ path: '/diagnostics', icon: FileCheck2, label: t('navDiagnostics') }]
      : []),
    { path: '/briefing', icon: Stethoscope, label: t('navBriefing'), highlight: true },
    { path: '/settings', icon: Settings, label: t('navSettings') },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto">
        <Outlet />
      </main>

      {/* Optional Floating Quick SOS Widget (Opt-in via Settings, default OFF) */}
      {settings.quickSosEnabled === true && (
        <aside aria-label="1초 급성 통증 기록 위젯" className="fixed bottom-20 right-4 z-40 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              openAcute();
            }}
            aria-label="지금 너무 아파요 1초 급성 통증 기록"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs shadow-lg ring-1 ring-rose-400/50 active:scale-95 transition-all"
          >
            <span>1초 긴급 기록</span>
          </button>
        </aside>
      )}

      {/* Mobile Safe Area Bottom Navigation (4 core tabs by default) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg">
        <div className="flex justify-around items-center max-w-md mx-auto h-14">
          {navItems.map(({ path, icon: Icon, label, highlight }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => triggerHaptic()}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all duration-150 select-none ${
                  isActive
                    ? highlight
                      ? 'text-teal-700 dark:text-teal-400 font-bold'
                      : 'text-emerald-700 dark:text-emerald-400 font-bold'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
                }`
              }
            >
              <Icon size={20} strokeWidth={2.1} />
              <span className="text-[11px] tracking-tight">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
