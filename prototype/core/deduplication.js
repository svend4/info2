/**
 * T-Hub Deduplication Engine
 *
 * Автоматическое обнаружение и удаление дубликатов кода
 */

const crypto = require('crypto');

class DeduplicationEngine {
  constructor(registry) {
    this.registry = registry;
  }

  /**
   * Вычисляет SHA-256 хеш содержимого
   * @param {string} content - Исходный код компонента
   * @returns {string} Hex-encoded hash
   */
  calculateHash(content) {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  /**
   * Нормализует код для сравнения
   * Удаляет комментарии, пробелы, переименовывает переменные
   * @param {string} code - Исходный код
   * @returns {string} Нормализованный код
   */
  normalizeCode(code) {
    let normalized = code;

    // Удаляем однострочные комментарии
    normalized = normalized.replace(/\/\/.*$/gm, '');

    // Удаляем многострочные комментарии
    normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '');

    // Нормализуем пробелы
    normalized = normalized.replace(/\s+/g, ' ');

    // Удаляем пробелы вокруг операторов
    normalized = normalized.replace(/\s*([{}();,])\s*/g, '$1');

    // Убираем начальные и конечные пробелы
    normalized = normalized.trim();

    return normalized;
  }

  /**
   * Проверяет точное совпадение (Exact Match)
   * @param {string} code - Код для проверки
   * @returns {Promise<Object|null>} Найденный дубликат или null
   */
  async checkExactDuplicate(code) {
    const hash = this.calculateHash(code);

    const existing = await this.registry.findByHash(hash);

    if (existing) {
      return {
        isDuplicate: true,
        matchType: 'exact',
        similarity: 100,
        existingComponent: existing,
        action: 'reference'
      };
    }

    return null;
  }

  /**
   * Проверяет нормализованное совпадение
   * @param {string} code - Код для проверки
   * @returns {Promise<Object|null>} Найденный дубликат или null
   */
  async checkNormalizedDuplicate(code) {
    const normalizedCode = this.normalizeCode(code);
    const hash = this.calculateHash(normalizedCode);

    const existing = await this.registry.findByNormalizedHash(hash);

    if (existing) {
      return {
        isDuplicate: true,
        matchType: 'normalized',
        similarity: 100,
        existingComponent: existing,
        action: 'suggest_existing',
        message: 'Идентичный код с разным форматированием уже существует'
      };
    }

    return null;
  }

  /**
   * Вычисляет схожесть двух строк (простая реализация)
   * @param {string} str1 - Первая строка
   * @param {string} str2 - Вторая строка
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    // Простой алгоритм: Jaccard similarity для множества токенов
    const tokens1 = new Set(str1.split(/\s+/));
    const tokens2 = new Set(str2.split(/\s+/));

    const intersection = new Set(
      [...tokens1].filter(x => tokens2.has(x))
    );

    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size;
  }

  /**
   * Находит похожие компоненты (Semantic Match)
   * @param {string} code - Код для проверки
   * @param {number} threshold - Порог схожести (0-1)
   * @returns {Promise<Array>} Массив похожих компонентов
   */
  async findSimilar(code, threshold = 0.85) {
    const normalizedCode = this.normalizeCode(code);

    // Получаем все компоненты из той же категории
    const candidates = await this.registry.findAllInCategory();

    const similar = [];

    for (const candidate of candidates) {
      const candidateNormalized = this.normalizeCode(candidate.code);

      const similarity = this.calculateSimilarity(
        normalizedCode,
        candidateNormalized
      );

      if (similarity >= threshold) {
        similar.push({
          component: candidate,
          similarity: Math.round(similarity * 100),
          matchType: 'semantic'
        });
      }
    }

    // Сортируем по убыванию схожести
    similar.sort((a, b) => b.similarity - a.similarity);

    return similar;
  }

  /**
   * Главный метод регистрации компонента с дедупликацией
   * @param {Object} component - Компонент для регистрации
   * @returns {Promise<Object>} Результат регистрации
   */
  async registerComponent(component) {
    // 1. Проверка точного совпадения
    const exactDuplicate = await this.checkExactDuplicate(component.code);
    if (exactDuplicate) {
      console.log(`✓ Точный дубликат найден: ${exactDuplicate.existingComponent.name}`);
      return {
        status: 'duplicate',
        existing: exactDuplicate.existingComponent,
        message: 'Идентичный компонент уже существует в реестре'
      };
    }

    // 2. Проверка нормализованного совпадения
    const normalizedDuplicate = await this.checkNormalizedDuplicate(component.code);
    if (normalizedDuplicate) {
      console.log(`✓ Нормализованный дубликат найден: ${normalizedDuplicate.existingComponent.name}`);
      return {
        status: 'normalized_duplicate',
        existing: normalizedDuplicate.existingComponent,
        message: normalizedDuplicate.message
      };
    }

    // 3. Поиск похожих компонентов
    const similar = await this.findSimilar(component.code, 0.85);

    if (similar.length > 0) {
      console.log(`⚠ Найдено ${similar.length} похожих компонентов`);

      return {
        status: 'similar',
        similar: similar,
        message: 'Найдены похожие компоненты. Проверьте, возможно, нужный уже существует.',
        canProceed: true
      };
    }

    // 4. Компонент уникален - регистрируем
    const hash = this.calculateHash(component.code);
    const normalizedHash = this.calculateHash(this.normalizeCode(component.code));

    const registered = await this.registry.save({
      ...component,
      content_hash: hash,
      normalized_hash: normalizedHash,
      created_at: new Date()
    });

    console.log(`✓ Компонент успешно зарегистрирован: ${registered.id}`);

    return {
      status: 'registered',
      component: registered,
      message: 'Компонент успешно добавлен в реестр'
    };
  }

  /**
   * Находит все дубликаты в реестре (для аудита)
   * @returns {Promise<Array>} Массив групп дубликатов
   */
  async auditDuplicates() {
    const allComponents = await this.registry.findAll();

    const hashMap = new Map();
    const duplicates = [];

    for (const component of allComponents) {
      const hash = this.calculateHash(component.code);

      if (hashMap.has(hash)) {
        const existing = hashMap.get(hash);
        duplicates.push({
          original: existing,
          duplicate: component,
          hash: hash
        });
      } else {
        hashMap.set(hash, component);
      }
    }

    return duplicates;
  }
}

module.exports = DeduplicationEngine;
