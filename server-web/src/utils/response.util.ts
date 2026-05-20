import { ApiResponse, PaginatedResponse } from '../types/api.types';

export const successResponse = <T = any>(
  data: T,
  message?: string
): ApiResponse<T> => {
  return {
    success: true,
    data,
    message,
  };
};

export const errorResponse = (
  code: string,
  message: string,
  details?: any
): ApiResponse => {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
};

export const paginatedResponse = <T = any>(
  items: T[],
  page: number,
  pageSize: number,
  total: number
): ApiResponse<PaginatedResponse<T>> => {
  return successResponse({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
};
