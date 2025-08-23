export class CategoryIdClass {
  categoryId: string;
  categoryName: string;
  logoUrl: string;
  constructor(data: any) {
    this.categoryId = data._id;
    this.categoryName = data.categoryName;
    this.logoUrl = data.logoUrl;
  }
}

export class SubCategoryIdClass {
  subCategoryId: string;
  subCategoryName: string;
  categoryId: string;
  constructor(data: any) {
    this.categoryId = data.categoryId;
    this.subCategoryId = data._id;
    this.subCategoryName = data.subCategoryName;
  }
}
