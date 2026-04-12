/**
 * sessionStorage 기반 useState.
 * 페이지 새로고침 시 상태 유지, 탭 닫으면 소실.
 */

import { useState, useEffect } from 'react';

export function useSessionState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw === null) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // sessionStorage full or disabled — silent
    }
  }, [key, value]);

  return [value, setValue];
}
