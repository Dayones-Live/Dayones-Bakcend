/**
 * Maps Entity to Dto
 *
 * @param entity
 * @param input
 * @param update
 */
export const mapInputToEntity = <T>(
  entity: T,
  input: Record<string, any>,
  update: boolean,
  changeCase: boolean = true,
): T => {
  Object.entries(input).forEach(([key, value]) => {
    let keyValue = key;

    if (changeCase) {
      keyValue = key
        .split(/(?=[A-Z])/)
        .join('_')
        .toLowerCase();
    }

    if (update) {
      (entity as Record<string, any>)[keyValue] =
        value !== undefined ? value : (entity as Record<string, any>)[keyValue];
    } else {
      (entity as Record<string, any>)[keyValue] = value;
    }
  });
  return entity;
};
