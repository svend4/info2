# Contributing to T-Hub

Спасибо за интерес к проекту T-Hub! Мы рады любому вкладу в развитие платформы.

## Кодекс поведения

Этот проект придерживается [Кодекса поведения](CODE_OF_CONDUCT.md). Участвуя в проекте, вы соглашаетесь соблюдать его условия.

## Как помочь проекту?

Есть множество способов внести вклад в T-Hub:

- 🐛 Сообщать об ошибках
- 💡 Предлагать новые функции
- 📝 Улучшать документацию
- 💻 Писать код
- ✅ Добавлять тесты
- 🌍 Переводить на другие языки

## Процесс разработки

### 1. Fork репозитория

Создайте fork проекта на GitHub и клонируйте его локально:

```bash
git clone https://github.com/YOUR_USERNAME/info2.git
cd info2
git remote add upstream https://github.com/svend4/info2.git
```

### 2. Создайте ветку

Создайте новую ветку для вашей работы:

```bash
git checkout -b feature/your-feature-name
# или
git checkout -b fix/issue-number-description
```

**Соглашения по именованию веток:**
- `feature/` — новая функциональность
- `fix/` — исправление ошибок
- `docs/` — документация
- `refactor/` — рефакторинг
- `test/` — тесты
- `chore/` — рутинные задачи

### 3. Настройте окружение

```bash
cd prototype
npm install
```

### 4. Внесите изменения

Следуйте нашим стандартам кодирования (см. ниже).

### 5. Добавьте тесты

Каждое изменение должно сопровождаться тестами:

```bash
npm test
```

Убедитесь, что coverage не упал:

```bash
npm run test:coverage
```

### 6. Проверьте код

```bash
# Линтинг
npm run lint

# Форматирование
npm run format

# Проверка типов (если используется TypeScript)
npm run type-check
```

### 7. Закоммитьте изменения

