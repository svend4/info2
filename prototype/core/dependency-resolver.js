/**
 * T-Hub Dependency Resolver
 *
 * Разрешение зависимостей и построение графа
 */

const semver = require('semver');

class DependencyResolver {
  constructor(registry) {
    this.registry = registry;
  }

  /**
   * Проверяет, удовлетворяет ли версия ограничению
   * @param {string} version - Версия (например, "2.1.3")
   * @param {string} constraint - Ограничение (например, "^2.0.0")
   * @returns {boolean}
   */
  satisfies(version, constraint) {
    return semver.satisfies(version, constraint);
  }

  /**
   * Находит совместимую версию для набора ограничений
   * @param {string} componentName - Имя компонента
   * @param {Array<string>} constraints - Массив ограничений версий
   * @returns {Promise<Object|null>} Совместимая версия или null
   */
  async findCompatibleVersion(componentName, constraints) {
    // Получаем все версии компонента
    const allVersions = await this.registry.findVersions(componentName);

    // Сортируем по убыванию (новые версии первые)
    allVersions.sort((a, b) => semver.rcompare(a.version, b.version));

    // Ищем версию, которая удовлетворяет всем ограничениям
    for (const component of allVersions) {
      const satisfiesAll = constraints.every(constraint =>
        this.satisfies(component.version, constraint)
      );

      if (satisfiesAll) {
        return component;
      }
    }

    return null;
  }

  /**
   * Разрешает зависимости для одного компонента
   * @param {Object} component - Компонент
   * @param {Map} resolved - Уже разрешённые зависимости
   * @param {Set} resolving - Зависимости в процессе разрешения (для обнаружения циклов)
   * @returns {Promise<Map>} Карта разрешённых зависимостей
   */
  async resolveDependencies(component, resolved = new Map(), resolving = new Set()) {
    const componentKey = `${component.name}@${component.version}`;

    // Проверка на циклическую зависимость
    if (resolving.has(componentKey)) {
      throw new Error(
        `Циклическая зависимость обнаружена: ${[...resolving, componentKey].join(' -> ')}`
      );
    }

    // Уже разрешено
    if (resolved.has(componentKey)) {
      return resolved;
    }

    // Добавляем в процесс разрешения
    resolving.add(componentKey);

    // Обрабатываем зависимости
    const dependencies = component.dependencies?.required || [];

    for (const dep of dependencies) {
      const depKey = dep.name;

      // Собираем все ограничения для этой зависимости
      const constraints = [dep.version];

      // Проверяем, есть ли уже другие ограничения для той же зависимости
      for (const [key, resolvedDep] of resolved) {
        if (resolvedDep.name === dep.name) {
          // Конфликт версий - нужно найти совместимую
          const compatible = await this.findCompatibleVersion(
            dep.name,
            [...constraints, resolvedDep.versionConstraint]
          );

          if (!compatible) {
            throw new Error(
              `Конфликт версий для ${dep.name}: ${constraints.join(', ')}`
            );
          }

          dep.resolvedVersion = compatible.version;
          break;
        }
      }

      // Если версия не разрешена, ищем подходящую
      if (!dep.resolvedVersion) {
        const compatible = await this.findCompatibleVersion(
          dep.name,
          constraints
        );

        if (!compatible) {
          throw new Error(
            `Не найдена совместимая версия для ${dep.name} (${dep.version})`
          );
        }

        dep.resolvedVersion = compatible.version;
        dep.component = compatible;
      }

      // Рекурсивно разрешаем зависимости
      await this.resolveDependencies(
        dep.component,
        resolved,
        new Set(resolving)
      );

      // Добавляем в разрешённые
      const depResolvedKey = `${dep.name}@${dep.resolvedVersion}`;
      resolved.set(depResolvedKey, dep.component);
    }

    // Убираем из процесса разрешения
    resolving.delete(componentKey);

    // Добавляем сам компонент
    resolved.set(componentKey, component);

    return resolved;
  }

