export const up = async ({ sequelize, queryInterface, transaction }) => {
  const models = Object.values(sequelize.models);
  const existingTables = new Set(
    (await queryInterface.showAllTables({ transaction })).map((table) =>
      typeof table === 'string' ? table : table.tableName
    )
  );

  const assertModelColumns = async (model) => {
    const tableName = model.getTableName();
    const columns = await queryInterface.describeTable(tableName, { transaction });
    const missingColumns = Object.entries(model.rawAttributes)
      .filter(([, attribute]) => attribute.type?.key !== 'VIRTUAL')
      .map(([attributeName, attribute]) => attribute.field || attributeName)
      .filter((columnName) => !columns[columnName]);

    if (missingColumns.length) {
      throw new Error(
        `Existing table "${tableName}" is missing required columns: ${missingColumns.join(', ')}`
      );
    }
  };

  for (const model of models) {
    const tableName = model.getTableName();
    const tableKey = typeof tableName === 'string' ? tableName : tableName.tableName;
    if (existingTables.has(tableKey)) {
      await assertModelColumns(model);
    }
  }

  await sequelize.sync({ alter: false, transaction });

  for (const model of models) {
    await assertModelColumns(model);
  }
};
