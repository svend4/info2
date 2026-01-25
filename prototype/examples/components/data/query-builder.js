/**
 * T-Hub Component: query-builder
 *
 * @name query-builder
 * @version 3.2.1
 * @category data
 * @language javascript
 * @license MIT
 * @description Fluent SQL query builder with support for PostgreSQL, MySQL, SQLite
 *
 * @exports
 * - QueryBuilder class
 */

class QueryBuilder {
  constructor(table, dialect = 'postgres') {
    this.table = table;
    this.dialect = dialect;
    this.reset();
  }

  reset() {
    this.query = {
      type: null,
      columns: ['*'],
      where: [],
      joins: [],
      orderBy: [],
      groupBy: [],
      having: [],
      limit: null,
      offset: null,
      values: {}
    };
    this.bindings = [];
    return this;
  }

  /**
   * SELECT query
   */
  select(...columns) {
    this.query.type = 'SELECT';
    if (columns.length > 0) {
      this.query.columns = columns;
    }
    return this;
  }

  /**
   * INSERT query
   */
  insert(values) {
    this.query.type = 'INSERT';
    this.query.values = values;
    return this;
  }

  /**
   * UPDATE query
   */
  update(values) {
    this.query.type = 'UPDATE';
    this.query.values = values;
    return this;
  }

  /**
   * DELETE query
   */
  delete() {
    this.query.type = 'DELETE';
    return this;
  }

  /**
   * WHERE clause
   */
  where(column, operator, value) {
    // Если передано 2 аргумента, предполагаем оператор "="
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }

    this.query.where.push({
      column,
      operator,
      value,
      type: 'AND'
    });

