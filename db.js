// Database service for IndexedDB
const DB_NAME = 'stempelklocka';
const DB_VERSION = 1;

// Database schema and initialization
const initDB = async () => {
  return idb.openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create employees store
      if (!db.objectStoreNames.contains('employees')) {
        const employeeStore = db.createObjectStore('employees', { keyPath: 'personnummer' });
        employeeStore.createIndex('personnummerIdx', 'personnummer', { unique: true });
      }
      
      // Create timestamps store
      if (!db.objectStoreNames.contains('timestamps')) {
        const timestampStore = db.createObjectStore('timestamps', { keyPath: 'id', autoIncrement: true });
        timestampStore.createIndex('personnummerIdx', 'personnummer', { unique: false });
        timestampStore.createIndex('dateIdx', 'date', { unique: false });
      }
      
      // Create config store
      if (!db.objectStoreNames.contains('config')) {
        const configStore = db.createObjectStore('config', { keyPath: 'key' });
      }
    }
  });
};

// Database operations
const dbService = {
  // Config operations
  async saveConfig(key, value) {
    const db = await initDB();
    await db.put('config', { key, value });
  },
  
  async getConfig(key) {
    const db = await initDB();
    return await db.get('config', key);
  },
  
  async savePin(pin) {
    const hashedPin = CryptoJS.SHA256(pin).toString();
    await this.saveConfig('pinHash', hashedPin);
  },
  
  async verifyPin(pin) {
    const storedPin = await this.getConfig('pinHash');
    if (!storedPin) return false;
    const hashedPin = CryptoJS.SHA256(pin).toString();
    return storedPin.value === hashedPin;
  },
  
  // Function to normalize personnummer before database operations
  normalizePersonnummer(personnummer) {
    // Check if utils is loaded
    if (window.utils && typeof window.utils.normalizePersonnummer === 'function') {
      return window.utils.normalizePersonnummer(personnummer);
    }
    return personnummer; // Fallback if utils is not loaded
  },
  
  // Employee operations
  async saveEmployee(employee) {
    const db = await initDB();
    // Make sure the personnummer is normalized
    if (employee.personnummer) {
      employee.personnummer = this.normalizePersonnummer(employee.personnummer);
    }
    await db.put('employees', employee);
  },
  
  async getEmployee(personnummer) {
    const db = await initDB();
    // Normalize personnummer before lookup
    const normalizedPnr = this.normalizePersonnummer(personnummer);
    return await db.get('employees', normalizedPnr);
  },
  
  async getAllEmployees() {
    const db = await initDB();
    return await db.getAll('employees');
  },
  
  async deleteEmployee(personnummer) {
    const db = await initDB();
    // Normalize personnummer before deletion
    const normalizedPnr = this.normalizePersonnummer(personnummer);
    await db.delete('employees', normalizedPnr);
  },
  
  // Timestamp operations
  async saveTimestamp(personnummer, type) {
    const db = await initDB();
    // Normalize personnummer before saving timestamp
    const normalizedPnr = this.normalizePersonnummer(personnummer);
    const timestamp = {
      personnummer: normalizedPnr,
      type, // 'in' or 'out'
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0]
    };
    return await db.add('timestamps', timestamp);
  },
  
  async getTimestampsByPersonnummer(personnummer) {
    const db = await initDB();
    // Normalize personnummer before lookup
    const normalizedPnr = this.normalizePersonnummer(personnummer);
    const index = db.transaction('timestamps').store.index('personnummerIdx');
    return await index.getAll(normalizedPnr);
  },
  
  async getTimestampsByDate(startDate, endDate) {
    const db = await initDB();
    const index = db.transaction('timestamps').store.index('dateIdx');
    const range = IDBKeyRange.bound(startDate, endDate);
    return await index.getAll(range);
  },
  
  async getAllTimestamps() {
    const db = await initDB();
    return await db.getAll('timestamps');
  },
  
  async getLatestTimestampByPersonnummer(personnummer) {
    const db = await initDB();
    // Normalize personnummer before lookup
    const normalizedPnr = this.normalizePersonnummer(personnummer);
    const tx = db.transaction('timestamps', 'readonly');
    const store = tx.objectStore('timestamps');
    const index = store.index('personnummerIdx');
    
    // Get all timestamps for this personnummer
    const timestamps = await index.getAll(normalizedPnr);
    
    // Sort by timestamp descending and return the first one
    if (timestamps && timestamps.length > 0) {
      return timestamps.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      )[0];
    }
    
    return null;
  },
  
  async clearAllData() {
    const db = await initDB();
    const tx = db.transaction(['employees', 'timestamps', 'config'], 'readwrite');
    await tx.objectStore('employees').clear();
    await tx.objectStore('timestamps').clear();
    await tx.objectStore('config').clear();
    await tx.done;
  }
};

// Export the dbService
window.dbService = dbService; 