export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: any;
}

export const successResponse = <T>(
  message: string,
  data?: T,
  meta?: any
): ApiResponse<T> => {
  return {
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta !== undefined && { meta }),
  };
};

export const errorResponse = (
  message: string,
  meta?: any
): ApiResponse<null> => {
  return {
    success: false,
    message,
    ...(meta !== undefined && { meta }),
  };
};