    this.bindings.push(value);
    return this;
  }

  /**
   * OR WHERE clause
   */
  orWhere(column, operator, value) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }

    this.query.where.push({
      column,
      operator,
      value,
      type: 'OR'
    });

    this.bindings.push(value);
    return this;
  }

  /**
   * WHERE IN clause
   */
  whereIn(column, values) {
    this.query.where.push({
      column,
      operator: 'IN',
      value: values,
      type: 'AND'
    });

    this.bindings.push(...values);
    return this;
  }

  /**
   * WHERE BETWEEN clause
   */
  whereBetween(column, min, max) {
    this.query.where.push({
      column,
      operator: 'BETWEEN',
      value: [min, max],
      type: 'AND'
    });

    this.bindings.push(min, max);
    return this;
  }

  /**
   * JOIN clause
   */
  join(table, column1, operator, column2) {
    this.query.joins.push({
      type: 'INNER',
      table,
      on: { column1, operator, column2 }
    });
    return this;
  }

  /**
   * LEFT JOIN clause
   */
  leftJoin(table, column1, operator, column2) {
    this.query.joins.push({
      type: 'LEFT',
      table,
      on: { column1, operator, column2 }
    });
    return this;
  }

  /**
   * ORDER BY clause
   */
  orderBy(column, direction = 'ASC') {
    this.query.orderBy.push({ column, direction });
    return this;
  }

  /**
   * GROUP BY clause
   */
  groupBy(...columns) {
    this.query.groupBy.push(...columns);
    return this;
  }

  /**
   * HAVING clause
   */
  having(column, operator, value) {
    this.query.having.push({ column, operator, value });
    this.bindings.push(value);
    return this;
  }

  /**
   * LIMIT clause
   */
  limit(count) {
    this.query.limit = count;
    return this;
  }

  /**
   * OFFSET clause
   */
  offset(count) {
    this.query.offset = count;
    return this;
  }

  /**
   * Построить SQL строку
   */
  toSQL() {
    let sql = '';
    let paramIndex = 1;

    switch (this.query.type) {
      case 'SELECT':
        sql = this._buildSelect(paramIndex);
        break;

      case 'INSERT':
        sql = this._buildInsert(paramIndex);
        break;

      case 'UPDATE':
        sql = this._buildUpdate(paramIndex);
        break;

      case 'DELETE':
        sql = this._buildDelete(paramIndex);
        break;

      default:
        throw new Error('Query type not specified');
    }

    return {
      sql: sql.trim(),
      bindings: this.bindings
    };
  }

  _buildSelect(paramIndex) {
    let sql = `SELECT ${this.query.columns.join(', ')} FROM ${this.table}`;

    // JOINs
    if (this.query.joins.length > 0) {
      for (const join of this.query.joins) {
        sql += ` ${join.type} JOIN ${join.table} ON ${join.on.column1} ${join.on.operator} ${join.on.column2}`;
      }
    }

    // WHERE
    if (this.query.where.length > 0) {
      sql += ' WHERE ';
      sql += this._buildWhere(paramIndex);
    }

    // GROUP BY
    if (this.query.groupBy.length > 0) {
      sql += ` GROUP BY ${this.query.groupBy.join(', ')}`;
    }

    // HAVING
    if (this.query.having.length > 0) {
      sql += ' HAVING ';
      sql += this.query.having
        .map(h => `${h.column} ${h.operator} ${this._getPlaceholder(paramIndex++)}`)
        .join(' AND ');
    }

    // ORDER BY
    if (this.query.orderBy.length > 0) {
      sql += ' ORDER BY ';
      sql += this.query.orderBy
        .map(o => `${o.column} ${o.direction}`)
        .join(', ');
    }

    // LIMIT
    if (this.query.limit) {
      sql += ` LIMIT ${this.query.limit}`;
    }

    // OFFSET
    if (this.query.offset) {
      sql += ` OFFSET ${this.query.offset}`;
    }

    return sql;
  }

  _buildInsert(paramIndex) {
    const columns = Object.keys(this.query.values);
    const placeholders = columns.map(() => this._getPlaceholder(paramIndex++));

    this.bindings = Object.values(this.query.values);

    return `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
  }

  _buildUpdate(paramIndex) {
    const sets = Object.keys(this.query.values)
      .map(col => `${col} = ${this._getPlaceholder(paramIndex++)}`)
      .join(', ');

    this.bindings = [...Object.values(this.query.values), ...this.bindings];

    let sql = `UPDATE ${this.table} SET ${sets}`;

    if (this.query.where.length > 0) {
      sql += ' WHERE ' + this._buildWhere(paramIndex);
    }

    return sql;
  }

  _buildDelete(paramIndex) {
    let sql = `DELETE FROM ${this.table}`;

    if (this.query.where.length > 0) {
      sql += ' WHERE ' + this._buildWhere(paramIndex);
    }

    return sql;
  }

  _buildWhere(paramIndex) {
    return this.query.where
      .map((condition, index) => {
        let clause = '';

        if (index > 0) {
          clause += ` ${condition.type} `;
        }

        if (condition.operator === 'IN') {
          const placeholders = condition.value
            .map(() => this._getPlaceholder(paramIndex++))
            .join(', ');
          clause += `${condition.column} IN (${placeholders})`;
        } else if (condition.operator === 'BETWEEN') {
          clause += `${condition.column} BETWEEN ${this._getPlaceholder(paramIndex++)} AND ${this._getPlaceholder(paramIndex++)}`;
        } else {
          clause += `${condition.column} ${condition.operator} ${this._getPlaceholder(paramIndex++)}`;
        }

        return clause;
      })
      .join('');
  }

  _getPlaceholder(index) {
    switch (this.dialect) {
      case 'postgres':
        return `$${index}`;
      case 'mysql':
      case 'sqlite':
        return '?';
      default:
        return '?';
    }
  }
}

module.exports = QueryBuilder;

// Пример использования:
/*
const QueryBuilder = require('./query-builder');

const qb = new QueryBuilder('users');

// SELECT запрос
const selectQuery = qb
  .select('id', 'name', 'email')
  .where('age', '>=', 18)
  .where('active', true)
  .orderBy('created_at', 'DESC')
  .limit(10)
  .toSQL();

console.log(selectQuery);
// {
//   sql: 'SELECT id, name, email FROM users WHERE age >= $1 AND active = $2 ORDER BY created_at DESC LIMIT 10',
//   bindings: [18, true]
// }

// INSERT запрос
const insertQuery = new QueryBuilder('users')
  .insert({
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  })
  .toSQL();

console.log(insertQuery);
// {
//   sql: 'INSERT INTO users (name, email, age) VALUES ($1, $2, $3)',
//   bindings: ['John Doe', 'john@example.com', 30]
// }
*/
