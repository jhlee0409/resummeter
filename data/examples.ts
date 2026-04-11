export interface ResumeExample {
  id: string;
  industry: string;
  position: string;
  level: 'junior' | 'senior';
  section: string;
  title: string;
  content: string;
  analysis: {
    strengths: string[];
    keywords: string[];
    pattern: string;
  };
}

export const resumeExamples: ResumeExample[] = [
  // IT 업종
  {
    id: 'it-1',
    industry: 'IT',
    position: '백엔드 개발자',
    level: 'junior',
    section: '프로젝트 경험',
    title: '대용량 데이터 처리 API 개발',
    content: `일 평균 50만 건의 주문 데이터를 실시간 처리하는 API를 설계하고 구현했습니다. 기존 동기 처리 방식에서 발생하던 평균 응답시간 3.2초를 Redis 캐싱과 비동기 큐(Kafka) 도입으로 0.4초로 단축했습니다. 장애 발생 시 자동 복구되는 Circuit Breaker 패턴을 적용해 서비스 가용성을 99.5%에서 99.95%로 개선했습니다. 팀 내 코드 리뷰 프로세스를 제안해 PR 머지 전 리뷰 커버리지를 100%로 끌어올렸고, 이 과정에서 월 평균 12건의 잠재적 버그를 사전에 발견했습니다.`,
    analysis: {
      strengths: ['구체적 수치(50만 건, 3.2초→0.4초)', '기술적 의사결정 근거 명시', '팀 기여도 포함'],
      keywords: ['대용량 데이터', 'Redis', 'Kafka', 'Circuit Breaker', '코드 리뷰', '가용성'],
      pattern: '문제 인식 → 기술적 해결 → 정량적 성과 → 팀 기여',
    },
  },
  {
    id: 'it-2',
    industry: 'IT',
    position: '프론트엔드 개발자',
    level: 'junior',
    section: '기술 역량',
    title: '사용자 경험 최적화 프로젝트',
    content: `서비스 메인 페이지의 Core Web Vitals 점수를 개선하는 프로젝트를 주도했습니다. Lighthouse 분석 결과 LCP 4.2초, CLS 0.25로 측정되어 '개선 필요' 수준이었습니다. 이미지 lazy loading과 Next.js Image 컴포넌트 전환, 불필요한 JS 번들 55KB 제거, 폰트 프리로드 적용을 통해 LCP 1.8초, CLS 0.05로 개선했습니다. 그 결과 Google Search Console 기준 모바일 노출 수가 23% 증가했고, 이탈률이 18%에서 11%로 감소했습니다.`,
    analysis: {
      strengths: ['Before/After 수치 명확', '비즈니스 임팩트 연결(노출 수, 이탈률)', '구체적 기술 나열'],
      keywords: ['Core Web Vitals', 'LCP', 'CLS', 'Lighthouse', 'lazy loading', '번들 최적화'],
      pattern: '현황 진단(수치) → 개선 시도(기술) → 결과(수치) → 비즈니스 효과',
    },
  },
  {
    id: 'it-3',
    industry: 'IT',
    position: '풀스택 개발자',
    level: 'senior',
    section: '경력 기술',
    title: '마이크로서비스 아키텍처 전환',
    content: `모놀리식 서비스(MAU 120만)를 8개 마이크로서비스로 분리하는 프로젝트를 테크 리드로 이끌었습니다. 도메인 분석을 통해 서비스 경계를 정의하고, 점진적 마이그레이션 전략(Strangler Fig)을 수립하여 6개월간 무중단으로 전환을 완료했습니다. API Gateway(Kong)와 Service Mesh(Istio) 도입으로 서비스 간 통신 안정성을 확보하고, 분산 트레이싱(Jaeger)으로 장애 원인 파악 시간을 평균 45분에서 8분으로 단축했습니다. 전환 이후 배포 빈도가 월 2회에서 일 3회로 향상되었고, 개별 서비스별 독립 스케일링이 가능해져 인프라 비용을 월 320만원 절감했습니다.`,
    analysis: {
      strengths: ['프로젝트 규모 명시(MAU)', '리더십 역할', '기술 의사결정 과정', '비용 절감 수치'],
      keywords: ['마이크로서비스', 'Strangler Fig', 'API Gateway', 'Service Mesh', '분산 트레이싱', '무중단'],
      pattern: '프로젝트 규모 → 역할(리드) → 기술 전략 → 정량 성과 → 비즈니스 임팩트',
    },
  },

  // 금융 업종
  {
    id: 'fin-1',
    industry: '금융',
    position: '자산운용',
    level: 'junior',
    section: '인턴 경험',
    title: '포트폴리오 리밸런싱 보조',
    content: `자산운용본부 인턴으로 AUM 2,000억원 규모 채권 포트폴리오의 리밸런싱 업무를 보조했습니다. 만기별·신용등급별 채권 분포를 일일 모니터링하고, 금리 시나리오(±50bp, ±100bp)에 따른 포트폴리오 가치 변동을 시뮬레이션하여 주간 보고서를 작성했습니다. Python(pandas, matplotlib)으로 섹터별 스프레드 추이 자동 수집 스크립트를 개발해 수작업 대비 일 2시간의 분석 시간을 절감했습니다. 해당 보고서는 운용역 투자의사결정 자료로 활용되었습니다.`,
    analysis: {
      strengths: ['운용 규모 명시(AUM)', '구체적 업무 내용', '자동화 성과(시간 절감)', '실무 기여도'],
      keywords: ['포트폴리오', '리밸런싱', '금리 시나리오', '신용등급', '스프레드', 'Python'],
      pattern: '업무 범위(규모) → 구체적 수행 내용 → 자동화/개선 → 실무 기여',
    },
  },
  {
    id: 'fin-2',
    industry: '금융',
    position: '리스크관리',
    level: 'senior',
    section: '경력 기술',
    title: '시장리스크 관리체계 고도화',
    content: `시장리스크관리팀에서 VaR 모델 고도화 프로젝트를 주관했습니다. 기존 분산-공분산 방식의 VaR가 Tail Risk를 과소평가하는 문제를 파악하고, Historical Simulation과 Monte Carlo 방식을 병행하는 하이브리드 모델을 설계했습니다. 백테스팅 결과 모델 예외 건수가 연 12건에서 3건으로 감소하여 바젤III 기준 Green Zone을 유지했습니다. 스트레스 테스트 시나리오를 기존 8개에서 24개로 확대하고, 매크로 변수 연동 자동화를 구현해 월별 보고서 작성 소요시간을 5일에서 1.5일로 단축했습니다.`,
    analysis: {
      strengths: ['전문 용어 정확 사용', '문제 인식→해결 구조', '규제 기준 충족(바젤III)', '정량 성과 다수'],
      keywords: ['VaR', 'Historical Simulation', 'Monte Carlo', '백테스팅', '바젤III', '스트레스 테스트'],
      pattern: '문제 파악 → 기술적 해결(모델) → 규제 준수 성과 → 효율화 성과',
    },
  },

  // 제조 업종
  {
    id: 'mfg-1',
    industry: '제조',
    position: '생산기술',
    level: 'junior',
    section: '인턴 경험',
    title: '공정 불량률 분석 및 개선',
    content: `생산기술팀 인턴으로 SMT 라인의 솔더링 불량 원인을 분석했습니다. 3개월간 불량 데이터 1,200건을 수집·분류하고 파레토 분석을 실시한 결과, 전체 불량의 68%가 리플로우 온도 프로파일과 스텐실 개구부 크기 2가지 요인에 집중됨을 확인했습니다. 온도 프로파일 최적화 실험(DOE)을 설계하고 6회 반복 테스트를 수행하여, 피크 온도를 245°C에서 240°C로 조정했을 때 솔더 브릿지 불량이 42% 감소하는 최적 조건을 도출했습니다. 개선안 적용 후 라인 수율이 97.2%에서 98.8%로 향상되었습니다.`,
    analysis: {
      strengths: ['데이터 기반 분석(1,200건)', 'DOE 적용', '구체적 수치(온도, 불량률)', '개선 전후 수율 비교'],
      keywords: ['SMT', '리플로우', '파레토 분석', 'DOE', '수율', '공정 최적화'],
      pattern: '분석 대상 → 데이터 수집/분석 → 실험 설계 → 최적 조건 도출 → 성과',
    },
  },
  {
    id: 'mfg-2',
    industry: '제조',
    position: '품질관리',
    level: 'senior',
    section: '경력 기술',
    title: '6시그마 프로젝트 리딩',
    content: `자동차 부품 제조라인의 치수 불량률 저감을 위한 6시그마 BB 프로젝트를 리딩했습니다. DMAIC 방법론에 따라 현 공정능력(Cpk 0.83)을 측정하고, 게이지 R&R 분석으로 측정 시스템 변동(14.2%)을 먼저 개선했습니다. 다중회귀분석으로 금형 온도, 사출 압력, 보압 시간 3개 핵심 인자를 선별하고, 반응표면법(RSM)으로 최적 조건을 설정했습니다. 프로젝트 완료 후 Cpk 1.67을 달성하여 고객사 품질 감사에서 A등급을 획득했으며, 연간 불량 비용 1.2억원을 절감했습니다.`,
    analysis: {
      strengths: ['DMAIC 구조 명확', '통계 도구 활용(Cpk, R&R, RSM)', '고객사 평가 결과', '비용 절감 수치'],
      keywords: ['6시그마', 'DMAIC', 'Cpk', '게이지 R&R', 'RSM', '품질 감사'],
      pattern: '프로젝트 목표 → 측정/분석(통계) → 개선(최적화) → 성과(품질+비용)',
    },
  },

  // 공공 업종
  {
    id: 'pub-1',
    industry: '공공',
    position: '행정',
    level: 'junior',
    section: '직무 경험',
    title: '민원 처리 프로세스 개선',
    content: `시민소통팀에서 6개월간 민원 접수·처리 업무를 담당했습니다. 일 평균 45건의 민원을 처리하면서 반복 민원 유형을 분석한 결과, 전체 민원의 35%가 동일한 5개 주제(주차, 소음, 도로, 공원, 쓰레기)에 집중됨을 파악했습니다. 해당 주제별 FAQ 안내문과 처리 절차 매뉴얼을 작성하여 부서 내 공유했고, 이를 통해 유형별 평균 처리시간이 3.5일에서 1.8일로 단축되었습니다. 또한 민원 접수 양식을 개선하여 불완전 접수율을 22%에서 7%로 낮추었습니다.`,
    analysis: {
      strengths: ['처리 건수 명시', '데이터 기반 분석', '개선 이니셔티브', '정량 성과(시간 단축, 접수율)'],
      keywords: ['민원 처리', '프로세스 개선', 'FAQ', '매뉴얼', '처리시간 단축'],
      pattern: '업무 범위 → 문제 분석 → 개선 제안 → 정량 성과',
    },
  },
  {
    id: 'pub-2',
    industry: '공공',
    position: '사업관리',
    level: 'senior',
    section: '경력 기술',
    title: '디지털 전환 사업 기획 및 실행',
    content: `정보화전략팀에서 기관 디지털 전환 3개년 마스터플랜(총 예산 48억원)의 수립과 1차년도 사업 실행을 총괄했습니다. 28개 부서 업무 프로세스 현황 조사를 통해 디지털화 우선순위를 도출하고, RPA 도입 대상 업무 15건을 선정했습니다. 1차년도에 5건의 RPA 프로세스를 구축하여 연간 8,400시간의 반복 업무를 자동화했고, 직원 만족도 조사에서 '업무 효율성' 항목이 3.2점에서 4.1점(5점 만점)으로 상승했습니다. 사업 결과 행정안전부 디지털 혁신 우수기관으로 선정되었습니다.`,
    analysis: {
      strengths: ['사업 규모 명시(예산)', '체계적 추진 과정', '정량 성과(시간, 만족도)', '대외 인정'],
      keywords: ['디지털 전환', 'RPA', '마스터플랜', '업무 프로세스', '행정안전부', '우수기관'],
      pattern: '사업 규모 → 추진 과정(분석→선정→구축) → 정량 성과 → 대외 인정',
    },
  },
];

export const getExamplesByIndustry = (industry: string): ResumeExample[] =>
  resumeExamples.filter(e => e.industry === industry);

export const exampleIndustries = ['IT', '금융', '제조', '공공'] as const;
