import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Meta, Paginate } from '@app/types';

dayjs.extend(utc);

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

export const getPaginated = (pageNo: number, pageSize: number): Paginate => {
  return {
    offset: (pageNo - 1) * pageSize,
    limit: pageSize,
    pageSize: pageSize,
    pageNo: pageNo,
  };
};

export const getPaginatedOutput = (
  page: number,
  pageSize: number,
  count: number,
): Meta => {
  return {
    count,
    page: page ? Number(page) : 1,
    size: pageSize ? Number(pageSize) : count,
    pages: pageSize ? Math.ceil(count / pageSize) : 1,
  };
};

export const getCurrentUtcTime = () => dayjs.utc().toDate();
