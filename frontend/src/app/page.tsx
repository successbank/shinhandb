export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-shinhan-lightGray">
      <div className="max-w-content mx-auto px-6 text-center">
        <h1 className="text-4xl font-bold text-shinhan-blue mb-4">
          신한금융 광고관리 플랫폼
        </h1>
        <p className="text-xl text-shinhan-darkGray mb-8">
          신한금융지주 및 신한은행의 광고 자료 통합 검색 및 관리 시스템
        </p>
        <div className="bg-white rounded-lg shadow-md p-8 border border-shinhan-border">
          <p className="text-shinhan-darkGray">
            프로젝트 환경 설정 중입니다...
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="p-4 bg-shinhan-lightGray rounded">
              <h3 className="font-semibold text-shinhan-blue mb-2">Frontend</h3>
              <p className="text-sm text-shinhan-darkGray">Next.js 14.2.5 + TypeScript</p>
            </div>
            <div className="p-4 bg-shinhan-lightGray rounded">
              <h3 className="font-semibold text-shinhan-blue mb-2">Backend</h3>
              <p className="text-sm text-shinhan-darkGray">Express.js + PostgreSQL</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
