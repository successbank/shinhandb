/**
 * 카카오 SDK 초기화 및 타입 정의
 */

declare global {
  interface Window {
    Kakao: any;
  }
}

const KAKAO_APP_KEY = 'e26c4e816e4189a56694941054c2f2ba';

/**
 * 카카오 SDK 초기화
 */
export const initKakao = () => {
  if (typeof window === 'undefined') return;

  if (window.Kakao && !window.Kakao.isInitialized()) {
    window.Kakao.init(KAKAO_APP_KEY);
    console.log('[Kakao] SDK initialized');
  }
};

/**
 * 카카오톡 공유하기
 */
export interface KakaoShareParams {
  title: string;
  description: string;
  imageUrl: string;
  webUrl: string;
}

export const shareKakao = (params: KakaoShareParams) => {
  if (!window.Kakao) {
    alert('카카오톡 공유 기능을 사용할 수 없습니다.');
    return;
  }

  try {
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: params.title,
        description: params.description,
        imageUrl: params.imageUrl,
        link: {
          webUrl: params.webUrl,
          mobileWebUrl: params.webUrl,
        },
      },
      buttons: [
        {
          title: '자세히 보기',
          link: {
            webUrl: params.webUrl,
            mobileWebUrl: params.webUrl,
          },
        },
      ],
    });
  } catch (error) {
    console.error('[Kakao] Share failed:', error);
    alert('카카오톡 공유에 실패했습니다.');
  }
};

/**
 * URL 클립보드 복사
 */
export const copyToClipboard = async (url: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        textArea.remove();
        return true;
      } catch (error) {
        console.error('[Clipboard] Fallback failed:', error);
        textArea.remove();
        return false;
      }
    }
  } catch (error) {
    console.error('[Clipboard] Copy failed:', error);
    return false;
  }
};
