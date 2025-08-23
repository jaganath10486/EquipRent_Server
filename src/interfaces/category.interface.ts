export interface CategoryInterface {
  categoryName: string;
  logoUrl?: string;
  _id?: string;
  isActive: string;
}

export interface SubCategoryInterface {
  subCategoryName: string;
  isActive: boolean;
  _id: string;
  categoryId: any;
}
