/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Fingerprint, Lock, Unlock, X, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  authenticateWithBiometrics,
  verifyPin,
  isBiometricsSupported,
  getVaultConfig,
} from '../utils/securityVault';

interface BiometricSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  resourceName?: string;
}

export const BiometricSecurityModal: React.FC<BiometricSecurityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  resourceName = 'RESTRICTED NEURAL VAULT',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setIsSuccess(false);
      isBiometricsSupported().then((supported) => {
        setHasBiometrics(supported);
        if (supported && getVaultConfig().useBiometricsIfAvailable) {
          triggerBiometricScan();
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerBiometricScan = async () => {
    setIsScanning(true);
    setError(null);
    try {
      const ok = await authenticateWithBiometrics();
      if (ok) {
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 600);
      } else {
        setError('Biometric verification failed. Please enter your 4-digit Cyber PIN.');
      }
    } catch (e: any) {
      setError(e?.message || 'Biometric scan interrupted.');
    } finally {
      setIsScanning(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);
      if (newPin.length === 4) {
        if (verifyPin(newPin)) {
          setIsSuccess(true);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 600);
        } else {
          setError('Access Denied: Invalid Security PIN.');
          setPin('');
        }
      }
    }
  };

  const handleDeleteDigit = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm flex flex-col bg-slate-950 border border-cyan-500/60 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.4)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-900/60 bg-gradient-to-r from-cyan-950/80 via-slate-950 to-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center glow-box-cyan">
              <Shield className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-hud font-bold text-xs text-cyan-100 tracking-wider">
                CORE BIOMETRIC SECURITY VAULT
              </h2>
              <p className="text-[10px] font-tech text-cyan-400/80 tracking-widest uppercase">
                {resourceName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-cyan-900/60 text-cyan-400 hover:text-white hover:border-cyan-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center">
          {/* Biometric Status Icon */}
          <div className="relative my-3 flex items-center justify-center">
            <div
              className={`w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                isSuccess
                  ? 'border-emerald-400 bg-emerald-950/50 shadow-[0_0_30px_#34d399]'
                  : isScanning
                  ? 'border-cyan-400 bg-cyan-950/60 shadow-[0_0_30px_#22d3ee] animate-pulse'
                  : 'border-cyan-600/60 bg-slate-900/90'
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-scale-up" />
              ) : hasBiometrics ? (
                <Fingerprint
                  className={`w-10 h-10 ${isScanning ? 'text-cyan-300 animate-pulse' : 'text-cyan-400'}`}
                />
              ) : (
                <Lock className="w-9 h-9 text-cyan-400" />
              )}
            </div>

            {/* Scanning radar sweep line */}
            {isScanning && (
              <span className="absolute inset-0 rounded-full border-2 border-cyan-300 animate-ping opacity-75" />
            )}
          </div>

          <h3 className="font-hud font-semibold text-sm text-cyan-100 mt-2 tracking-wide">
            {isSuccess
              ? 'ACCESS GRANTED // VAULT UNLOCKED'
              : isScanning
              ? 'SCANNING BIOMETRICS...'
              : 'SECURITY AUTHORIZATION REQUIRED'}
          </h3>
          <p className="text-xs text-cyan-400/70 mt-1 font-tech max-w-xs">
            Authenticate using device fingerprint or enter your 4-digit Cyber PIN (Default: 1234)
          </p>

          {/* Biometric Scan Trigger Button if available */}
          {hasBiometrics && !isSuccess && (
            <button
              onClick={triggerBiometricScan}
              disabled={isScanning}
              className="mt-3 px-4 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/70 text-cyan-300 hover:border-cyan-300 text-xs font-hud font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
            >
              <Fingerprint className="w-4 h-4 text-cyan-400" />
              <span>{isScanning ? 'SCANNING SENSOR...' : 'USE BIOMETRIC SENSOR'}</span>
            </button>
          )}

          {/* PIN Indicators */}
          <div className="flex items-center gap-3 my-5">
            {[0, 1, 2, 3].map((idx) => {
              const filled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                    filled
                      ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_10px_#22d3ee] scale-110'
                      : 'border-cyan-700/60 bg-slate-900'
                  }`}
                />
              );
            })}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-3 px-3 py-1.5 rounded-lg bg-red-950/70 border border-red-500/60 text-red-200 text-xs flex items-center gap-1.5 animate-shake">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[220px]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                onClick={() => handlePinDigit(digit)}
                className="py-2.5 rounded-xl bg-slate-900/80 border border-cyan-800/60 text-cyan-100 font-mono text-base font-bold hover:bg-cyan-950/60 hover:border-cyan-500 active:scale-90 transition-all"
              >
                {digit}
              </button>
            ))}
            <button
              onClick={() => setPin('')}
              className="py-2.5 rounded-xl bg-slate-900/60 border border-cyan-900/60 text-cyan-500 font-tech text-xs hover:border-cyan-700 active:scale-90 transition-all"
            >
              CLEAR
            </button>
            <button
              onClick={() => handlePinDigit('0')}
              className="py-2.5 rounded-xl bg-slate-900/80 border border-cyan-800/60 text-cyan-100 font-mono text-base font-bold hover:bg-cyan-950/60 hover:border-cyan-500 active:scale-90 transition-all"
            >
              0
            </button>
            <button
              onClick={handleDeleteDigit}
              className="py-2.5 rounded-xl bg-slate-900/60 border border-cyan-900/60 text-cyan-400 font-tech text-xs hover:border-cyan-700 active:scale-90 transition-all"
            >
              DEL
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-cyan-950 bg-black/80 flex items-center justify-between text-[10px] font-tech text-cyan-500">
          <span>AES-256 ENCRYPTED HARDWARE GATE</span>
          <button
            onClick={onClose}
            className="text-cyan-400/80 hover:text-cyan-300 font-mono underline"
          >
            ABORT
          </button>
        </div>
      </div>
    </div>
  );
};
