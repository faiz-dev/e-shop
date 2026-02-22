export class ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;

  constructor(data: T, message = 'Success') {
    this.success = true;
    this.message = message;
    this.data = data;
  }
}

export class PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;

  constructor(page: number, limit: number, totalItems: number) {
    this.page = page;
    this.limit = limit;
    this.totalItems = totalItems;
    this.totalPages = Math.ceil(totalItems / limit);
  }
}

export class PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: PaginationMeta;

  constructor(data: T[], meta: PaginationMeta, message = 'Success') {
    this.success = true;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }
}

export class ApiErrorResponse {
  success: boolean;
  message: string;
  errorCode: string;
  errors?: string[];

  constructor(message: string, errorCode: string, errors?: string[]) {
    this.success = false;
    this.message = message;
    this.errorCode = errorCode;
    this.errors = errors;
  }
}
