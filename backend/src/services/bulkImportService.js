import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import {
  Product,
  Category,
  Subcategory,
  ProductImage,
  ProductVariant,
  Color,
  Size,
  BulkImport,
  AuditLog,
} from '../models/index.js';
import { BULK_IMPORT_STATUS } from '../models/BulkImport.js';
import { PRODUCT_STATUS } from '../models/Product.js';
import meiliService from './meiliService.js';
import queueService from './queueService.js';
import { QUEUE_NAMES } from '../config/queues.js';
import AppError from '../utils/customError.js';
import logger from '../config/logger.js';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export const bulkImportService = {
  /**
   * Generate Clean Interactive Excel Template with Product Attributes & Dropdowns (No SEO fields)
   */
  async generateTemplate() {
    // 1. Fetch live categories & subcategories from DB
    const categories = await Category.findAll({
      where: { isActive: true },
      include: [{ model: Subcategory, as: 'subcategories', where: { isActive: true }, required: false }],
      order: [['name', 'ASC']],
    });

    const colors = await Color.findAll({ order: [['name', 'ASC']] });
    const sizes = await Size.findAll({ order: [['name', 'ASC']] });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ThePurple Store';
    workbook.created = new Date();

    // ─── Sheet 1: Main Product Entry Sheet ──────────────────────────────────
    const sheet = workbook.addWorksheet('Products Import', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'Product Name*', key: 'name', width: 34 },
      { header: 'SKU*', key: 'sku', width: 20 },
      { header: 'Category*', key: 'category', width: 24 },
      { header: 'Subcategory*', key: 'subcategory', width: 26 },
      { header: 'MRP*', key: 'mrp', width: 14 },
      { header: 'Selling Price*', key: 'sellingPrice', width: 16 },
      { header: 'Tax Rate %', key: 'taxRate', width: 14 },
      { header: 'HSN Code', key: 'hsnCode', width: 15 },
      { header: 'Stock Quantity*', key: 'stock', width: 16 },
      { header: 'Low Stock Alert', key: 'lowStock', width: 16 },
      { header: 'Brand', key: 'brand', width: 16 },
      { header: 'Product Badge', key: 'badge', width: 18 },
      { header: 'Image Filename(s) or URLs', key: 'image', width: 38 },
      { header: 'Color Name', key: 'color', width: 18 },
      { header: 'Size Name', key: 'size', width: 18 },
      { header: 'Short Description', key: 'shortDesc', width: 36 },
      { header: 'Full Description', key: 'fullDesc', width: 44 },
      { header: 'Specifications', key: 'specs', width: 32 },
      { header: 'Care Instructions', key: 'care', width: 32 },
      { header: 'Tags (comma separated)', key: 'tags', width: 28 },
      { header: 'Status (DRAFT/PUBLISHED/UNPUBLISHED)', key: 'status', width: 28 },
      { header: 'Is Active (TRUE/FALSE)', key: 'isActive', width: 22 },
      { header: 'Is Featured (TRUE/FALSE)', key: 'isFeatured', width: 22 },
      { header: 'Is Best Seller (TRUE/FALSE)', key: 'isBestSeller', width: 24 },
      { header: 'Bulk Selling (TRUE/FALSE)', key: 'isBulk', width: 24 },
      { header: 'Min Order Quantity (MOQ)', key: 'moq', width: 24 },
      { header: 'Weight (grams)', key: 'weight', width: 16 },
      { header: 'Length (cm)', key: 'length', width: 14 },
      { header: 'Width (cm)', key: 'width', width: 14 },
      { header: 'Height (cm)', key: 'height', width: 14 },
    ];

    // Header styling: Purple Fill with Bold White text
    const headerRow = sheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7E22CE' }, // Brand Royal Purple
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF6B21A8' } },
        left: { style: 'thin', color: { argb: 'FF6B21A8' } },
        bottom: { style: 'medium', color: { argb: 'FF4C1D95' } },
        right: { style: 'thin', color: { argb: 'FF6B21A8' } },
      };
    });

    // Extract names for dropdowns
    const categoryNames = categories.map((c) => c.name.trim()).filter(Boolean);
    const allSubcategoryNames = [];
    categories.forEach((c) => {
      (c.subcategories || []).forEach((s) => {
        if (s.name && !allSubcategoryNames.includes(s.name.trim())) {
          allSubcategoryNames.push(s.name.trim());
        }
      });
    });

    const colorNames = colors.map((c) => c.name.trim()).filter(Boolean);
    const sizeNames = sizes.map((s) => s.name.trim()).filter(Boolean);

    const sampleCategory = categoryNames[0] || 'Jewellery';
    const sampleSubcategory = categories[0]?.subcategories?.[0]?.name || 'Necklaces';

    // Sample Demonstration Rows
    const sampleRows = [
      {
        name: 'Gold Plated Floral Pendant Necklace',
        sku: 'TP-JW-NCK-SAMPLE-01',
        category: sampleCategory,
        subcategory: sampleSubcategory,
        mrp: 2499,
        sellingPrice: 1799,
        taxRate: 3,
        hsnCode: '7113',
        stock: 45,
        lowStock: 5,
        brand: 'ThePurple',
        badge: 'HOT',
        image: 'necklace-front.jpg, necklace-model.jpg',
        color: colorNames[0] || 'Gold',
        size: sizeNames[0] || 'Free Size',
        shortDesc: 'Elegant 18K gold plated floral pendant necklace with zircon crystals',
        fullDesc: 'Crafted with premium brass and dipped in 18K gold. Perfect for festive and casual occasions.',
        specs: 'Material: Brass, Finish: 18K Gold Plated, Stone: Cubic Zirconia',
        care: 'Keep away from moisture, perfumes and chemicals. Store in airtight box.',
        tags: 'jewellery, necklace, floral, gold, pendant',
        status: 'PUBLISHED',
        isActive: 'TRUE',
        isFeatured: 'TRUE',
        isBestSeller: 'TRUE',
        isBulk: 'FALSE',
        moq: 1,
        weight: 35,
        length: 15,
        width: 10,
        height: 3,
      },
      {
        name: 'Mini Teddy Bear Keychain Plushies (Bulk Pack)',
        sku: 'TP-TOY-TED-SAMPLE-02',
        category: categories.find((c) => c.name.toLowerCase().includes('teddy') || c.name.toLowerCase().includes('toy'))?.name || sampleCategory,
        subcategory: categories.find((c) => c.name.toLowerCase().includes('teddy') || c.name.toLowerCase().includes('toy'))?.subcategories?.[0]?.name || sampleSubcategory,
        mrp: 299,
        sellingPrice: 149,
        taxRate: 12,
        hsnCode: '9503',
        stock: 500,
        lowStock: 50,
        brand: 'ThePurple',
        badge: 'SALE',
        image: 'sample-teddy.jpg',
        color: 'Brown',
        size: '10cm',
        shortDesc: 'Wholesale mini plush teddy bear keychains for gifting and events',
        fullDesc: 'Soft fluffy mini teddy bear keychains. Minimum order quantity of 30 pieces applies.',
        specs: 'Material: Super soft plush, Filling: PP Cotton, Size: 10cm',
        care: 'Surface wash only with damp cloth.',
        tags: 'teddy bear, keychain, plushie, bulk, wholesale',
        status: 'PUBLISHED',
        isActive: 'TRUE',
        isFeatured: 'FALSE',
        isBestSeller: 'TRUE',
        isBulk: 'TRUE',
        moq: 30,
        weight: 40,
        length: 10,
        width: 8,
        height: 6,
      },
    ];

    sampleRows.forEach((item) => {
      const addedRow = sheet.addRow(item);
      addedRow.alignment = { vertical: 'middle' };
    });

    // Apply Data Validation dropdowns for rows 2 to 500
    for (let r = 2; r <= 500; r++) {
      // 1. Category Dropdown (Column C)
      if (categoryNames.length > 0) {
        sheet.getCell(`C${r}`).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`'Categories & Subcategories'!$A$2:$A$${categoryNames.length + 1}`],
          showErrorMessage: true,
          errorTitle: 'Invalid Category',
          error: 'Please choose a valid Category from the dropdown list.',
        };
      }

      // 2. Subcategory Dropdown (Column D)
      if (allSubcategoryNames.length > 0) {
        sheet.getCell(`D${r}`).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`'Categories & Subcategories'!$D$2:$D$${allSubcategoryNames.length + 1}`],
          showErrorMessage: true,
          errorTitle: 'Invalid Subcategory',
          error: 'Please select a valid Subcategory from the dropdown list.',
        };
      }

      // 3. Tax Rate Dropdown (Column G)
      sheet.getCell(`G${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"0,3,5,12,18,28"'],
      };

      // 4. Product Badge Dropdown (Column L)
      sheet.getCell(`L${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"NEW,HOT,TRENDING,SALE,BESTSELLER,HANDMADE,EXCLUSIVE"'],
      };

      // 5. Color Name Dropdown (Column N)
      if (colorNames.length > 0) {
        sheet.getCell(`N${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'Colors & Sizes Reference'!$A$2:$A$${colorNames.length + 1}`],
        };
      }

      // 6. Size Name Dropdown (Column O)
      if (sizeNames.length > 0) {
        sheet.getCell(`O${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'Colors & Sizes Reference'!$C$2:$C$${sizeNames.length + 1}`],
        };
      }

      // 7. Status Dropdown (Column U)
      sheet.getCell(`U${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"PUBLISHED,DRAFT,UNPUBLISHED"'],
      };

      // 8. Is Active Dropdown (Column V)
      sheet.getCell(`V${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"TRUE,FALSE"'],
      };

      // 9. Is Featured Dropdown (Column W)
      sheet.getCell(`W${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"TRUE,FALSE"'],
      };

      // 10. Is Best Seller Dropdown (Column X)
      sheet.getCell(`X${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"TRUE,FALSE"'],
      };

      // 11. Bulk Selling Dropdown (Column Y)
      sheet.getCell(`Y${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"TRUE,FALSE"'],
      };
    }

    // ─── Sheet 2: Categories & Subcategories Reference ─────────────────────
    const catSheet = workbook.addWorksheet('Categories & Subcategories');
    catSheet.columns = [
      { header: 'Category Name (Dropdown List)', key: 'catName', width: 30 },
      { header: 'Subcategories in Category', key: 'subNames', width: 45 },
      { header: 'Category Slug', key: 'catSlug', width: 22 },
      { header: 'All Subcategories (Dropdown List)', key: 'allSubs', width: 34 },
    ];

    const catHeader = catSheet.getRow(1);
    catHeader.height = 26;
    catHeader.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF581C87' }, // Deep Purple
      };
      cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle' };
    });

    const maxCatRows = Math.max(categories.length, allSubcategoryNames.length, 1);
    for (let i = 0; i < maxCatRows; i++) {
      const cat = categories[i];
      const subs = cat ? (cat.subcategories || []).map((s) => s.name).join(', ') : '';
      catSheet.addRow({
        catName: cat ? cat.name : '',
        subNames: subs || '',
        catSlug: cat ? cat.slug : '',
        allSubs: allSubcategoryNames[i] || '',
      });
    }

    // ─── Sheet 3: Colors & Sizes Reference ─────────────────────────────────
    const attrSheet = workbook.addWorksheet('Colors & Sizes Reference');
    attrSheet.columns = [
      { header: 'Color Name', key: 'colorName', width: 22 },
      { header: 'Hex Code', key: 'hexCode', width: 16 },
      { header: 'Size Name', key: 'sizeName', width: 22 },
    ];

    const attrHeader = attrSheet.getRow(1);
    attrHeader.height = 26;
    attrHeader.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF581C87' },
      };
      cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle' };
    });

    const maxAttrLen = Math.max(colors.length, sizes.length, 1);
    for (let i = 0; i < maxAttrLen; i++) {
      attrSheet.addRow({
        colorName: colors[i]?.name || '',
        hexCode: colors[i]?.hexCode || '',
        sizeName: sizes[i]?.name || '',
      });
    }

    // ─── Sheet 4: Instructions & Image Guide ──────────────────────────────
    const guideSheet = workbook.addWorksheet('Instructions & Guide');
    guideSheet.columns = [
      { header: 'Field / Topic', key: 'topic', width: 30 },
      { header: 'Instructions & Guidelines (English & Hindi)', key: 'desc', width: 75 },
    ];

    const guideHeader = guideSheet.getRow(1);
    guideHeader.height = 26;
    guideHeader.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B0764' },
      };
      cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle' };
    });

    const guideRows = [
      {
        topic: '1. Category & Subcategory Select',
        desc: 'Excel me Category aur Subcategory dono column par click karte hi Dropdown Select option aayega. Aap dropdown se category aur subcategory chun sakte hain.',
      },
      {
        topic: '2. Product Images (Automatic Match & Upload)',
        desc: 'Excel ke "Image Filename(s) or URLs" column me image file ka naam likhein (e.g. "necklace.jpg" ya multiple: "front.jpg, back.jpg"). Phir Admin modal me Excel aur Image files dono ek sath upload kar dein. Backend automatic images ko match karke Cloudflare R2 pe WebP format me upload kar dega.',
      },
      {
        topic: '3. Dropdowns for Badges, Colors & Sizes',
        desc: 'Product Badge (HOT, NEW, SALE, etc.), Color Name, Size Name, Tax Rate, Status, Featured, Best Seller sabhi ke liye Excel me interactive dropdown options diye gaye hain.',
      },
      {
        topic: '4. Clean Product Form',
        desc: 'All core product details (pricing, stock, descriptions, tags, dimensions) are included. SEO titles and descriptions are auto-generated automatically.',
      },
    ];

    guideRows.forEach((r) => guideSheet.addRow(r));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },

  /**
   * Parse uploaded Excel or CSV buffer to structured array of rows
   */
  async parseFileBuffer(buffer) {
    try {
      const workbook = new ExcelJS.Workbook();
      let worksheet;

      if (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
        await workbook.xlsx.load(buffer);
        worksheet = workbook.worksheets[0];
      } else {
        worksheet = await workbook.csv.read(Readable.from([buffer]));
      }

      if (!worksheet) {
        throw new Error('The uploaded file does not contain any worksheets');
      }

      const headers = worksheet.getRow(1).values.slice(1);
      if (!headers.length || headers.every((header) => !header)) {
        throw new Error('The first row must contain column headers');
      }

      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const values = {};
        headers.forEach((header, index) => {
          if (!header) return;
          let value = row.getCell(index + 1).value;
          if (value && typeof value === 'object') {
            if ('result' in value) value = value.result;
            else if ('text' in value) value = value.text;
            else if ('richText' in value) value = value.richText.map((part) => part.text).join('');
            else value = row.getCell(index + 1).text;
          }
          values[String(header)] = value ?? '';
        });
        rows.push(values);
      });

      return rows;
    } catch (err) {
      throw AppError.badRequest(`Failed to parse Excel/CSV file: ${err.message}`);
    }
  },

  /**
   * Validate uploaded rows against schema and database constraints
   */
  async validateRows(rows, imageFiles = []) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw AppError.badRequest('The uploaded file contains no data rows');
    }

    const errors = [];
    const warnings = [];
    const validRows = [];
    const seenSkusInFile = new Set();

    // Map uploaded images by filename (e.g., 'necklace.jpg' -> file)
    const uploadedImagesMap = new Map();
    if (Array.isArray(imageFiles) && imageFiles.length > 0) {
      imageFiles.forEach((img) => {
        const orig = (img.originalname || '').toLowerCase().trim();
        uploadedImagesMap.set(orig, img);
        // Also map without extension (e.g., 'necklace' -> file)
        const nameWithoutExt = orig.substring(0, orig.lastIndexOf('.')) || orig;
        uploadedImagesMap.set(nameWithoutExt, img);
      });
    }

    // Cache existing Categories & Subcategories
    const categories = await Category.findAll({
      include: [{ model: Subcategory, as: 'subcategories' }],
    });

    const categoryMap = new Map();
    for (const cat of categories) {
      categoryMap.set(cat.name.toLowerCase().trim(), cat);
    }

    // Cache existing SKUs from DB
    const existingProducts = await Product.findAll({
      attributes: ['sku'],
      paranoid: false,
    });
    const dbSkuSet = new Set(existingProducts.map((p) => (p.sku || '').toUpperCase().trim()));

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2; // +1 for header, +1 for 1-indexing
      const rowErrors = [];

      // Extract all product fields
      const name = (row['Product Name*'] || row['Product Name'] || row['name'] || '').toString().trim();
      const sku = (row['SKU*'] || row['SKU'] || row['sku'] || '').toString().trim().toUpperCase();
      const categoryName = (row['Category*'] || row['Category'] || row['category'] || '').toString().trim();
      const subcategoryName = (row['Subcategory*'] || row['Subcategory'] || row['subcategory'] || '').toString().trim();
      const mrpRaw = row['MRP*'] || row['MRP'] || row['price'] || row['Price'] || '';
      const salePriceRaw = row['Selling Price*'] || row['Selling Price'] || row['salePrice'] || row['Sale Price'] || '';
      const taxRateRaw = row['Tax Rate %'] || row['Tax Rate'] || row['taxRate'] || '0';
      const hsnCode = (row['HSN Code'] || row['hsnCode'] || '').toString().trim();
      const stockRaw = row['Stock Quantity*'] || row['Stock Quantity'] || row['Stock'] || row['stock'] || '0';
      const lowStockRaw = row['Low Stock Alert'] || row['Low Stock Threshold'] || row['lowStockThreshold'] || '5';
      const brand = (row['Brand'] || row['brand'] || 'ThePurple').toString().trim();
      const badge = (row['Product Badge'] || row['Badge'] || row['badge'] || '').toString().trim();
      const rawImage = (row['Image Filename(s) or URLs'] || row['Image URL or Filename'] || row['Primary Image URL'] || row['imageUrl'] || row['Image URL'] || '').toString().trim();
      const colorName = (row['Color Name'] || row['Color'] || row['color'] || '').toString().trim();
      const sizeName = (row['Size Name'] || row['Size'] || row['size'] || '').toString().trim();
      const shortDescription = (row['Short Description'] || row['shortDescription'] || '').toString().trim();
      const description = (row['Full Description'] || row['Description'] || row['description'] || '').toString().trim();
      const specifications = (row['Specifications'] || row['specifications'] || '').toString().trim();
      const careInstructions = (row['Care Instructions'] || row['careInstructions'] || '').toString().trim();
      const tagsRaw = (row['Tags (comma separated)'] || row['Tags'] || row['tags'] || '').toString();
      const statusRaw = (row['Status (DRAFT/PUBLISHED/UNPUBLISHED)'] || row['Status'] || row['status'] || 'DRAFT').toString().trim().toUpperCase();
      
      const isActiveRaw = (row['Is Active (TRUE/FALSE)'] || row['Is Active'] || row['isActive'] || 'TRUE').toString().trim().toUpperCase();
      const isActive = isActiveRaw !== 'FALSE' && isActiveRaw !== '0';

      const isFeaturedRaw = (row['Is Featured (TRUE/FALSE)'] || row['Is Featured'] || row['isFeatured'] || 'FALSE').toString().trim().toUpperCase();
      const isFeatured = isFeaturedRaw === 'TRUE' || isFeaturedRaw === '1' || isFeaturedRaw === 'YES';

      const isBestSellerRaw = (row['Is Best Seller (TRUE/FALSE)'] || row['Is Best Seller'] || row['isBestSeller'] || 'FALSE').toString().trim().toUpperCase();
      const isBestSeller = isBestSellerRaw === 'TRUE' || isBestSellerRaw === '1' || isBestSellerRaw === 'YES';

      const isBulkRaw = (row['Bulk Selling (TRUE/FALSE)'] || row['Bulk Selling'] || row['isBulk'] || row['is_bulk'] || '').toString().trim().toUpperCase();
      const isBulk = isBulkRaw === 'TRUE' || isBulkRaw === '1' || isBulkRaw === 'YES';
      const minOrderRaw = row['Min Order Quantity (MOQ)'] || row['Min Order Quantity'] || row['minOrderQuantity'] || row['min_order_quantity'] || '1';
      const minOrderQuantity = Math.max(1, parseInt(minOrderRaw, 10) || 1);

      const weightRaw = row['Weight (grams)'] || row['weightGrams'] || '';
      const lengthRaw = row['Length (cm)'] || row['lengthCm'] || '';
      const widthRaw = row['Width (cm)'] || row['widthCm'] || '';
      const heightRaw = row['Height (cm)'] || row['heightCm'] || '';

      // Required field checks
      if (!name) rowErrors.push('Product Name is required');
      if (!sku) rowErrors.push('SKU is required');
      if (!categoryName) rowErrors.push('Category is required');
      if (!subcategoryName) rowErrors.push('Subcategory is required');

      // SKU uniqueness validation
      if (sku) {
        if (seenSkusInFile.has(sku)) {
          rowErrors.push(`Duplicate SKU "${sku}" found within the uploaded file`);
        } else {
          seenSkusInFile.add(sku);
        }

        if (dbSkuSet.has(sku)) {
          rowErrors.push(`SKU "${sku}" already exists in the database`);
        }
      }

      // Category & Subcategory resolution
      let matchedCategory = null;
      let matchedSubcategory = null;

      if (categoryName) {
        matchedCategory = categoryMap.get(categoryName.toLowerCase());
        if (!matchedCategory) {
          rowErrors.push(`Category "${categoryName}" does not exist in store`);
        } else if (subcategoryName) {
          matchedSubcategory = matchedCategory.subcategories?.find(
            (s) => s.name.toLowerCase().trim() === subcategoryName.toLowerCase()
          );
          if (!matchedSubcategory) {
            rowErrors.push(`Subcategory "${subcategoryName}" does not belong to category "${categoryName}"`);
          }
        }
      }

      // Pricing validation
      const mrp = parseFloat(mrpRaw);
      const salePrice = salePriceRaw !== '' ? parseFloat(salePriceRaw) : mrp;
      const taxRate = parseFloat(taxRateRaw) || 0;

      if (isNaN(mrp) || mrp < 0) {
        rowErrors.push('MRP must be a valid positive number');
      }
      if (isNaN(salePrice) || salePrice < 0) {
        rowErrors.push('Selling Price must be a valid positive number');
      }
      if (!isNaN(mrp) && !isNaN(salePrice) && salePrice > mrp) {
        rowErrors.push(`Selling Price (${salePrice}) cannot exceed MRP (${mrp})`);
      }

      // Stock validation
      const stock = parseInt(stockRaw, 10);
      if (isNaN(stock) || stock < 0) {
        rowErrors.push('Stock Quantity must be a valid non-negative integer');
      }

      // Status validation
      let status = PRODUCT_STATUS.DRAFT;
      if (statusRaw && Object.values(PRODUCT_STATUS).includes(statusRaw)) {
        status = statusRaw;
      } else if (statusRaw) {
        warnings.push({ row: rowNumber, sku, warning: `Unrecognized status "${statusRaw}", defaulting to DRAFT` });
      }

      // Multi-Image detection & matching
      const imageItems = rawImage
        ? rawImage
            .split(/[,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const matchedImageFiles = [];
      const remoteUrls = [];
      let imageMatchStatus = 'No image provided (optional)';

      for (const item of imageItems) {
        if (item.startsWith('http://') || item.startsWith('https://')) {
          remoteUrls.push(item);
        } else if (uploadedImagesMap.has(item.toLowerCase())) {
          matchedImageFiles.push(uploadedImagesMap.get(item.toLowerCase()));
        } else {
          warnings.push({ row: rowNumber, sku, warning: `Attached image "${item}" not found in upload batch` });
        }
      }

      // Also check SKU matching if none matched
      if (matchedImageFiles.length === 0 && remoteUrls.length === 0 && sku) {
        if (uploadedImagesMap.has(sku.toLowerCase())) {
          matchedImageFiles.push(uploadedImagesMap.get(sku.toLowerCase()));
        }
        if (uploadedImagesMap.has(`${sku.toLowerCase()}-1`)) {
          matchedImageFiles.push(uploadedImagesMap.get(`${sku.toLowerCase()}-1`));
        }
        if (uploadedImagesMap.has(`${sku.toLowerCase()}-2`)) {
          matchedImageFiles.push(uploadedImagesMap.get(`${sku.toLowerCase()}-2`));
        }
      }

      if (matchedImageFiles.length > 0 && remoteUrls.length > 0) {
        imageMatchStatus = `✓ ${matchedImageFiles.length} file(s) + ${remoteUrls.length} URL(s)`;
      } else if (matchedImageFiles.length > 0) {
        imageMatchStatus = `✓ ${matchedImageFiles.length} File(s): ${matchedImageFiles.map((f) => f.originalname).join(', ')}`;
      } else if (remoteUrls.length > 0) {
        imageMatchStatus = `✓ ${remoteUrls.length} Remote Web URL(s)`;
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          sku: sku || 'N/A',
          productName: name || 'N/A',
          messages: rowErrors,
        });
      } else {
        const tags = tagsRaw
          ? tagsRaw
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [];

        validRows.push({
          rowNumber,
          name,
          sku,
          slug: slugify(name),
          categoryName,
          subcategoryName,
          subcategoryId: matchedSubcategory?.id,
          price: mrp,
          salePrice,
          taxRate,
          hsnCode: hsnCode || null,
          discountPercent: mrp > 0 ? Math.round(((mrp - salePrice) / mrp) * 100) : 0,
          stock,
          lowStockThreshold: parseInt(lowStockRaw, 10) || 5,
          brand: brand || 'ThePurple',
          badge: badge || null,
          shortDescription: shortDescription || null,
          description: description || null,
          specifications: specifications || null,
          careInstructions: careInstructions || null,
          tags,
          primaryImageUrl: remoteUrls[0] || null,
          allImageUrls: [...remoteUrls],
          rawImage,
          matchedImageFiles,
          imageMatchStatus,
          status,
          isActive,
          isFeatured,
          isBestSeller,
          isBulk,
          minOrderQuantity: isBulk ? minOrderQuantity : 1,
          colorName: colorName || null,
          sizeName: sizeName || null,
          weightGrams: weightRaw ? parseFloat(weightRaw) : null,
          lengthCm: lengthRaw ? parseFloat(lengthRaw) : null,
          widthCm: widthRaw ? parseFloat(widthRaw) : null,
          heightCm: heightRaw ? parseFloat(heightRaw) : null,
        });
      }
    }

    return {
      totalRows: rows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
      validRows,
    };
  },

  /**
   * Process and insert a batch of valid product rows into database & Meilisearch
   */
  async processImportBatch(validRows, bulkImportId, adminId) {
    const bulkImport = await BulkImport.findByPk(bulkImportId);
    if (!bulkImport) throw new Error('BulkImport record not found');

    await bulkImport.update({
      status: BULK_IMPORT_STATUS.PROCESSING,
      processedRows: 0,
      createdCount: 0,
      failedCount: 0,
    });

    let createdCount = 0;
    let failedCount = 0;
    const batchErrors = [];
    const productsToSearchIndex = [];

    // Pre-cache Colors and Sizes
    const allColors = await Color.findAll();
    const colorMap = new Map(allColors.map((c) => [c.name.toLowerCase().trim(), c.id]));

    const allSizes = await Size.findAll();
    const sizeMap = new Map(allSizes.map((s) => [s.name.toLowerCase().trim(), s.id]));

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const transaction = await sequelize.transaction();

      try {
        let finalSlug = row.slug;
        const existingSlug = await Product.findOne({ where: { slug: finalSlug } });
        if (existingSlug) {
          finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}-${i}`;
        }

        const product = await Product.create(
          {
            name: row.name,
            sku: row.sku,
            slug: finalSlug,
            subcategoryId: row.subcategoryId,
            shortDescription: row.shortDescription,
            description: row.description,
            brand: row.brand,
            badge: row.badge,
            specifications: row.specifications,
            careInstructions: row.careInstructions,
            price: row.price,
            salePrice: row.salePrice,
            taxRate: row.taxRate,
            hsnCode: row.hsnCode,
            discountPercent: row.discountPercent,
            stock: row.stock,
            lowStockThreshold: row.lowStockThreshold,
            status: row.status,
            publishedAt: row.status === PRODUCT_STATUS.PUBLISHED ? new Date() : null,
            isActive: row.isActive,
            isFeatured: row.isFeatured,
            isBestSeller: row.isBestSeller,
            isBulk: Boolean(row.isBulk),
            minOrderQuantity: row.minOrderQuantity || 1,
            seoTitle: row.name,
            seoDescription: row.shortDescription || row.name,
            seoKeywords: row.tags?.join(', ') || null,
            tags: row.tags,
            weightGrams: row.weightGrams,
            lengthCm: row.lengthCm,
            widthCm: row.widthCm,
            heightCm: row.heightCm,
          },
          { transaction }
        );

        // Add all images (primary + gallery)
        const imagesToCreate = (row.allImageUrls || []).filter(Boolean);
        if (imagesToCreate.length === 0 && row.primaryImageUrl) {
          imagesToCreate.push(row.primaryImageUrl);
        }

        for (let imgIdx = 0; imgIdx < imagesToCreate.length; imgIdx++) {
          await ProductImage.create(
            {
              productId: product.id,
              imageUrl: imagesToCreate[imgIdx],
              isPrimary: imgIdx === 0,
              displayOrder: imgIdx,
              altText: `${product.name} - Image ${imgIdx + 1}`,
            },
            { transaction }
          );
        }

        // Add variant if color or size provided
        if (row.colorName || row.sizeName) {
          let colorId = null;
          let sizeId = null;

          if (row.colorName && colorMap.has(row.colorName.toLowerCase())) {
            colorId = colorMap.get(row.colorName.toLowerCase());
          }
          if (row.sizeName && sizeMap.has(row.sizeName.toLowerCase())) {
            sizeId = sizeMap.get(row.sizeName.toLowerCase());
          }

          await ProductVariant.create(
            {
              productId: product.id,
              sku: `${product.sku}-VAR`,
              colorId,
              sizeId,
              name: `${product.name} ${row.colorName || ''} ${row.sizeName || ''}`.trim(),
              mrp: product.price,
              salePrice: product.salePrice,
              stock: product.stock,
              imageUrl: imagesToCreate[0] || null,
              isActive: true,
              displayOrder: 0,
            },
            { transaction }
          );
        }

        await transaction.commit();
        createdCount++;
        productsToSearchIndex.push(product.id);
      } catch (err) {
        await transaction.rollback();
        failedCount++;
        batchErrors.push({ row: row.rowNumber, sku: row.sku, error: err.message });
      }

      // Update progress every 20 rows or on last row
      if ((i + 1) % 20 === 0 || i === validRows.length - 1) {
        await bulkImport.update({
          processedRows: i + 1,
          createdCount,
          failedCount,
        });
      }
    }

    // Determine final status
    let finalStatus = BULK_IMPORT_STATUS.COMPLETED;
    if (failedCount > 0 && createdCount === 0) {
      finalStatus = BULK_IMPORT_STATUS.FAILED;
    } else if (failedCount > 0) {
      finalStatus = BULK_IMPORT_STATUS.PARTIALLY_COMPLETED;
    }

    await bulkImport.update({
      status: finalStatus,
      createdCount,
      failedCount,
      errors: batchErrors,
    });

    // Record Audit Log
    await AuditLog.create({
      adminId,
      action: 'BULK_IMPORT_COMPLETED',
      entity: 'BulkImport',
      entityId: bulkImport.id,
      metadata: { total: validRows.length, created: createdCount, failed: failedCount, status: finalStatus },
    });

    // Index created products to Meilisearch in background
    if (productsToSearchIndex.length > 0) {
      this.batchIndexToMeilisearch(productsToSearchIndex).catch((err) => {
        logger.warn(`Meilisearch batch sync error: ${err.message}`);
      });
    }

    return {
      status: finalStatus,
      createdCount,
      failedCount,
      errors: batchErrors,
    };
  },

  /**
   * Batch index an array of product IDs into Meilisearch
   */
  async batchIndexToMeilisearch(productIds) {
    try {
      const products = await Product.findAll({
        where: { id: { [Op.in]: productIds } },
        include: [
          {
            model: Subcategory,
            as: 'subcategory',
            include: [{ model: Category, as: 'category' }],
          },
          { model: ProductImage, as: 'images' },
        ],
      });

      const docs = products.map((p) => {
        const primaryImage = p.images?.find((img) => img.isPrimary) || p.images?.[0];
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          shortDescription: p.shortDescription,
          description: p.description,
          price: parseFloat(p.price),
          salePrice: parseFloat(p.salePrice),
          discountPercent: p.discountPercent,
          stock: p.stock,
          rating: parseFloat(p.rating || 0),
          reviewCount: p.reviewCount || 0,
          status: p.status,
          isActive: p.isActive,
          isFeatured: p.isFeatured,
          isBestSeller: p.isBestSeller,
          tags: p.tags || [],
          category: p.subcategory?.category?.name || '',
          subcategory: p.subcategory?.name || '',
          imageUrl: primaryImage?.imageUrl || '',
          createdAt: p.createdAt?.toISOString(),
        };
      });

      await meiliService.indexProducts(docs);
      logger.info(`Meilisearch indexed ${docs.length} bulk imported products successfully`);
    } catch (err) {
      logger.warn(`Meilisearch bulk indexing failed: ${err.message}`);
    }
  },
};

export default bulkImportService;
