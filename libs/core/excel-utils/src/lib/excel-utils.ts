import * as XLSX from 'xlsx';
import moment from 'moment';
import {Product, ProductData} from "@myproject/core/api-types";

// Function to replace negative prices with 0
function replaceNegativePrices(prices: any): number[] {
  if (typeof prices === 'string') {
    return prices.split(';').map(price => {
      const num = parseFloat(price.replace(',', '.'));
      return num < 0 ? 0 : num;
    });
  }
  return [];
}

// Function to format the date to ISO 8601
export function formatDate(date: any): string {
  if (typeof date === 'string') {
    return moment(date, 'DD/MM/YYYY').format('YYYY-MM-DD');
  }

  if (typeof date === 'number') {
    // Adjust Excel date format by subtracting 2 days
    const excelDate = moment({ y: 1900, d: 1 }).add(date - 2, 'days');
    return excelDate.format('YYYY-MM-DD');
  }

  return '';
}

// Function to deduce the category based on the name
function deduceCategory(name: string): 'product' | 'equipment' {
  return name.toLowerCase().includes('equipment') ? 'equipment' : 'product';
}
// Function to read and parse the Excel file
export function readExcelFile(file: File): Promise<Product[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Filter out unwanted data (e.g., header rows)
      const filteredData = (jsonData as ProductData[]).filter((item: ProductData) => {
        // Check if UpdatedOn is a string and compare with "updated_on"
        if (typeof item.UpdatedOn === 'string') {
          return item.Name && item.Name !== "name" && item.UpdatedOn !== "updated_on";
        }

        // If UpdatedOn is not a string, you may skip the comparison
        return item.Name && item.Name !== "name";
      });

      // Apply data transformation
      const transformedData = transformData(filteredData);
      resolve(transformedData);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

// Function to transform and process the data
export function transformData(input: ProductData[]): Product[] {
  const uniqueNames = new Set(); // Ensure name uniqueness

  return input
    .reverse() // Reverse the array to process the last occurrence first
    .map((item: ProductData) => {
      // Check if the data is valid
      if (!item.Name || !item.UpdatedOn || !item.Prices) {
        return null;
      }

      const updatedAt = formatDate(item.UpdatedOn);
      const prices = replaceNegativePrices(item.Prices);
      const category = deduceCategory(item.Name);

      // Ensure name uniqueness
      if (uniqueNames.has(item.Name)) return null;
      uniqueNames.add(item.Name);

      return {
        name: item.Name,
        updated_at: updatedAt,
        prices: prices,
        rate: parseFloat(item['Rate %']?.toString()) || 0,
        category: category,
      };
    })
    .filter(item => item !== null) as Product[]; // Filter out null items and return an array of type Product
}
