import React, { useState } from 'react';
import { Lock, Delete, AlertCircle } from 'lucide-react';
import { clearFailedAttempts, getLockoutRemaining, registerFailedAttempt, verifyPin as verifyStoredPin } from '../utils/pin';

const LockScreen = ({ onUnlock }) => {
    const [pinCode, setPinCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleNumberClick = (num) => {
        if (pinCode.length < 4) {
            const newPin = pinCode + num;
            setPinCode(newPin);
            setErrorMsg('');
            
            if (newPin.length === 4) {
                setTimeout(() => verifyPin(newPin), 100);
            }
        }
    };

    const handleDelete = () => {
        setPinCode(prev => prev.slice(0, -1));
        setErrorMsg('');
    };

    const verifyPin = async (enteredPin) => {
        const remaining = getLockoutRemaining();
        if (remaining > 0) {
            setErrorMsg(`Too many attempts. Try again in ${Math.ceil(remaining / 1000)}s.`);
            setPinCode('');
            return;
        }

        if (await verifyStoredPin(enteredPin)) {
            clearFailedAttempts();
            onUnlock();
        } else {
            const lockout = registerFailedAttempt();
            setErrorMsg(lockout ? 'Too many attempts. Try again in 30s.' : 'Incorrect PIN. Try again.');
            setTimeout(() => setPinCode(''), 500); // Shaking animation simulation timeout
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col items-center justify-center animate-in fade-in">
             <div className="mb-10 text-center text-white">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                      <Lock size={32} className="text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-bold tracking-wider">ENTER PIN</h2>
             </div>

             <div className="flex gap-4 mb-4">
                  {[...Array(4)].map((_, i) => (
                      <div 
                         key={i} 
                         className={`w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${
                             pinCode.length > i 
                                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] scale-110' 
                                : 'bg-slate-700 border border-slate-600'
                         }`}
                      />
                  ))}
             </div>
             
             <div className="h-6 flex items-center justify-center mb-10 w-full text-rose-400 text-sm font-bold tracking-wide">
                  {errorMsg && <div className="flex items-center gap-1.5 animate-in slide-in-from-top-2 fade-in"><AlertCircle size={14}/> {errorMsg}</div>}
             </div>

             <div className="grid grid-cols-3 gap-6 max-w-[280px] text-white">
                  {[1,2,3,4,5,6,7,8,9].map(num => (
                      <button 
                         key={num}
                         onClick={() => handleNumberClick(num.toString())}
                         className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold bg-slate-800/50 hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all outline-none"
                      >
                          {num}
                      </button>
                  ))}
                  
                  <div />
                  
                  <button 
                      onClick={() => handleNumberClick('0')}
                      className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold bg-slate-800/50 hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all outline-none"
                  >
                      0
                  </button>
                  
                  <div className="flex items-center justify-center">
                     <button 
                         onClick={handleDelete}
                         className="w-16 h-16 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-all outline-none"
                     >
                         <Delete size={28} />
                     </button>
                  </div>
             </div>
        </div>
    );
};

export default LockScreen;
