import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, History, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const BottomNav = () => {
    const navItems = [
        { path: '/', icon: Home, label: 'Dash' },
        { path: '/history', icon: History, label: 'History' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-md border-t border-white/5 pb-safe pt-2 px-6 z-50">
            <div className="flex justify-around items-center max-w-md mx-auto h-16">
                {navItems.map(({ path, icon: Icon, label }) => (
                    <NavLink
                        key={path}
                        to={path}
                        className={({ isActive }) => cn(
                            "flex flex-col items-center justify-center w-16 gap-1 transition-colors duration-200",
                            isActive ? "text-primary" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <Icon size={24} />
                        <span className="text-[10px] font-medium">{label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

const Layout = () => {
  return (
    <div className="min-h-screen bg-bg text-white font-sans flex flex-col">
        {/* Main content wrapper */}
        <div className="flex-1 pb-24 mx-auto w-full max-w-md">
            <Outlet />
        </div>
        <BottomNav />
    </div>
  );
};

export default Layout;
