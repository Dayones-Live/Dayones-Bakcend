/**
 * Adds minutes to a given Date object
 *
 * @param date - The initial date
 * @param minutes - The number of minutes to add
 * @returns A new Date object with the added minutes
 */
export const addMinutesToDate = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60000);
};
