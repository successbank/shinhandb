import { redirect } from 'next/navigation';

/**
 * 루트 페이지
 * 회원제 웹사이트이므로 로그인 페이지로 즉시 리다이렉트
 */
export default function Home() {
  redirect('/login');
}
