import { useState, useMemo } from 'react';

interface SearchOptions {
  fields: string[];
  caseSensitive?: boolean;
  minChars?: number;
}

// Helper function to get nested field value
const getNestedValue = (obj: Record<string, any>, path: string): any => {
  const keys = path.split('.');
  let value: any = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) {
      return '';
    }
    value = value[key];
  }
  
  return value ?? '';
};

export function useSearch<T extends Record<string, any>>(
  data: T[],
  options: SearchOptions
) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm || searchTerm.length < (options.minChars || 0)) {
      return data;
    }

    const term = options.caseSensitive ? searchTerm : searchTerm.toLowerCase();

    return data.filter(item =>
      options.fields.some(field => {
        const value = String(getNestedValue(item, field) || '');
        const fieldValue = options.caseSensitive ? value : value.toLowerCase();
        return fieldValue.includes(term);
      })
    );
  }, [data, searchTerm, options]);

  return {
    searchTerm,
    setSearchTerm,
    filteredData,
  };
}