Используйте [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add component deduplication algorithm"
git commit -m "fix: resolve circular dependency issue"
git commit -m "docs: update API documentation"
```

**Формат коммитов:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` — новая функциональность
- `fix` — исправление ошибки
- `docs` — документация
- `style` — форматирование кода
- `refactor` — рефакторинг
- `test` — тесты
- `chore` — рутинные задачи

**Примеры:**
```
feat(deduplication): implement semantic similarity detection

Added AST-based code similarity detection using tree-sitter.
This allows T-Hub to find semantically similar components
even when syntax differs.

Closes #123
```

### 8. Push и Pull Request

```bash
git push origin feature/your-feature-name
```

Создайте Pull Request через GitHub интерфейс.

**Шаблон PR:**
```markdown
## Описание
Краткое описание изменений.

## Связанные issues
Closes #123

## Тип изменений
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Чеклист
- [ ] Код соответствует style guide
- [ ] Добавлены тесты
- [ ] Все тесты проходят
- [ ] Документация обновлена
- [ ] Нет breaking changes (или они задокументированы)
```

---

## Стандарты кодирования

### JavaScript/TypeScript

- **Style Guide**: [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- **Форматтер**: Prettier
- **Линтер**: ESLint

**Примеры:**

```javascript
// ✅ Хорошо
async function fetchComponent(id) {
  try {
    const component = await registry.findById(id);
    return component;
  } catch (error) {
    logger.error(`Failed to fetch component ${id}:`, error);
    throw new ComponentNotFoundError(id);
  }
}

// ❌ Плохо
function fetchComponent(id) {
  return registry.findById(id).catch(e => {
    console.log(e);
    throw e;
  });
}
```

### Именование

**Переменные и функции**: camelCase
```javascript
const userName = 'John';
function calculateHash() {}
```

**Классы**: PascalCase
```javascript
class DeduplicationEngine {}
```

**Константы**: UPPER_SNAKE_CASE
```javascript
const MAX_RETRY_COUNT = 3;
```

**Приватные поля**: префикс `_`
```javascript
class Component {
  _privateMethod() {}
}
```

### Комментарии

```javascript
/**
 * Вычисляет SHA-256 хеш содержимого компонента
 *
 * @param {string} content - Исходный код компонента
 * @returns {string} Hex-encoded hash
 * @throws {Error} Если content пустой
 *
 * @example
 * const hash = calculateHash('function hello() {}');
 * // => 'a3f5c8b9d2e1f4a7...'
 */
function calculateHash(content) {
  // Implementation
}
```

### Тесты

**Структура тестов:**

```javascript
describe('ComponentName', () => {
  describe('methodName', () => {
    test('should do something when condition', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = doSomething(input);

      // Assert
      expect(result).toBe('expected');
    });

    test('should throw error when invalid input', () => {
      expect(() => doSomething(null)).toThrow();
    });
  });
});
```

**Coverage requirements:**
- Минимум 80% statement coverage
- Минимум 75% branch coverage
- 100% для критичных компонентов (auth, security)

---

## Работа с issues

### Создание issue

**Bug Report:**
```markdown
**Описание бага**
Чёткое описание проблемы.

**Шаги для воспроизведения**
1. Запустить '...'
2. Кликнуть на '...'
3. Увидеть ошибку

**Ожидаемое поведение**
Что должно происходить.

**Скриншоты**
Если применимо.

**Окружение:**
- OS: [e.g. Ubuntu 22.04]
- Node.js: [e.g. 18.16.0]
- T-Hub version: [e.g. 0.1.0]
```

**Feature Request:**
```markdown
**Проблема**
Какую проблему решает эта функциональность?

**Предложенное решение**
Описание желаемого поведения.

**Альтернативы**
Другие варианты решения.

**Дополнительный контекст**
Примеры, мокапы, ссылки.
```

---

## Review Process

### Что проверяется в PR:

1. **Функциональность**
   - Код работает как ожидается
   - Нет регрессий
   - Edge cases покрыты

2. **Качество кода**
   - Соответствие style guide
   - Читаемость и поддерживаемость
   - Нет дублирования

3. **Тесты**
   - Адекватное покрытие
   - Тесты проходят
   - Нет flaky tests

4. **Документация**
   - API документация обновлена
   - Комментарии добавлены где нужно
   - README обновлён при необходимости

5. **Производительность**
   - Нет очевидных проблем с производительностью
   - Оптимальное использование ресурсов

### Процесс review:

1. **Автоматические проверки**: CI должен пройти
2. **Code review**: Минимум 1 approve от мейнтейнера
3. **Testing**: Ручное тестирование при необходимости
4. **Merge**: Squash and merge или rebase

---

## Релизы

### Версионирование

Мы используем [Semantic Versioning](https://semver.org/):

- **MAJOR** — breaking changes
- **MINOR** — новая функциональность (обратная совместимость)
- **PATCH** — bug fixes

Примеры:
- `1.0.0` → `2.0.0` (breaking change)
- `1.0.0` → `1.1.0` (new feature)
- `1.0.0` → `1.0.1` (bug fix)

### Процесс релиза

1. Обновить версию в `package.json`
2. Обновить CHANGELOG.md
3. Создать git tag
4. Push tag
5. GitHub Actions автоматически создаст release

---

## Безопасность

Если вы обнаружили уязвимость безопасности, **НЕ создавайте публичный issue**.

Вместо этого отправьте email на: **security@thub.io**

Мы ответим в течение 48 часов и предоставим timeline исправления.

---

## Лицензия

Внося вклад в проект, вы соглашаетесь, что ваши изменения будут лицензированы под [MIT License](LICENSE).

---

## Вопросы?

- **Documentation**: https://docs.thub.io
- **Discord**: https://discord.gg/thub
- **Email**: team@thub.io

---

**Спасибо за вклад в T-Hub! 🚀**
