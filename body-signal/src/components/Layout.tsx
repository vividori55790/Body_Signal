import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Calendar, History, Stethoscope, Settings } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { triggerHaptic } from '../utils/native';

export const Layout: React.FC = () => {
  const { t } = useSettings();

  const navItems = [
    { path: '/', icon: Home, label: t('navDash') },
    { path: '/calendar', icon: Calendar, label: t('navCalendar') },
    { path: '/history', icon: History, label: t('navHistory') },
    { path: '/briefing', icon: Stethoscope, label: t('navBriefing'), highlight: true },
    { path: '/settings', icon: Settings, label: t('navSettings') },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto">
        <Outlet />
      </main>

      {/* Mobile Safe Area Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg"
      >
        <div className="flex justify-around items-center max-w-md mx-auto h-14">
          {navItems.map(({ path, icon: Icon, label, highlight }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => triggerHaptic()}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all duration-200 select-none ${
                  isActive
                    ? highlight
                      ? 'text-teal-600 dark:text-teal-400 font-bold scale-105'
                      : 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
                }`
              }
            >
              {highlight ? (
                <div className="relative">
                  <Icon size={20} strokeWidth={2.5} />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                </div>
              ) : (
                <Icon size={20} strokeWidth={2} />
              )}
              <span className="text-[10px] tracking-tight">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
