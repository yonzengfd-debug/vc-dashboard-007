import Papa from 'papaparse';
import { supabase } from '../lib/supabase';

export const dataService = {
  /**
   * Fetches sales data from either Supabase or fallback CSV.
   * @returns {Promise<Array>} Array of sales data objects.
   */
  async fetchSalesData() {
    const dataSource = import.meta.env.VITE_DATA_SOURCE || 'csv';

    // 1. Try fetching from Supabase if explicitly requested
    if (dataSource === 'supabase' && supabase) {
      try {
        const { data, error } = await supabase
          .from('sales_data')
          .select('*')
          .order('date', { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          console.log('Data loaded from Supabase');
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch failed, falling back to CSV:', err.message);
      }
    }

    // 2. Fallback to CSV
    try {
      const response = await fetch('/data/sales_data.csv');
      const csvText = await response.text();
      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error)
        });
      });
    } catch (err) {
      console.error('CSV fetch failed:', err);
      return [];
    }
  }
};
