'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { getContentById, mypageApi, contentApi } from '@/lib/api';

interface ContentDetailModalProps {
  contentId: string;
  isOpen: boolean;
  onClose: () => void;
  onTagClick?: (tag: string) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  userRole?: string;
}

export default function ContentDetailModal({
  contentId,
  isOpen,
  onClose,
  onTagClick,
  onNavigate,
  userRole,
}: ContentDetailModalProps) {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [showTagEdit, setShowTagEdit] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [editingTags, setEditingTags] = useState<any[]>([]);
  const [bookmarkMemo, setBookmarkMemo] = useState('');
  const [showMemoEdit, setShowMemoEdit] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [images, setImages] = useState<string[]>([]);

  // 애니메이션 상태
  const [isVisible, setIsVisible] = useState(false);

  // 터치 제스처
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    if (isOpen && contentId) {
      // 애니메이션 시작
      setIsVisible(false);
      setTimeout(() => setIsVisible(true), 10);

      loadContentDetail();
      checkBookmarkStatus();

      // 최근 본 콘텐츠에 추가
      addToRecentlyViewed(contentId);
    } else {
      setIsVisible(false);
    }
  }, [isOpen, contentId]);

  // 키보드 단축키
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC: 이미지 줌이 열려있으면 줌 닫기, 아니면 모달 닫기
      if (e.key === 'Escape') {
        if (showImageZoom) {
          setShowImageZoom(false);
        } else if (showTagEdit) {
          setShowTagEdit(false);
        } else {
          onClose();
        }
      }
      // 좌/우 화살표: 이전/다음 콘텐츠
      else if (e.key === 'ArrowLeft' && onNavigate && !showTagEdit) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && onNavigate && !showTagEdit) {
        onNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNavigate, showImageZoom, showTagEdit]);

  const loadContentDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getContentById(contentId);
      setContent(response.data);
      setEditingTags(response.data.tags || []);

      // 이미지 갤러리 설정 (썸네일 + 원본)
      const imageList: string[] = [];
      if (response.data.thumbnailUrl) imageList.push(response.data.thumbnailUrl);
      if (response.data.fileUrl && response.data.fileType === 'IMAGE') {
        imageList.push(response.data.fileUrl);
      }
      setImages(imageList);
      setCurrentImageIndex(0);
    } catch (err: any) {
      setError(err.message || '콘텐츠를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const checkBookmarkStatus = async () => {
    try {
      const response = await mypageApi.getBookmarks();
      const bookmarks = response.data?.items || [];
      const bookmark = bookmarks.find((b: any) => b.contentId === contentId);
      if (bookmark) {
        setIsBookmarked(true);
        setBookmarkId(bookmark.id);
        setBookmarkMemo(bookmark.memo || '');
      } else {
        setIsBookmarked(false);
        setBookmarkId(null);
        setBookmarkMemo('');
      }
    } catch (err) {
      console.error('북마크 상태 확인 실패:', err);
    }
  };

  const addToRecentlyViewed = (contentId: string) => {
    try {
      const recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      const updated = [contentId, ...recent.filter((id: string) => id !== contentId)].slice(0, 20);
      localStorage.setItem('recentlyViewed', JSON.stringify(updated));
    } catch (err) {
      console.error('최근 본 콘텐츠 저장 실패:', err);
    }
  };

  const handleBookmarkToggle = async () => {
    try {
      if (isBookmarked && bookmarkId) {
        await mypageApi.deleteBookmark(bookmarkId);
        setIsBookmarked(false);
        setBookmarkId(null);
        setBookmarkMemo('');
        setShowMemoEdit(false);
        alert('보관함에서 제거되었습니다');
      } else {
        const response = await mypageApi.addBookmark(contentId, bookmarkMemo);
        setIsBookmarked(true);
        setBookmarkId(response.data.id);
        alert('보관함에 추가되었습니다');
      }
    } catch (err: any) {
      alert(err.message || '북마크 처리에 실패했습니다');
    }
  };

  const handleSaveMemo = async () => {
    if (!bookmarkId) return;

    try {
      await mypageApi.updateBookmarkMemo(bookmarkId, bookmarkMemo);
      alert('메모가 저장되었습니다');
      setShowMemoEdit(false);
    } catch (err: any) {
      alert(err.message || '메모 저장에 실패했습니다');
    }
  };

  const handleImageNavigate = (direction: 'prev' | 'next') => {
    if (images.length <= 1) return;

    if (direction === 'prev') {
      setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    } else {
      setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    }
  };

  // 터치 제스처 핸들러
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0 && onNavigate) {
        // 왼쪽 스와이프 -> 다음
        onNavigate('next');
      } else if (diff < 0 && onNavigate) {
        // 오른쪽 스와이프 -> 이전
        onNavigate('prev');
      }
    }
  };

  const handleDownload = async () => {
    if (!content?.fileUrl) return;

    try {
      // 파일 다운로드
      const response = await fetch(content.fileUrl);
      const blob = await response.blob();

      // 파일명 생성: 원본파일명_아이디_날짜시간.확장자
      const originalFileName = content.fileName || 'download';
      const username = content.uploaderUsername || 'user';

      // 날짜시간 포맷: YYYYMMDD_HHMMSS
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const dateTimeStr = `${year}${month}${day}_${hours}${minutes}${seconds}`;

      // 확장자 분리
      const lastDotIndex = originalFileName.lastIndexOf('.');
      const nameWithoutExt = lastDotIndex > 0 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
      const extension = lastDotIndex > 0 ? originalFileName.substring(lastDotIndex) : '';

      // 최종 파일명 조합
      const downloadFileName = `${nameWithoutExt}_${username}_${dateTimeStr}${extension}`;

      // 다운로드 실행
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('파일 다운로드에 실패했습니다');
    }
  };

  const handleCopyLink = () => {
    const url = window.location.origin + content?.fileUrl;

    // Clipboard API 사용 가능 여부 확인
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => {
        alert('링크가 클립보드에 복사되었습니다');
      }).catch(() => {
        fallbackCopyToClipboard(url);
      });
    } else {
      // HTTP 환경에서의 fallback 복사 방식
      fallbackCopyToClipboard(url);
    }
  };

  const fallbackCopyToClipboard = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        alert('링크가 클립보드에 복사되었습니다');
      } else {
        alert('복사에 실패했습니다. 링크: ' + text);
      }
    } catch (err) {
      alert('복사에 실패했습니다. 링크: ' + text);
    }

    document.body.removeChild(textarea);
  };

  const handleSocialShare = (platform: 'facebook' | 'twitter') => {
    const url = window.location.origin + content?.fileUrl;
    const text = content?.title || '신한금융 광고 콘텐츠';

    let shareUrl = '';
    if (platform === 'facebook') {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    } else if (platform === 'twitter') {
      shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  const handleTagClick = (tag: string) => {
    if (onTagClick) {
      onTagClick(tag);
      onClose(); // 모달 닫고 검색 결과로 이동
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) {
      alert('태그를 입력해주세요');
      return;
    }

    try {
      // 태그 업데이트 API 호출 (백엔드에 태그 업데이트 API 필요)
      const updatedTags = [...editingTags.map((t: any) => typeof t === 'string' ? t : t.name), newTag.trim()];
      await contentApi.updateContent(contentId, { tags: updatedTags });

      setEditingTags([...editingTags, { name: newTag.trim() }]);
      setNewTag('');
      alert('태그가 추가되었습니다');
      loadContentDetail(); // 새로고침
    } catch (err: any) {
      alert(err.message || '태그 추가에 실패했습니다');
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!confirm(`"${tagName}" 태그를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const updatedTags = editingTags
        .map((t: any) => typeof t === 'string' ? t : t.name)
        .filter((t: string) => t !== tagName);
      await contentApi.updateContent(contentId, { tags: updatedTags });

      setEditingTags(editingTags.filter((t: any) => {
        const name = typeof t === 'string' ? t : t.name;
        return name !== tagName;
      }));
      alert('태그가 삭제되었습니다');
      loadContentDetail(); // 새로고침
    } catch (err: any) {
      alert(err.message || '태그 삭제에 실패했습니다');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType?.toUpperCase()) {
      case 'IMAGE':
        return '🖼️';
      case 'VIDEO':
        return '🎥';
      case 'DOCUMENT':
        return '📄';
      case 'DESIGN':
        return '🎨';
      case 'ARCHIVE':
        return '📦';
      default:
        return '📁';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 메인 모달 */}
      <div
        className={`fixed inset-0 bg-black flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${
          isVisible ? 'bg-opacity-60' : 'bg-opacity-0'
        }`}
        onClick={onClose}
      >
        <div
          className={`bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 ${
            isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-shinhan-blue"></div>
              <p className="mt-4 text-gray-600">로딩 중...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                닫기
              </button>
            </div>
          ) : content ? (
            <div>
              {/* 헤더 */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-shinhan-darkGray flex items-center gap-2">
                  <span className="text-3xl">{getFileTypeIcon(content.fileType)}</span>
                  {content.title}
                </h2>
                <div className="flex items-center gap-2">
                  {/* 네비게이션 버튼 */}
                  {onNavigate && (
                    <>
                      <button
                        onClick={() => onNavigate('prev')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        title="이전 콘텐츠 (←)"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onNavigate('next')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        title="다음 콘텐츠 (→)"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div className="w-px h-6 bg-gray-300 mx-1"></div>
                    </>
                  )}
                  {/* 닫기 버튼 */}
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="닫기 (ESC)"
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 본문 */}
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 왼쪽: 이미지/미리보기 */}
                  <div className="space-y-4">
                    {/* 이미지 갤러리 */}
                    <div className="relative">
                      <div
                        className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden cursor-zoom-in group"
                        onClick={() => images.length > 0 && setShowImageZoom(true)}
                      >
                        {images.length > 0 ? (
                          <>
                            <Image
                              src={images[currentImageIndex]}
                              alt={content.title}
                              fill
                              sizes="(max-width: 1024px) 100vw, 50vw"
                              className="object-contain transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                              <svg className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-8xl">{getFileTypeIcon(content.fileType)}</span>
                          </div>
                        )}
                      </div>

                      {/* 갤러리 네비게이션 */}
                      {images.length > 1 && (
                        <>
                          <button
                            onClick={() => handleImageNavigate('prev')}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-lg transition-all"
                          >
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleImageNavigate('next')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-lg transition-all"
                          >
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                            {images.map((_, index) => (
                              <div
                                key={index}
                                className={`w-2 h-2 rounded-full transition-all ${
                                  index === currentImageIndex ? 'bg-white w-4' : 'bg-white bg-opacity-50'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleDownload}
                        className="px-4 py-3 bg-shinhan-blue text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        다운로드
                      </button>
                      <div className="relative">
                        <button
                          onClick={handleBookmarkToggle}
                          className={`w-full px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                            isBookmarked
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <svg className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          {isBookmarked ? '보관됨' : '보관함'}
                        </button>
                        {isBookmarked && (
                          <button
                            onClick={() => setShowMemoEdit(!showMemoEdit)}
                            className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 text-white rounded-full text-xs hover:bg-yellow-600 transition-colors"
                            title="메모"
                          >
                            📝
                          </button>
                        )}
                      </div>
                      <button
                        onClick={handleCopyLink}
                        className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        링크 복사
                      </button>
                      <div className="relative group">
                        <button className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          SNS 공유
                        </button>
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          <button
                            onClick={() => handleSocialShare('facebook')}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <span className="text-blue-600">📘</span> Facebook
                          </button>
                          <button
                            onClick={() => handleSocialShare('twitter')}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <span className="text-sky-500">🐦</span> Twitter
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 오른쪽: 상세 정보 */}
                  <div className="space-y-6">
                    {/* 북마크 메모 */}
                    {isBookmarked && showMemoEdit && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-yellow-800 mb-2">📝 개인 메모</h3>
                        <textarea
                          value={bookmarkMemo}
                          onChange={(e) => setBookmarkMemo(e.target.value)}
                          placeholder="이 콘텐츠에 대한 메모를 남겨보세요..."
                          className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          rows={3}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleSaveMemo}
                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600 transition-colors"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setShowMemoEdit(false)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 설명 */}
                    {content.description && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">설명</h3>
                        <p className="text-gray-600 leading-relaxed">{content.description}</p>
                      </div>
                    )}

                    {/* 태그 */}
                    {content.tags && content.tags.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-gray-700">
                            🏷️ 태그 ({content.tags.length}개)
                          </h3>
                          {userRole === 'ADMIN' && (
                            <button
                              onClick={() => setShowTagEdit(!showTagEdit)}
                              className="text-xs px-3 py-1 bg-shinhan-blue text-white rounded-full hover:bg-blue-600 transition-colors"
                            >
                              {showTagEdit ? '완료' : '편집'}
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {content.tags.map((tag: any, index: number) => {
                            const tagName = typeof tag === 'string' ? tag : tag.name;
                            return (
                              <span
                                key={tag.id || index}
                                onClick={() => !showTagEdit && handleTagClick(tagName)}
                                className={`inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-shinhan-blue rounded-full text-sm font-medium transition-colors ${
                                  showTagEdit
                                    ? 'cursor-default'
                                    : 'hover:from-blue-100 hover:to-indigo-100 cursor-pointer'
                                }`}
                              >
                                #{tagName}
                                {showTagEdit && userRole === 'ADMIN' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveTag(tagName);
                                    }}
                                    className="ml-2 text-red-500 hover:text-red-700"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                        {showTagEdit && userRole === 'ADMIN' && (
                          <div className="mt-3 flex gap-2">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                              placeholder="새 태그 입력"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-shinhan-blue"
                            />
                            <button
                              onClick={handleAddTag}
                              className="px-4 py-2 bg-shinhan-blue text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                            >
                              추가
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* OCR 텍스트 */}
                    {content.ocrText && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                          🤖 추출된 텍스트 (OCR)
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {content.ocrText}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 카테고리 */}
                    {content.categories && content.categories.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">카테고리</h3>
                        <div className="flex flex-wrap gap-2">
                          {content.categories.map((category: any, index: number) => (
                            <span
                              key={category.id || index}
                              className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-sm border border-purple-200"
                            >
                              {category.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 메타 정보 */}
                    <div className="border-t border-gray-200 pt-6 space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 w-24">업로더</span>
                        <span className="text-gray-900 font-medium">
                          {content.uploaderName}
                          {content.uploaderRole && (
                            <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                              {content.uploaderRole}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 w-24">업로드 일시</span>
                        <span className="text-gray-900">{formatDate(content.createdAt)}</span>
                      </div>
                      {content.updatedAt !== content.createdAt && (
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-500 w-24">수정 일시</span>
                          <span className="text-gray-900">{formatDate(content.updatedAt)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 w-24">파일 크기</span>
                        <span className="text-gray-900">{content.fileSize}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 w-24">파일 형식</span>
                        <span className="text-gray-900 uppercase">{content.fileType}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 푸터 */}
              <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-500">
                  💡 Tip: 태그를 클릭하면 해당 태그로 검색됩니다 {onNavigate && '| ← → 키로 이동'}
                </div>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 이미지 줌 모달 */}
      {showImageZoom && content?.fileUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowImageZoom(false)}
        >
          <div className="relative max-w-7xl max-h-[95vh] w-full h-full flex items-center justify-center">
            <button
              onClick={() => setShowImageZoom(false)}
              className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors z-10"
            >
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={content.fileUrl}
              alt={content.title}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
