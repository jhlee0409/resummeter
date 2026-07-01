/**
 * sessionStorage 기반 useState.
 * 페이지 새로고침 시 상태 유지, 탭 닫으면 소실.
 */

import { useState, useEffect } from 'react';

/**
 * @param sanitize 저장 직전 값을 가공(예: 대용량 base64 제거)하는 안정적인(모듈 레벨) 함수.
 *   메모리 상태는 원본 그대로 유지되고, sessionStorage에는 가공본만 직렬화된다.
 *   sanitize 없이 대용량 값을 그대로 저장하면 쿼터 초과로 전체 저장이 조용히 실패한다.
 */
export function useSessionState<T>(
  key: string,
  initialValue: T,
  sanitize?: (value: T) => T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
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
      sessionStorage.setItem(key, JSON.stringify(sanitize ? sanitize(value) : value));
    } catch {
      // sessionStorage full or disabled — silent
    }
    // sanitize는 모듈 레벨 안정 함수로 가정 → deps에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  return [value, setValue];
}