  /**
   * Строит граф зависимостей
   * @param {Object} rootComponent - Корневой компонент
   * @returns {Promise<Object>} Граф зависимостей
   */
  async buildDependencyGraph(rootComponent) {
    const resolved = await this.resolveDependencies(rootComponent);

    const graph = {
      nodes: [],
      edges: []
    };

    for (const [key, component] of resolved) {
      graph.nodes.push({
        id: key,
        name: component.name,
        version: component.version,
        size: component.storage?.size || 0
      });

      const dependencies = component.dependencies?.required || [];
      for (const dep of dependencies) {
        const depKey = `${dep.name}@${dep.resolvedVersion}`;
        graph.edges.push({
          from: key,
          to: depKey,
          type: 'required'
        });
      }
    }

    return graph;
  }

  /**
   * Топологическая сортировка (порядок загрузки/сборки)
   * @param {Object} graph - Граф зависимостей
   * @returns {Array<string>} Упорядоченный список компонентов
   */
  topologicalSort(graph) {
    const inDegree = new Map();
    const queue = [];
    const result = [];

    // Инициализация in-degree
    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
    }

    // Подсчёт входящих рёбер
    for (const edge of graph.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // Находим узлы без зависимостей
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // Алгоритм Кана
    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);

      // Находим все рёбра, исходящие из current
      const outgoingEdges = graph.edges.filter(e => e.from === current);

      for (const edge of outgoingEdges) {
        inDegree.set(edge.to, inDegree.get(edge.to) - 1);

        if (inDegree.get(edge.to) === 0) {
          queue.push(edge.to);
        }
      }
    }

    // Проверка на циклы
    if (result.length !== graph.nodes.length) {
      throw new Error('Граф содержит циклы!');
    }

    return result;
  }

  /**
   * Вычисляет общий размер с зависимостями
   * @param {Object} component - Компонент
   * @returns {Promise<number>} Общий размер в байтах
   */
  async calculateTotalSize(component) {
    const resolved = await this.resolveDependencies(component);

    let totalSize = 0;

    for (const [, comp] of resolved) {
      totalSize += comp.storage?.size || 0;
    }

    return totalSize;
  }

  /**
   * Находит все компоненты, зависящие от данного (обратная зависимость)
   * @param {string} componentName - Имя компонента
   * @returns {Promise<Array>} Массив зависимых компонентов
   */
  async findDependents(componentName) {
    const allComponents = await this.registry.findAll();

    const dependents = [];

    for (const component of allComponents) {
      const dependencies = component.dependencies?.required || [];

      const hasDependency = dependencies.some(
        dep => dep.name === componentName
      );

      if (hasDependency) {
        dependents.push(component);
      }
    }

    return dependents;
  }

  /**
   * Проверяет, безопасно ли обновить компонент
   * @param {string} componentName - Имя компонента
   * @param {string} newVersion - Новая версия
   * @returns {Promise<Object>} Отчёт о совместимости
   */
  async checkUpdateSafety(componentName, newVersion) {
    const dependents = await this.findDependents(componentName);

    const incompatible = [];
    const compatible = [];

    for (const dependent of dependents) {
      const dep = dependent.dependencies.required.find(
        d => d.name === componentName
      );

      if (dep) {
        const isCompatible = this.satisfies(newVersion, dep.version);

        if (isCompatible) {
          compatible.push(dependent);
        } else {
          incompatible.push({
            component: dependent,
            constraint: dep.version,
            reason: `${newVersion} не удовлетворяет ${dep.version}`
          });
        }
      }
    }

    return {
      safe: incompatible.length === 0,
      totalDependents: dependents.length,
      compatible: compatible.length,
      incompatible: incompatible.length,
      incompatibleComponents: incompatible
    };
  }

  /**
   * Генерирует граф в формате DOT (для визуализации в Graphviz)
   * @param {Object} graph - Граф зависимостей
   * @returns {string} DOT представление
   */
  toDot(graph) {
    let dot = 'digraph dependencies {\n';
    dot += '  node [shape=box];\n';

    for (const node of graph.nodes) {
      dot += `  "${node.id}" [label="${node.name}\\n${node.version}"];\n`;
    }

    for (const edge of graph.edges) {
      dot += `  "${edge.from}" -> "${edge.to}";\n`;
    }

    dot += '}\n';

    return dot;
  }
}

module.exports = DependencyResolver;
