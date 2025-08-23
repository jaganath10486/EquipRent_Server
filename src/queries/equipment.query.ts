export const CategoryPopulate = [
  {
    path: "categoryId",
    select: "categoryName logoUrl _id",
  },
];

export const SubCategoryPopulate = [
  {
    path: "subCategoryId",
    select: "subCategoryName categoryId _id",
  },
];

export const FilterEquipments = [{
  
}];
