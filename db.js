// IndexedDB Database Service

// Database name and version
const DB_NAME = 'stempelklocka';
const DB_VERSION = 1;

// Initialize the database
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = event => {
      reject(`Database error: ${event.target.error}`);
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    // Create object stores if this is a new database or a version upgrade
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      // Store for employees
      if (!db.objectStoreNames.contains('employees')) {
        const employeeStore = db.createObjectStore('employees', { keyPath: 'personnummer' });
        employeeStore.createIndex('approved', 'approved', { unique: false });
        employeeStore.createIndex('name', 'name', { unique: false });
      }
      
      // Store for timestamps
      if (!db.objectStoreNames.contains('timestamps')) {
        const timestampStore = db.createObjectStore('timestamps', { keyPath: 'id', autoIncrement: true });
        timestampStore.createIndex('personnummer', 'personnummer', { unique: false });
        timestampStore.createIndex('checkInTime', 'checkInTime', { unique: false });
        timestampStore.createIndex('checkOutTime', 'checkOutTime', { unique: false });
      }
      
      // Store for configurations
      if (!db.objectStoreNames.contains('config')) {
        const configStore = db.createObjectStore('config', { keyPath: 'key' });
        configStore.createIndex('value', 'value', { unique: false });
      }
    };
  });
};

// Database service object
const dbService = {
  // Save a configuration value
  saveConfig: async (key, value) => {
    console.log("Saving config:", key, value);
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['config'], 'readwrite');
      const store = transaction.objectStore('config');
      
      const request = store.put({ key, value });
      
      request.onsuccess = () => {
        console.log(`Config saved: ${key} = ${value}`);
        resolve(value); // Return the saved value for convenience
      };
      
      request.onerror = event => {
        reject(`Error saving config: ${event.target.error}`);
      };
    });
  },
  
  // Get a configuration value
  getConfig: async (key) => {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['config'], 'readonly');
      const store = transaction.objectStore('config');
      
      const request = store.get(key);
      
      request.onsuccess = event => {
        const result = event.target.result;
        console.log(`Config retrieved: ${key} =`, result);
        // Return only the value, not the whole object
        resolve(result ? result.value : null);
      };
      
      request.onerror = event => {
        reject(`Error getting config: ${event.target.error}`);
      };
    });
  },
  
  // Save an employee
  saveEmployee: async (employee) => {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['employees'], 'readwrite');
      const store = transaction.objectStore('employees');
      
      const request = store.put(employee);
      
      request.onsuccess = () => {
        resolve(employee);
      };
      
      request.onerror = event => {
        reject(`Error saving employee: ${event.target.error}`);
      };
    });
  },
  
  // Get an employee by personnummer
  getEmployee: async (personnummer) => {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['employees'], 'readonly');
      const store = transaction.objectStore('employees');
      
      const request = store.get(personnummer);
      
      request.onsuccess = event => {
        resolve(event.target.result);
      };
      
      request.onerror = event => {
        reject(`Error getting employee: ${event.target.error}`);
      };
    });
  },
  
  // Delete an employee by personnummer
  deleteEmployee: async (personnummer) => {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['employees'], 'readwrite');
      const store = transaction.objectStore('employees');
      
      const request = store.delete(personnummer);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = event => {
        reject(`Error deleting employee: ${event.target.error}`);
      };
    });
  },
  
  // Get all employees
  getAllEmployees: async () => {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['employees'], 'readonly');
      const store = transaction.objectStore('employees');
      const employees = [];
      
      const request = store.openCursor();
      
      request.onsuccess = event => {
        const cursor = event.target.result;
        
        if (cursor) {
          employees.push(cursor.value);
          cursor.continue();
        } else {
          resolve(employees);
        }
      };
      
      request.onerror = event => {
        reject(`Error getting all employees: ${event.target.error}`);
      };
    });
  },
  
  // Save a timestamp
  saveTimestamp: async (timestamp, extraData = null) => {
    const db = await initDB();
    
    // If extraData is provided, merge it with the timestamp object
    const fullTimestamp = extraData ? { ...timestamp, ...extraData } : timestamp;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['timestamps'], 'readwrite');
      const store = transaction.objectStore('timestamps');
      
      const request = store.put(fullTimestamp);
      
      request.onsuccess = event => {
        resolve({ ...fullTimestamp, id: event.target.result });
      };
      
      request.onerror = event => {
        reject(`Error saving timestamp: ${event.target.error}`);
      };
    });
  },
  
  // Get all timestamps for a specific employee
  getTimestampsByPersonnummer: async (personnummer) => {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['timestamps'], 'readonly');
      const store = transaction.objectStore('timestamps');
      const index = store.index('personnummer');
      const timestamps = [];
      
      const request = index.openCursor(IDBKeyRange.only(personnummer));
      
      request.onsuccess = event => {
        const cursor = event.target.result;
        
        if (cursor) {
          timestamps.push(cursor.value);
          cursor.continue();
        } else {
          resolve(timestamps);
        }
      };
      
      request.onerror = event => {
        reject(`Error getting timestamps: ${event.target.error}`);
      };
    });
  },
  
  // Get all timestamps
  getAllTimestamps: async () => {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['timestamps'], 'readonly');
      const store = transaction.objectStore('timestamps');
      const timestamps = [];
      
      const request = store.openCursor();
      
      request.onsuccess = event => {
        const cursor = event.target.result;
        
        if (cursor) {
          timestamps.push(cursor.value);
          cursor.continue();
        } else {
          resolve(timestamps);
        }
      };
      
      request.onerror = event => {
        reject(`Error getting all timestamps: ${event.target.error}`);
      };
    });
  },
  
  // Get latest timestamp for an employee
  getLatestTimestamp: async (personnummer) => {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['timestamps'], 'readonly');
      const store = transaction.objectStore('timestamps');
      const index = store.index('personnummer');
      
      // Get all timestamps for the employee
      const request = index.getAll(IDBKeyRange.only(personnummer));
      
      request.onsuccess = event => {
        const timestamps = event.target.result;
        if (timestamps.length === 0) {
          resolve(null);
          return;
        }
        
        // Sort by time, latest first
        timestamps.sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime));
        resolve(timestamps[0]);
      };
      
      request.onerror = event => {
        reject(`Error getting latest timestamp: ${event.target.error}`);
      };
    });
  },
  
  // Get admin pin
  verifyPin: async (pin) => {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['config'], 'readonly');
      const store = transaction.objectStore('config');
      
      const request = store.get('adminPin');
      
      request.onsuccess = event => {
        const result = event.target.result;
        // Compare just the values, not the whole stored object
        resolve(result && result.value === pin);
      };
      
      request.onerror = event => {
        reject(`Error verifying PIN: ${event.target.error}`);
      };
    });
  },
  
  // Clear all data
  clearAllData: async () => {
    const db = await initDB();
    
    const promises = ['employees', 'timestamps', 'config'].map(storeName => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const request = store.clear();
        
        request.onsuccess = () => {
          resolve(true);
        };
        
        request.onerror = event => {
          reject(`Error clearing ${storeName}: ${event.target.error}`);
        };
      });
    });
    
    return Promise.all(promises);
  }
};

// Export the service
window.dbService = dbService; 