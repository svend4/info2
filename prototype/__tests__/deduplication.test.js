/**
 * Unit Tests: Deduplication Engine
 */

const DeduplicationEngine = require('../core/deduplication');

// Mock registry
class MockRegistry {
  constructor() {
    this.components = [];
    this.hashMap = new Map();
  }

  async findByHash(hash) {
    return this.hashMap.get(hash) || null;
  }

  async findByNormalizedHash(hash) {
    return this.hashMap.get(`norm:${hash}`) || null;
  }

  async findAllInCategory() {
    return this.components;
  }

  async save(component) {
    this.components.push(component);
    this.hashMap.set(component.content_hash, component);
    if (component.normalized_hash) {
      this.hashMap.set(`norm:${component.normalized_hash}`, component);
    }
    return component;
  }

  async findAll() {
    return this.components;
  }
}

describe('DeduplicationEngine', () => {
  let dedup;
  let registry;

  beforeEach(() => {
    registry = new MockRegistry();
    dedup = new DeduplicationEngine(registry);
  });

  // ==========================================================================
  // calculateHash
  // ==========================================================================
  describe('calculateHash', () => {
    test('should generate consistent SHA-256 hash', () => {
      const code = 'function hello() { console.log("Hello"); }';
      const hash1 = dedup.calculateHash(code);
      const hash2 = dedup.calculateHash(code);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
    });

    test('should generate different hashes for different content', () => {
      const code1 = 'function a() {}';
      const code2 = 'function b() {}';

      const hash1 = dedup.calculateHash(code1);
      const hash2 = dedup.calculateHash(code2);

      expect(hash1).not.toBe(hash2);
    });
  });

  // ==========================================================================
  // normalizeCode
  // ==========================================================================
  describe('normalizeCode', () => {
    test('should remove single-line comments', () => {
      const code = `
        // This is a comment
        function hello() {
          return 'world'; // inline comment
        }
      `;

      const normalized = dedup.normalizeCode(code);
      expect(normalized).not.toContain('//');
    });

    test('should remove multi-line comments', () => {
      const code = `
        /* Multi-line
           comment */
        function hello() {}
      `;

      const normalized = dedup.normalizeCode(code);
      expect(normalized).not.toContain('/*');
      expect(normalized).not.toContain('*/');
    });

    test('should normalize whitespace', () => {
      const code = `function   hello()   {
        return    'world';
      }`;

      const normalized = dedup.normalizeCode(code);
      expect(normalized).not.toMatch(/\s{2,}/); // No multiple spaces
    });

    test('should produce same hash for differently formatted code', () => {
      const code1 = 'function hello(){return "world";}';
      const code2 = `
        function hello() {
          return "world";
        }
      `;

      const norm1 = dedup.normalizeCode(code1);
      const norm2 = dedup.normalizeCode(code2);

      expect(dedup.calculateHash(norm1)).toBe(dedup.calculateHash(norm2));
    });
  });

  // ==========================================================================
  // checkExactDuplicate
  // ==========================================================================
  describe('checkExactDuplicate', () => {
    test('should detect exact duplicate', async () => {
      const code = 'function test() { return true; }';
      const hash = dedup.calculateHash(code);

      // Добавляем компонент в registry
      await registry.save({
        id: '123',
        name: 'test-component',
        code,
        content_hash: hash
      });

      const result = await dedup.checkExactDuplicate(code);

      expect(result).not.toBeNull();
      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('exact');
      expect(result.similarity).toBe(100);
    });

    test('should not detect duplicate for unique code', async () => {
      const code = 'function unique() { return 42; }';

      const result = await dedup.checkExactDuplicate(code);

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // calculateSimilarity
  // ==========================================================================
  describe('calculateSimilarity', () => {
    test('should return 1 for identical strings', () => {
      const str = 'hello world foo bar';
      const similarity = dedup.calculateSimilarity(str, str);

      expect(similarity).toBe(1);
    });

    test('should return > 0 for similar strings', () => {
      const str1 = 'hello world';
      const str2 = 'hello earth';

      const similarity = dedup.calculateSimilarity(str1, str2);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    test('should return low value for completely different strings', () => {
      const str1 = 'apple banana orange';
      const str2 = 'car house tree';

      const similarity = dedup.calculateSimilarity(str1, str2);

      expect(similarity).toBeLessThan(0.2);
    });
  });

  // ==========================================================================
  // registerComponent
  // ==========================================================================
  describe('registerComponent', () => {
    test('should register unique component successfully', async () => {
      const component = {
        name: 'unique-component',
        version: '1.0.0',
        code: 'function unique() { return 123; }'
      };

      const result = await dedup.registerComponent(component);

      expect(result.status).toBe('registered');
      expect(result.component).toBeDefined();
      expect(result.component.content_hash).toBeDefined();
    });

    test('should detect exact duplicate during registration', async () => {
      const code = 'function test() {}';
      const component1 = {
        name: 'component-1',
        version: '1.0.0',
        code
      };

      // Регистрируем первый раз
      await dedup.registerComponent(component1);

      // Пытаемся зарегистрировать дубликат
      const component2 = {
        name: 'component-2',
        version: '1.0.0',
        code
      };

      const result = await dedup.registerComponent(component2);

      expect(result.status).toBe('duplicate');
      expect(result.existing).toBeDefined();
    });

    test('should register similar but not identical components', async () => {
      const component1 = {
        name: 'component-1',
        version: '1.0.0',
        code: 'function hello() { return "world"; }'
      };

      const component2 = {
        name: 'component-2',
        version: '1.0.0',
        code: 'function hello() { return "universe"; }'
      };

      const result1 = await dedup.registerComponent(component1);
      const result2 = await dedup.registerComponent(component2);

      expect(result1.status).toBe('registered');
      expect(result2.status).toBe('registered');
    });
  });

  // ==========================================================================
  // auditDuplicates
  // ==========================================================================
  describe('auditDuplicates', () => {
    test('should find duplicates in registry', async () => {
      const code = 'function test() { return 1; }';

      await registry.save({
        id: '1',
        name: 'comp-1',
        code
      });

      await registry.save({
        id: '2',
        name: 'comp-2',
        code
      });

      const duplicates = await dedup.auditDuplicates();

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].original.id).toBe('1');
      expect(duplicates[0].duplicate.id).toBe('2');
    });

    test('should return empty array when no duplicates', async () => {
      await registry.save({
        id: '1',
        name: 'comp-1',
        code: 'function a() {}'
      });

      await registry.save({
        id: '2',
        name: 'comp-2',
        code: 'function b() {}'
      });

      const duplicates = await dedup.auditDuplicates();

      expect(duplicates).toHaveLength(0);
    });
  });
});
