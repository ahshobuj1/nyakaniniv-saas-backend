// src/utils/QueryBuilder.ts

export class QueryBuilder<T> {
  public model: any;
  public query: Record<string, unknown>;
  public prismaArgs: {
    where: any;
    orderBy?: any;
    skip?: number;
    take?: number;
    select?: any;
    include?: any;
  };

  /**
   * Initialize the QueryBuilder for Prisma
   * @param model e.g., prisma.user, prisma.tenant
   * @param query e.g., req.query
   */
  constructor(model: any, query: Record<string, unknown>) {
    this.model = model;
    this.query = query;
    this.prismaArgs = { where: {} };
  }

  search(searchableFields: string[]) {
    const searchTerm = (this.query?.searchTerm || this.query?.search || this.query?.q) as string;

    if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim() !== '') {
      this.prismaArgs.where.OR = searchableFields.map((field) => ({
        [field]: { contains: searchTerm.trim(), mode: "insensitive" },
      }));
    }

    return this;
  }

  filter() {
    const filterQueryObj = { ...this.query };
    const excludeFields = [
      "searchTerm",
      "search",
      "q",
      "sort",
      "sortBy",
      "sortOrder",
      "order",
      "orderBy",
      "limit",
      "page",
      "fields",
    ];

    excludeFields.forEach((field) => delete filterQueryObj[field]);

    // Remove empty strings, undefined, null, or 'all' values
    Object.keys(filterQueryObj).forEach((key) => {
      const val = filterQueryObj[key];
      if (val === undefined || val === null || val === "" || val === "all") {
        delete filterQueryObj[key];
      }
    });

    // Add remaining exact matches to the where clause
    Object.assign(this.prismaArgs.where, filterQueryObj);

    return this;
  }

  sort() {
    const sortBy = this.query?.sortBy as string;
    const sortOrder = (this.query?.sortOrder as string)?.toLowerCase() === "asc" ? "asc" : "desc";

    if (sortBy) {
      this.prismaArgs.orderBy = [{ [sortBy]: sortOrder }];
      return this;
    }

    const sortParams = (this.query?.sort as string)?.split(",")?.join(" ") || "-createdAt";
    
    // Convert Mongoose sort strings ("-createdAt name") to Prisma format
    const sortArray = sortParams.split(" ").filter(Boolean);
    
    if (sortArray.length > 0) {
      this.prismaArgs.orderBy = sortArray.map((sortStr) => {
        const isDesc = sortStr.startsWith("-");
        const field = isDesc ? sortStr.substring(1) : sortStr;
        return { [field]: isDesc ? "desc" : "asc" };
      });
    }

    return this;
  }


  pagination() {
    const page = Number(this.query?.page) || 1;
    const limit = Number(this.query?.limit) || 10;
    const skip = (page - 1) * limit;

    this.prismaArgs.skip = skip;
    this.prismaArgs.take = limit;

    return this;
  }

  fields() {
    const fields = (this.query?.fields as string)?.split(",")?.join(" ");

    if (fields) {
      const fieldArray = fields.split(" ").filter(Boolean);
      
      if (fieldArray.length > 0) {
        this.prismaArgs.select = {};
        fieldArray.forEach((field) => {
          const isExclude = field.startsWith("-");
          const actualField = isExclude ? field.substring(1) : field;
          
          // Prisma doesn't support exclusion in select easily alongside inclusion,
          // so we typically only handle inclusion properly here.
          if (!isExclude) {
            this.prismaArgs.select[actualField] = true;
          }
        });
      }
    }

    return this;
  }

  async countTotal() {
    const total = await this.model.count({ where: this.prismaArgs.where });
    const page = Number(this.query?.page) || 1;
    const limit = Number(this.query?.limit) || 10;
    const totalPages = Math.ceil(total / limit);

    return {
      total,
      page,
      limit,
      totalPages,
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    };
  }
}
