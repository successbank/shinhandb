import { Client } from '@elastic/elasticsearch';

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
const CONTENT_INDEX = 'shinhan_contents';

// Elasticsearch 클라이언트 초기화
const client = new Client({
  node: ELASTICSEARCH_URL,
});

/**
 * Elasticsearch 연결 확인
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const health = await client.cluster.health();
    console.log('[Elasticsearch] Connected successfully:', health.status);
    return true;
  } catch (error) {
    console.error('[Elasticsearch] Connection failed:', error);
    return false;
  }
}

/**
 * 콘텐츠 인덱스 초기화
 */
export async function initializeContentIndex(): Promise<void> {
  try {
    const indexExists = await client.indices.exists({ index: CONTENT_INDEX });

    if (!indexExists) {
      await client.indices.create({
        index: CONTENT_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                korean_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'cjk_bigram'],
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              title: {
                type: 'text',
                analyzer: 'korean_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              description: {
                type: 'text',
                analyzer: 'korean_analyzer',
              },
              ocr_text: {
                type: 'text',
                analyzer: 'korean_analyzer',
              },
              file_name: {
                type: 'text',
                analyzer: 'korean_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              file_type: { type: 'keyword' },
              file_size: { type: 'long' },
              category_ids: { type: 'keyword' },
              category_names: {
                type: 'text',
                analyzer: 'korean_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              tags: {
                type: 'text',
                analyzer: 'korean_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              uploader_id: { type: 'keyword' },
              uploader_name: {
                type: 'text',
                analyzer: 'korean_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              member_type: { type: 'keyword' },
              created_at: { type: 'date' },
              updated_at: { type: 'date' },
            },
          },
        },
      });
      console.log(`[Elasticsearch] Index '${CONTENT_INDEX}' created successfully`);
    } else {
      console.log(`[Elasticsearch] Index '${CONTENT_INDEX}' already exists`);
    }
  } catch (error) {
    console.error('[Elasticsearch] Failed to initialize index:', error);
    throw error;
  }
}

/**
 * 콘텐츠 색인 추가/업데이트
 */
export async function indexContent(content: {
  id: string;
  title: string;
  description: string | null;
  ocr_text: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  category_ids: string[];
  category_names: string[];
  tags: string[];
  uploader_id: string;
  uploader_name: string;
  member_type: string;
  created_at: Date;
  updated_at: Date;
}): Promise<void> {
  try {
    await client.index({
      index: CONTENT_INDEX,
      id: content.id,
      document: {
        ...content,
        created_at: content.created_at.toISOString(),
        updated_at: content.updated_at.toISOString(),
      },
    });
    console.log(`[Elasticsearch] Content indexed: ${content.id}`);
  } catch (error) {
    console.error('[Elasticsearch] Failed to index content:', error);
    throw error;
  }
}

/**
 * 콘텐츠 색인 삭제
 */
export async function deleteContentIndex(contentId: string): Promise<void> {
  try {
    await client.delete({
      index: CONTENT_INDEX,
      id: contentId,
    });
    console.log(`[Elasticsearch] Content deleted from index: ${contentId}`);
  } catch (error: any) {
    if (error.meta?.statusCode === 404) {
      console.log(`[Elasticsearch] Content not found in index: ${contentId}`);
    } else {
      console.error('[Elasticsearch] Failed to delete content:', error);
      throw error;
    }
  }
}

/**
 * 콘텐츠 검색
 */
export async function searchContents(params: {
  query?: string;
  categoryIds?: string[];
  memberType?: string;
  tags?: string[];
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'date_desc' | 'date_asc';
}): Promise<{
  total: number;
  hits: any[];
  took: number;
}> {
  try {
    const {
      query,
      categoryIds,
      memberType,
      tags,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
      sortBy = 'relevance',
    } = params;

    const must: any[] = [];
    const filter: any[] = [];

    // 텍스트 검색 쿼리
    if (query && query.trim()) {
      must.push({
        multi_match: {
          query: query.trim(),
          fields: [
            'title^3',
            'description^2',
            'ocr_text^2',
            'file_name',
            'category_names',
            'tags',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // 필터: 카테고리
    if (categoryIds && categoryIds.length > 0) {
      filter.push({
        terms: { category_ids: categoryIds },
      });
    }

    // 필터: 회원 유형
    if (memberType) {
      filter.push({
        term: { member_type: memberType },
      });
    }

    // 필터: 태그
    if (tags && tags.length > 0) {
      filter.push({
        terms: { 'tags.keyword': tags },
      });
    }

    // 필터: 날짜 범위
    if (fromDate || toDate) {
      const dateRange: any = {};
      if (fromDate) dateRange.gte = fromDate.toISOString();
      if (toDate) dateRange.lte = toDate.toISOString();
      filter.push({
        range: { created_at: dateRange },
      });
    }

    // 정렬 조건
    let sort: any[] = [];
    if (sortBy === 'date_desc') {
      sort = [{ created_at: { order: 'desc' } }];
    } else if (sortBy === 'date_asc') {
      sort = [{ created_at: { order: 'asc' } }];
    } else if (must.length === 0) {
      // 검색어 없을 때는 최신순 정렬
      sort = [{ created_at: { order: 'desc' } }];
    }

    const from = (page - 1) * limit;

    const body: any = {
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      },
      from,
      size: limit,
    };

    if (sort.length > 0) {
      body.sort = sort;
    }

    const response = await client.search({
      index: CONTENT_INDEX,
      body,
    });

    return {
      total: typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value || 0,
      hits: response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score,
      })),
      took: response.took,
    };
  } catch (error) {
    console.error('[Elasticsearch] Search failed:', error);
    throw error;
  }
}

/**
 * 인기 태그 조회 (집계)
 */
export async function getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
  try {
    const response = await client.search({
      index: CONTENT_INDEX,
      body: {
        size: 0,
        aggs: {
          popular_tags: {
            terms: {
              field: 'tags.keyword',
              size: limit,
              order: { _count: 'desc' },
            },
          },
        },
      },
    });

    const buckets = (response.aggregations?.popular_tags as any)?.buckets || [];
    return buckets.map((bucket: any) => ({
      tag: bucket.key,
      count: bucket.doc_count,
    }));
  } catch (error) {
    console.error('[Elasticsearch] Failed to get popular tags:', error);
    return [];
  }
}

/**
 * 전체 인덱스 재색인 (관리 작업)
 */
export async function reindexAllContents(contents: any[]): Promise<void> {
  try {
    const operations = contents.flatMap((content) => [
      { index: { _index: CONTENT_INDEX, _id: content.id } },
      {
        ...content,
        created_at: content.created_at.toISOString(),
        updated_at: content.updated_at.toISOString(),
      },
    ]);

    if (operations.length > 0) {
      const response = await client.bulk({ operations });

      if (response.errors) {
        console.error('[Elasticsearch] Bulk reindex had errors');
      } else {
        console.log(`[Elasticsearch] Reindexed ${contents.length} contents successfully`);
      }
    }
  } catch (error) {
    console.error('[Elasticsearch] Failed to reindex contents:', error);
    throw error;
  }
}

export default {
  client,
  checkConnection,
  initializeContentIndex,
  indexContent,
  deleteContentIndex,
  searchContents,
  getPopularTags,
  reindexAllContents,
};
