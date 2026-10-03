export const up = async ({ queryInterface, transaction }) => {
  await queryInterface.sequelize.query(
    `
      UPDATE "products"
      SET "discountPercent" = CASE
        WHEN "price" > "salePrice" THEN ROUND((("price" - "salePrice") / "price") * 100)
        ELSE 0
      END;
    `,
    { transaction }
  );

  await queryInterface.sequelize.query(
    `
      UPDATE "product_variants" pv
      SET "mrp" = p."price"
      FROM "products" p
      WHERE pv."productId" = p."id";
    `,
    { transaction }
  );
};
