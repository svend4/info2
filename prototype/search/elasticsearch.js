/**
 * Elasticsearch Integration for T-Hub
 * Provides advanced search capabilities for components
 */

const { Client } = require('@elastic/elasticsearch');

class ElasticsearchService {
  constructor(config) {
    this.config = config || {
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: process.env.ELASTICSEARCH_AUTH ? {
        username: process.env.ELASTICSEARCH_USER,
        password: process.env.ELASTICSEARCH_PASSWORD
      } : undefined
    };

    this.client = new Client(this.config);
    this.indexName = 'thub-components';
  }

  /**
   * Initialize Elasticsearch index with mappings
   */
  async initialize() {
    try {
      const indexExists = await this.client.indices.exists({
        index: this.indexName
      });

      if (!indexExists) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              analysis: {
                analyzer: {
                  code_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'stop', 'snowball']
                  },
                  autocomplete: {
                    type: 'custom',
                    tokenizer: 'edge_ngram_tokenizer',
                    filter: ['lowercase']
                  }
                },
                tokenizer: {
                  edge_ngram_tokenizer: {
                    type: 'edge_ngram',
                    min_gram: 2,
                    max_gram: 10,
                    token_chars: ['letter', 'digit']
                  }
                }
              }
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                content_hash: { type: 'keyword' },
                name: {
                  type: 'text',
                  fields: {
                    keyword: { type: 'keyword' },
                    autocomplete: { type: 'text', analyzer: 'autocomplete' }
                  }
                },
                version: { type: 'keyword' },
                description: {
                  type: 'text',
                  analyzer: 'standard'
                },
                readme: {
                  type: 'text',
                  analyzer: 'standard'
                },
                category: { type: 'keyword' },
                language: { type: 'keyword' },
                license: { type: 'keyword' },
                author: {
                  properties: {
                    id: { type: 'keyword' },
                    username: { type: 'keyword' },
                    full_name: { type: 'text' }
                  }
                },
                tags: { type: 'keyword' },
                exports: {
                  type: 'nested',
                  properties: {
                    name: { type: 'keyword' },
                    type: { type: 'keyword' },
                    signature: { type: 'text' }
                  }
                },
                dependencies: {
                  type: 'nested',
                  properties: {
                    name: { type: 'keyword' },
                    version: { type: 'keyword' }
                  }
                },
                code_content: {
                  type: 'text',
                  analyzer: 'code_analyzer'
                },
                downloads: { type: 'integer' },
                stars: { type: 'integer' },
                size_bytes: { type: 'integer' },
                quality: {
                  properties: {
                    test_coverage: { type: 'float' },
                    security_score: { type: 'integer' },
                    documentation_score: { type: 'integer' }
                  }
                },
                created_at: { type: 'date' },
                updated_at: { type: 'date' },
                published_at: { type: 'date' }
              }
            }
          }
        });

        console.log(`✓ Elasticsearch index '${this.indexName}' created`);
      } else {
        console.log(`✓ Elasticsearch index '${this.indexName}' already exists`);
      }
    } catch (error) {
      console.error('Failed to initialize Elasticsearch:', error);
      throw error;
    }
  }

  /**
   * Index a component
   * @param {object} component - Component to index
   */
  async indexComponent(component) {
    try {
      await this.client.index({
        index: this.indexName,
        id: component.id,
        body: {
          id: component.id,
          content_hash: component.content_hash,
          name: component.name,
          version: component.version,
          description: component.description,
          readme: component.readme,
          category: component.category,
          language: component.language,
          license: component.license,
          author: component.author_username ? {
            id: component.author_id,
            username: component.author_username,
            full_name: component.author_name
          } : null,
          tags: component.tags || [],
          exports: component.exports || [],
          dependencies: component.dependencies || [],
          code_content: component.code_content,
          downloads: component.downloads || 0,
          stars: component.stars || 0,
          size_bytes: component.size_bytes || 0,
          quality: {
            test_coverage: component.test_coverage,
            security_score: component.security_score,
            documentation_score: component.documentation_score
          },
          created_at: component.created_at,
          updated_at: component.updated_at,
          published_at: component.published_at
        },
        refresh: true
      });

      console.log(`✓ Indexed component: ${component.name}@${component.version}`);
    } catch (error) {
      console.error('Failed to index component:', error);
      throw error;
    }
  }

  /**
   * Update a component in the index
   * @param {string} id - Component ID
   * @param {object} updates - Fields to update
   */
  async updateComponent(id, updates) {
    try {
      await this.client.update({
        index: this.indexName,
        id,
        body: {
          doc: updates
        },
        refresh: true
      });

      console.log(`✓ Updated component in index: ${id}`);
    } catch (error) {
      console.error('Failed to update component:', error);
      throw error;
    }
  }

  /**
   * Delete a component from the index
   * @param {string} id - Component ID
   */
  async deleteComponent(id) {
    try {
      await this.client.delete({
        index: this.indexName,
        id,
        refresh: true
      });

      console.log(`✓ Deleted component from index: ${id}`);
    } catch (error) {
      console.error('Failed to delete component:', error);
      throw error;
    }
  }

  /**
   * Advanced search with multiple criteria
   * @param {object} options - Search options
   * @returns {Promise<object>} Search results
   */
  async search(options = {}) {
    const {
      query,
      category,
      language,
      tags,
      minStars,
      minDownloads,
      author,
      from = 0,
      size = 10,
      sort = 'relevance'
    } = options;

    const must = [];
    const filter = [];

    // Text search
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: [
            'name^3',           // Boost name matches
            'name.autocomplete^2',
            'description^2',
            'readme',
            'code_content',
            'tags^2'
          ],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    }

    // Filters
    if (category) {
      filter.push({ term: { category } });
    }

    if (language) {
      filter.push({ term: { language } });
    }

    if (tags && tags.length > 0) {
      filter.push({ terms: { tags } });
    }

    if (minStars) {
      filter.push({ range: { stars: { gte: minStars } } });
    }

    if (minDownloads) {
      filter.push({ range: { downloads: { gte: minDownloads } } });
    }

    if (author) {
      filter.push({ term: { 'author.username': author } });
    }

    // Build query
    const body = {
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter
        }
      },
      from,
      size,
      highlight: {
        fields: {
          name: {},
          description: {},
          readme: { fragment_size: 150 }
        }
      },
      aggs: {
        categories: {
          terms: { field: 'category', size: 20 }
        },
        languages: {
          terms: { field: 'language', size: 20 }
        },
        tags: {
          terms: { field: 'tags', size: 50 }
        }
      }
    };

    // Sorting
    if (sort === 'downloads') {
      body.sort = [{ downloads: 'desc' }];
    } else if (sort === 'stars') {
      body.sort = [{ stars: 'desc' }];
    } else if (sort === 'recent') {
      body.sort = [{ created_at: 'desc' }];
    } else if (sort === 'updated') {
      body.sort = [{ updated_at: 'desc' }];
    }
    // Default: relevance (no explicit sort, uses _score)

    try {
      const result = await this.client.search({
        index: this.indexName,
        body
      });

      return {
        total: result.hits.total.value,
        results: result.hits.hits.map(hit => ({
          ...hit._source,
          score: hit._score,
          highlights: hit.highlight
        })),
        aggregations: {
          categories: result.aggregations.categories.buckets,
          languages: result.aggregations.languages.buckets,
          tags: result.aggregations.tags.buckets
        }
      };
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Autocomplete suggestions
   * @param {string} prefix - Search prefix
   * @param {number} size - Number of suggestions
   * @returns {Promise<Array>} Suggestions
   */
  async autocomplete(prefix, size = 5) {
    try {
      const result = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            match: {
              'name.autocomplete': {
                query: prefix,
                operator: 'and'
              }
            }
          },
          _source: ['name', 'description', 'category'],
          size
        }
      });

      return result.hits.hits.map(hit => hit._source);
    } catch (error) {
      console.error('Autocomplete failed:', error);
      throw error;
    }
  }

  /**
   * Find similar components
   * @param {string} componentId - Component ID
   * @param {number} size - Number of similar components
   * @returns {Promise<Array>} Similar components
   */
  async findSimilar(componentId, size = 5) {
    try {
      const result = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            more_like_this: {
              fields: ['description', 'code_content', 'tags'],
              like: [
                {
                  _index: this.indexName,
                  _id: componentId
                }
              ],
              min_term_freq: 1,
              min_doc_freq: 1,
              max_query_terms: 25
            }
          },
          size
        }
      });

      return result.hits.hits.map(hit => ({
        ...hit._source,
        similarity_score: hit._score
      }));
    } catch (error) {
      console.error('Find similar failed:', error);
      throw error;
    }
  }

  /**
   * Bulk index components
   * @param {Array} components - Array of components
   */
  async bulkIndex(components) {
    if (components.length === 0) return;

    const operations = components.flatMap(component => [
      { index: { _index: this.indexName, _id: component.id } },
      {
        id: component.id,
        content_hash: component.content_hash,
        name: component.name,
        version: component.version,
        description: component.description,
        category: component.category,
        language: component.language,
        tags: component.tags || [],
        downloads: component.downloads || 0,
        stars: component.stars || 0,
        created_at: component.created_at
      }
    ]);

    try {
      const result = await this.client.bulk({
        refresh: true,
        operations
      });

      if (result.errors) {
        console.error('Some bulk operations failed');
      } else {
        console.log(`✓ Bulk indexed ${components.length} components`);
      }

      return result;
    } catch (error) {
      console.error('Bulk indexing failed:', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getStats() {
    try {
      const stats = await this.client.indices.stats({
        index: this.indexName
      });

      return {
        documentCount: stats.indices[this.indexName].total.docs.count,
        storeSize: stats.indices[this.indexName].total.store.size_in_bytes,
        indexingTotal: stats.indices[this.indexName].total.indexing.index_total,
        searchTotal: stats.indices[this.indexName].total.search.query_total
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const health = await this.client.cluster.health();
      return {
        status: health.status,
        numberOfNodes: health.number_of_nodes,
        activeShards: health.active_shards
      };
    } catch (error) {
      return {
        status: 'unavailable',
        error: error.message
      };
    }
  }

  /**
   * Close connection
   */
  async close() {
    await this.client.close();
  }
}

module.exports = ElasticsearchService;
