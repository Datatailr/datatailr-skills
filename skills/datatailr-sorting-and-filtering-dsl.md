# Sorting and Filtering DSL

Many list-style `dt` commands support filtering, sorting, and pagination. The filter/sort expression strings are the same across commands that support these options.

### Filtering (`-f`)

The filter expression is a string of conditions joined by `and` / `or`:

```
field operator value [and|or field operator value ...]
```

Tokens are **space-separated**. The field name, operator, and value are each a separate token.

#### Operators

| Operator | Works with | Value required | Description |
|---|---|---|---|
| `=` or `==` | TEXT, NUMERIC | yes | Exact equality |
| `!=` | TEXT, NUMERIC | yes | Not equal (`<>` in SQL) |
| `<` `<=` `>` `>=` | NUMERIC only | yes | Numeric comparison |
| `starts_with` | TEXT only | yes | Case-insensitive prefix match (`ILIKE 'val%'`) |
| `ends_with` | TEXT only | yes | Case-insensitive suffix match (`ILIKE '%val'`) |
| `contains` | TEXT only | yes | Case-insensitive substring match (`ILIKE '%val%'`) |
| `is_null` | TEXT, NUMERIC | no | Check that field is NULL |
| `is_not_null` | TEXT, NUMERIC | no | Check that field is not NULL |

Special characters `%`, `_`, and `\` inside values are automatically escaped, so they are matched literally.

#### Array values

Use `[val1, val2, val3]` to match any of the values:

```
name = [job-a, job-b, job-c]
```

Arrays work with `=` (generates `= ANY($N)`) and text operators like `starts_with` (generates `ILIKE ANY($N)`).

**Important:** values are space-separated; for arrays, each element must end with `,` (except the last, which ends with `]`): `val1,` `val2,` `val3]`.

#### Quoted values

Wrap a value in double or single quotes when it contains spaces or any of `( ) [ ] ,`. Quoting a plain value is optional: `name = 'my-job'` and `name = my-job` are the same.

```
display_name contains "Daily Report"
display_name = ["Daily Report", "Weekly (EU)"]
display_name = 'Mike\'s report'
```

Inside quotes, a backslash before the enclosing quote character (`\"` or `\'`) gives that quote literally and `\\` gives a literal backslash; any other backslash is kept as is. A quoted value is always a value, so `"and"` or `']'` is not read as a keyword or bracket. Closing `)`, `,` and `]` attach right after the closing quote.

#### Parentheses

Group conditions with parentheses for complex logic:

```
(type = batch or type = service) and state = ready
```

Parentheses attach directly to the field name or value (no space between `(` and the field, or the value and `)`):

```
(type = batch and name starts_with prod-) or environment = pre
```

#### Negation (`not`)

Prefix a condition with `not` to negate it:

```
not name starts_with test-
not (type = batch or type = service)
```

`not` emits a SQL `NOT` before the following condition. It can be combined with parentheses to negate a group of conditions.

#### Null checks

`is_null` and `is_not_null` are special operators that take **no value**:

```
end_time is_null
end_time is_not_null and state = running
```

#### Logical connectors

- `and` — both conditions must be true
- `or` — either condition must be true

No implicit precedence — use parentheses for disambiguation.

### Sorting (`-s`)

The sort expression is a space-separated list of fields with optional direction prefix:

```
-field1 +field2 field3
```

| Prefix | Direction |
|---|---|
| `-` | Descending (`DESC`) |
| `+` | Ascending (`ASC`) |
| *(none)* | Ascending (`ASC`) — default |

Multiple fields are applied in order (primary sort, secondary sort, etc.).

### Pagination (`-b`, `-o`)

| Option | Field | SQL Equivalent|
|---|---|---|
| `-b` / `--batch-size` | `limit` | `LIMIT N` |
| `-o` / `--offset` | `offset` | `OFFSET N` |

Defaults vary by command; if unset, limit/offset are typically not applied (equivalent to unlimited / offset 0). Check `dt <command> --help` for the effective defaults.
