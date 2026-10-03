import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import bulkImportService from '../src/services/bulkImportService.js';

test('parses CSV headers and values', async () => {
  const rows = await bulkImportService.parseFileBuffer(
    Buffer.from('Product Name*,SKU*,MRP*\nGold Ring,TP-001,1999\n')
  );

  assert.deepEqual(rows, [{ 'Product Name*': 'Gold Ring', 'SKU*': 'TP-001', 'MRP*': 1999 }]);
});

test('parses XLSX worksheets and values', async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Products');
  worksheet.addRow(['Product Name*', 'SKU*', 'MRP*']);
  worksheet.addRow(['Gold Ring', 'TP-002', 2499]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const rows = await bulkImportService.parseFileBuffer(buffer);

  assert.deepEqual(rows, [{ 'Product Name*': 'Gold Ring', 'SKU*': 'TP-002', 'MRP*': 2499 }]);
});

test('rejects files without a header row', async () => {
  await assert.rejects(
    bulkImportService.parseFileBuffer(Buffer.from('\n')),
    /first row must contain column headers/
  );
});
