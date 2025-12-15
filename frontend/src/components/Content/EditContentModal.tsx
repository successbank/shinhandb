'use client';

import { useState, useEffect } from 'react';
import { contentApi, getContentById } from '@/lib/api';

interface EditContentModalProps {
  contentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditContentModal({
  contentId,
  isOpen,
  onClose,
  onSuccess,
}: EditContentModalProps) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (isOpen && contentId) {
      loadContent();
    }
  }, [isOpen, contentId]);

  const loadContent = async () => {
    try {
      setLoading(true);
      const response = await getContentById(contentId);
      const data = response.data;
      setContent(data);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setTags(data.tags?.map((t: any) => t.name) || []);
    } catch (error: any) {
      alert(error.message || '콘텐츠 정보를 불러오는데 실패했습니다');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('제목을 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      await contentApi.updateContent(contentId, {
        title: title.trim(),
        description: description.trim() || null,
        tags,
      });

      alert('콘텐츠가 수정되었습니다');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.message || '콘텐츠 수정에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-shinhan-darkGray">콘텐츠 수정</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              placeholder="콘텐츠 제목을 입력하세요"
              className="w-full px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue disabled:bg-gray-100"
              required
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              placeholder="콘텐츠에 대한 설명을 입력하세요 (선택사항)"
              rows={4}
              className="w-full px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue disabled:bg-gray-100 resize-none"
            />
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-shinhan-darkGray mb-2">
              태그
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                disabled={loading}
                placeholder="태그를 입력하고 Enter 또는 추가 버튼을 클릭하세요"
                className="flex-1 px-4 py-2 border border-shinhan-border rounded-md focus:outline-none focus:ring-2 focus:ring-shinhan-blue disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={loading || !newTag.trim()}
                className="px-4 py-2 bg-shinhan-blue text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300"
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-shinhan-blue rounded-full text-sm"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    disabled={loading}
                    className="ml-1 text-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-gray-500">태그가 없습니다</p>
              )}
            </div>
          </div>

          {/* 파일 정보 (읽기 전용) */}
          {content && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-medium text-shinhan-darkGray mb-2">파일 정보</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">파일명:</span> {content.fileName}</p>
                <p><span className="font-medium">파일 타입:</span> {content.fileType}</p>
                <p><span className="font-medium">파일 크기:</span> {content.fileSize}</p>
                <p><span className="font-medium">업로더:</span> {content.uploaderName}</p>
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gray-200 text-shinhan-darkGray rounded-md hover:bg-gray-300 transition-colors disabled:bg-gray-100"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-shinhan-blue text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:text-gray-500"
            >
              {loading ? '저장 중...' : '수정 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
