// eslint-disable-next-line
export const recursiveParseBigint = (value) => {
  if (value instanceof Object) {
    return Array.isArray(value)
      ? value.map((val) => recursiveParseBigint(val))
      : Object.entries(value).reduce(
          (acum, [key, val]) => ({
            ...acum,
            [key]: recursiveParseBigint(val),
          }),
          {}
        );
  }
  if (typeof value === "bigint") {
    return parseInt(value.toString(), 10);
  }
  return value;
};
