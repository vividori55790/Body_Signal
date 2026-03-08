import React, { useState, useEffect } from 'react';
import { Lock, Fingerprint, Delete, AlertCircle } from 'lucide-react';

const LockScreen = ({ onUnlock }) => {
    const [pinCode, setPinCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    
    // Check if biometric is enabled on mount
    useEffect(() => {
        const bio = localStorage.getItem('bs-biometric') === 'true';
        setBiometricEnabled(bio);
        if (bio) {
            handleBiometricUnlock();
        }
    }, []);

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

    const verifyPin = (enteredPin) => {
        const storedPin = localStorage.getItem('bs-pin') || '';
        
        // If no PIN was actually stored (edge case handling)
        if (!storedPin) {
           onUnlock();
           return;
        }

        if (enteredPin === storedPin) {
            onUnlock();
        } else {
            setErrorMsg('Incorrect PIN. Try again.');
            setTimeout(() => setPinCode(''), 500); // Shaking animation simulation timeout
        }
    };

    const handleBiometricUnlock = async () => {
        // Mocking WebAuthentication API for fingerprint
        // A real implementation requires secure a WebAuthn server or Capacitor Biometric plugin.
        if (window.navigator.credentials && window.PublicKeyCredential) {
            // Using a dummy logic to simulate biometric prompt
            // To test UI, we just simulate the native dialog timeout
            setTimeout(() => {
                const isSuccess = window.confirm("Biometric Authentication Prompt (Simulated).\\nClick OK to simulate fingerprint Scan.");
                if (isSuccess) {
                    onUnlock();
                } else {
                    setErrorMsg('Biometric failed or cancelled.');
                }
            }, 300);
        } else {
             // Fallback prompt for demo purposes
             const isSuccess = window.confirm("Simulating Fingerprint...\\nClick OK to unlock.");
             if (isSuccess) onUnlock();
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
                  
                  <div className="flex items-center justify-center">
                      {biometricEnabled ? (
                          <button 
                             onClick={handleBiometricUnlock}
                             className="w-16 h-16 rounded-full flex items-center justify-center text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition-all outline-none"
                          >
                             <Fingerprint size={32} />
                          </button>
                      ) : <div/>}
                  </div>
                  
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
