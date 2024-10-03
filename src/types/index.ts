export class PaginationDto {
  pageNo: number;
  pageSize: number;
}

export class Paginate extends PaginationDto {
  offset: number;
  limit: number;
}

export class PaginationResponse {
  meta: Meta;
}
export class Meta {
  count: number;
  page: number;
  size: number;
  pages: number;
}
